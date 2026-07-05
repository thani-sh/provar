package main

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	provarv1 "github.com/thani-sh/provar/apps/provar-api/gen/provar/v1"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine"
	"github.com/thani-sh/provar/libs/engine/browser"
	"github.com/thani-sh/provar/libs/logger"
)

// runServer implements RunService. Like CompileService, each RPC owns its
// own browser session. Run is simpler than Compile: no LLM is involved, the
// engine only needs the compiled Lua and the action list.
type runServer struct {
	provarv1.UnimplementedRunServiceServer
}

// Run executes a single compiled scenario and streams lifecycle events to
// the client. The companion .test.lua file must already exist on disk —
// `provar compile` (or CompileService.Compile) produces it. Errors before
// run-started (missing project/file/lua) surface as gRPC status codes;
// runtime errors surface as TaskFailed + RunFinished with status=FAILED.
func (s *runServer) Run(req *provarv1.RunRequest, stream provarv1.RunService_RunServer) error {
	ctx := stream.Context()
	if req.GetProjectPath() == "" {
		return status.Error(codes.InvalidArgument, "project_path is required")
	}
	if req.GetFilePath() == "" {
		return status.Error(codes.InvalidArgument, "file_path is required")
	}
	project, err := domain.LoadProject(req.GetProjectPath())
	if err != nil {
		return mapLoadError(err)
	}
	actions, err := domain.ParseFile(project.Path, req.GetFilePath())
	if err != nil {
		return status.Error(codes.InvalidArgument, err.Error())
	}
	luaPath := strings.TrimSuffix(req.GetFilePath(), ".test.yml") + ".test.lua"
	luaCode, err := os.ReadFile(filepath.Join(project.Path, luaPath))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return status.Error(codes.FailedPrecondition, fmt.Sprintf("compiled Lua not found at %s — run compile first", luaPath))
		}
		return status.Error(codes.InvalidArgument, err.Error())
	}
	w, h := project.Browser.Resolved()
	browserSession, err := browser.NewSession(ctx, browser.Options{
		Headless: req.GetHeadless(),
		Width:    w,
		Height:   h,
	})
	if err != nil {
		return status.Errorf(codes.Unavailable, "launch browser: %v", err)
	}
	defer func() {
		if cerr := browserSession.Close(); cerr != nil && !errors.Is(cerr, context.Canceled) {
			logger.Warn("close browser", "err", cerr)
		}
	}()
	runner := engine.NewRunner()
	job, err := runner.Run(ctx, actions, string(luaCode), engine.RunOptions{
		Headless: req.GetHeadless(),
		Vars:     project.Vars,
		UpTo:     req.GetUpTo(),
		Browser:  project.Browser,
	})
	if err != nil {
		return status.Error(codes.InvalidArgument, err.Error())
	}
	fileStem := strings.TrimSuffix(filepath.Base(req.GetFilePath()), ".test.yml")
	return streamRunEvents(job, stream, project.Path, fileStem)
}

// streamRunEvents pumps engine.Runner events into the gRPC stream. Visual
// events are intercepted so the screenshot is saved to disk before being
// forwarded — AcceptBaseline reads from the same directory later.
func streamRunEvents(job *domain.Job, stream grpc.ServerStreamingServer[provarv1.RunEvent], projectRoot, fileStem string) error {
	for ev := range job.Subscribe() {
		re, handled := runEventToProto(ev, projectRoot, fileStem)
		if handled == visualHandled {
			if err := saveVisualScreenshot(projectRoot, fileStem, ev); err != nil {
				logger.Warn("save screenshot", "err", err)
			}
		}
		if re == nil {
			continue
		}
		if err := stream.Send(re); err != nil {
			return err
		}
	}
	return nil
}

// runEventToProto translates a domain.Event emitted by engine.Runner into
// the wire-shape RunEvent. Returns the event and a marker for whether the
// caller needs to save a screenshot before forwarding.
//
// The dual-return is necessary because visual events carry data the
// runner doesn't know how to persist — the API server owns the project
// filesystem and must write the PNG before the client receives it.
func runEventToProto(ev domain.Event, projectRoot, fileStem string) (re *provarv1.RunEvent, visual handleVisual) {
	switch ev.Type {
	case engine.EventRunStarted:
		return &provarv1.RunEvent{Event: &provarv1.RunEvent_RunStarted{RunStarted: &provarv1.RunStarted{}}}, visualSkip
	case engine.EventTaskStarted:
		d, ok := ev.Data.(map[string]string)
		if !ok {
			return nil, visualSkip
		}
		return &provarv1.RunEvent{Event: &provarv1.RunEvent_TaskStarted{TaskStarted: &provarv1.TaskStarted{
			TaskId: d["taskId"],
			Title:  d["title"],
		}}}, visualSkip
	case engine.EventTaskFinished:
		d, ok := ev.Data.(map[string]string)
		if !ok {
			return nil, visualSkip
		}
		return &provarv1.RunEvent{Event: &provarv1.RunEvent_TaskFinished{TaskFinished: &provarv1.TaskFinished{
			TaskId: d["taskId"],
		}}}, visualSkip
	case engine.EventTaskFailed:
		d, ok := ev.Data.(map[string]string)
		if !ok {
			return nil, visualSkip
		}
		return &provarv1.RunEvent{Event: &provarv1.RunEvent_TaskFailed{TaskFailed: &provarv1.TaskFailed{
			TaskId: d["taskId"],
			Error:  d["error"],
		}}}, visualSkip
	case engine.EventVisualCompareTriggered:
		d, ok := ev.Data.(map[string]any)
		if !ok {
			return nil, visualSkip
		}
		taskID, _ := d["taskId"].(string)
		pngB64, _ := d["screenshotBase64"].(string)
		baselinePath := projectBaselinePath(projectRoot, fileStem, taskID)
		return &provarv1.RunEvent{Event: &provarv1.RunEvent_VisualComparisonTriggered{VisualComparisonTriggered: &provarv1.VisualComparisonTriggered{
			TaskId:           taskID,
			ScreenshotBase64: pngB64,
			Result:           visualCompareResult(pngB64, baselinePath),
		}}}, visualHandled
	case engine.EventRunFinished:
		d, ok := ev.Data.(map[string]any)
		if !ok {
			return nil, visualSkip
		}
		statusStr, _ := d["status"].(string)
		duration, _ := d["duration"].(string)
		errMsg, _ := d["error"].(string)
		return &provarv1.RunEvent{Event: &provarv1.RunEvent_RunFinished{RunFinished: &provarv1.RunFinished{
			Status:   jobStatusToProto(domain.JobStatus(statusStr)),
			Duration: duration,
			Error:    errMsg,
		}}}, visualSkip
	}
	return nil, visualSkip
}

// handleVisual is a private enum so the visual-handling branch in
// streamRunEvents reads as named intent rather than a magic bool.
type handleVisual int

const (
	visualSkip handleVisual = iota
	visualHandled
)

// AcceptBaseline promotes the latest screenshots for fileStem to the
// baselines directory. Empty file promotes every test file's screenshots.
// Returns NotFound when no current-run screenshots exist yet.
func (s *runServer) AcceptBaseline(_ context.Context, req *provarv1.AcceptBaselineRequest) (*provarv1.BaselineResult, error) {
	if req.GetProjectPath() == "" {
		return nil, status.Error(codes.InvalidArgument, "project_path is required")
	}
	project, err := domain.LoadProject(req.GetProjectPath())
	if err != nil {
		return nil, mapLoadError(err)
	}
	visualRoot := filepath.Join(project.Path, apiVisualDir)
	if _, err := os.Stat(visualRoot); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, status.Error(codes.NotFound, fmt.Sprintf("no screenshots found at %s — run first", visualRoot))
		}
		return nil, status.Error(codes.Internal, err.Error())
	}
	dirs, err := os.ReadDir(visualRoot)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	var eligible []string
	for _, d := range dirs {
		if !d.IsDir() {
			continue
		}
		if req.GetFile() != "" && d.Name() != req.GetFile() {
			continue
		}
		eligible = append(eligible, d.Name())
	}
	if len(eligible) == 0 {
		if req.GetFile() != "" {
			return nil, status.Error(codes.NotFound, fmt.Sprintf("no screenshots for --file %q", req.GetFile()))
		}
		return nil, status.Error(codes.NotFound, fmt.Sprintf("no per-file screenshot directories under %s", visualRoot))
	}
	totalAccepted := 0
	for _, stem := range eligible {
		n, err := acceptBaselines(project.Path, stem)
		if err != nil {
			return nil, status.Error(codes.Internal, fmt.Sprintf("%s: %v", stem, err))
		}
		totalAccepted += n
	}
	return &provarv1.BaselineResult{Accepted: int32(totalAccepted)}, nil
}

// apiVisualDir is the project-relative directory where the API stores
// current-run screenshots. Same layout as the CLI's .provar/visual —
// so AcceptBaseline could share implementations if a future refactor
// moves the helpers into libs/domain.
const apiVisualDir = ".provar/visual"

// apiBaselinesDir is the project-relative directory where accepted
// baselines live. Copied 1:1 from visual to baselines.
const apiBaselinesDir = ".provar/baselines"

// projectVisualPath is the on-disk location of the current-run screenshot
// for (fileStem, taskID). Mirrors apps/provar-cli/commands/visual.go —
// kept duplicated here so the API doesn't depend on the CLI package.
func projectVisualPath(projectRoot, fileStem, taskID string) string {
	return filepath.Join(projectRoot, apiVisualDir, fileStem, taskID+".png")
}

// projectBaselinePath is the on-disk location of the accepted baseline
// for (fileStem, taskID). Missing files yield visualFirstRun, never error.
func projectBaselinePath(projectRoot, fileStem, taskID string) string {
	return filepath.Join(projectRoot, apiBaselinesDir, fileStem, taskID+".png")
}

// saveVisualScreenshot decodes the base64 PNG from a visual event and
// writes it under .provar/visual/<fileStem>/<taskID>.png. Returns the
// absolute path on success.
func saveVisualScreenshot(projectRoot, fileStem string, ev domain.Event) error {
	d, ok := ev.Data.(map[string]any)
	if !ok {
		return fmt.Errorf("event data is not map[string]any")
	}
	taskID, _ := d["taskId"].(string)
	pngB64, _ := d["screenshotBase64"].(string)
	if taskID == "" || pngB64 == "" {
		return fmt.Errorf("visual event missing taskId or screenshot")
	}
	png, err := base64.StdEncoding.DecodeString(pngB64)
	if err != nil {
		return fmt.Errorf("decode: %w", err)
	}
	dst := projectVisualPath(projectRoot, fileStem, taskID)
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return fmt.Errorf("create dir: %w", err)
	}
	return os.WriteFile(dst, png, 0o644)
}

// visualCompareResult hashes the just-captured PNG and compares against the
// baseline. The runner does the screenshot capture; this fills in the
// first-run/match/diff verdict so the editor can render visual state.
func visualCompareResult(pngB64, baselinePath string) provarv1.VisualComparisonResult {
	png, err := base64.StdEncoding.DecodeString(pngB64)
	if err != nil {
		return provarv1.VisualComparisonResult_VISUAL_COMPARISON_RESULT_UNSPECIFIED
	}
	bh, err := os.ReadFile(baselinePath)
	if err != nil {
		return provarv1.VisualComparisonResult_VISUAL_COMPARISON_RESULT_FIRST_RUN
	}
	if sha256.Sum256(png) == sha256.Sum256(bh) {
		return provarv1.VisualComparisonResult_VISUAL_COMPARISON_RESULT_MATCH
	}
	return provarv1.VisualComparisonResult_VISUAL_COMPARISON_RESULT_DIFF
}

// acceptBaselines promotes the current-run screenshots for fileStem to the
// baselines directory. Mirrors apps/provar-cli/commands/visual.go so the
// two implementations stay in sync — see projectVisualPath comment.
func acceptBaselines(projectRoot, fileStem string) (copied int, err error) {
	src := filepath.Join(projectRoot, apiVisualDir, fileStem)
	dst := filepath.Join(projectRoot, apiBaselinesDir, fileStem)
	if _, err := os.Stat(src); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return 0, fmt.Errorf("no current screenshots for %s", fileStem)
		}
		return 0, err
	}
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return 0, err
	}
	entries, err := os.ReadDir(src)
	if err != nil {
		return 0, err
	}
	for _, e := range entries {
		if e.IsDir() || filepath.Ext(e.Name()) != ".png" {
			continue
		}
		from, err := os.Open(filepath.Join(src, e.Name()))
		if err != nil {
			return copied, err
		}
		to, err := os.Create(filepath.Join(dst, e.Name()))
		if err != nil {
			from.Close()
			return copied, err
		}
		_, copyErr := io.Copy(to, from)
		from.Close()
		to.Close()
		if copyErr != nil {
			return copied, copyErr
		}
		copied++
	}
	return copied, nil
}

// formatVisualShortHash returns the first 12 hex chars of sha256(png).
// Kept here so callers in this package can produce stable visual diff
// messages without depending on the CLI package.
func formatVisualShortHash(png []byte) string {
	sum := sha256.Sum256(png)
	return hex.EncodeToString(sum[:])[:12]
}
