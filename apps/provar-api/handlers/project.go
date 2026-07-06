package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/coder/websocket"
	"go.yaml.in/yaml/v4"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/logger"
)

func init() {
	api.Register("v1/project/create", handleProjectCreate)
	api.Register("v1/project/file/list", handleProjectFileList)
	api.Register("v1/project/file/load", handleProjectFileLoad)
	api.Register("v1/project/file/save", handleProjectFileSave)
	api.Register("v1/project/file/delete", handleProjectFileDelete)
	api.Register("v1/project/config/load", handleProjectConfigLoad)
	api.Register("v1/project/config/save", handleProjectConfigSave)
	api.Register("v1/project/action/load", handleProjectActionLoad)
	api.Register("v1/project/visual/load", handleProjectVisualLoad)
	api.Register("v1/project/visual/accept", handleProjectVisualAccept)
	api.Register("v1/project/clean", handleProjectClean)
}

// okReply is the ak-paired success shape used by every v1/project/* write
// endpoint. The ADR lists these as "no reply expected beyond a single
// ak-paired status" — `{ok: true}` is the minimum useful payload.
type okReply struct {
	OK bool `json:"ok"`
}

func writeOK(ctx context.Context, c *websocket.Conn, env api.Envelope) error {
	return api.WriteEnvelope(ctx, c, env.Type, okReply{OK: true}, env.Meta.ID)
}

// projectCreateReq is the data shape for v1/project/create. path is the
// absolute target directory; sample seeds a demo .test.yml + baseUrl
// pointing at SampleDemoURL; force removes an existing target first.
type projectCreateReq struct {
	Path   string `json:"path"`
	Sample bool   `json:"sample,omitempty"`
	Force  bool   `json:"force,omitempty"`
}

func handleProjectCreate(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectCreateReq
	if err := json.Unmarshal(env.Data, &req); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "invalid data: "+err.Error())
	}
	if err := domain.InitProject(req.Path, req.Sample, req.Force); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, err.Error())
	}
	logger.Info("project created", "path", req.Path, "sample", req.Sample, "force", req.Force)
	return writeOK(ctx, c, env)
}

// projectFileListReq is the data shape for v1/project/file/list. project
// is the absolute project root; the reply lists every .test.yml under it,
// relative to the root.
type projectFileListReq struct {
	Project string `json:"project"`
}

type projectFileListReply struct {
	Files []string `json:"files"`
}

func handleProjectFileList(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectFileListReq
	if err := json.Unmarshal(env.Data, &req); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "invalid data: "+err.Error())
	}
	project, err := s.GetOrLoadProject(req.Project)
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "load project: "+err.Error())
	}
	files := make([]string, len(project.Files))
	for i, f := range project.Files {
		files[i] = f.Path
	}
	return api.WriteEnvelope(ctx, c, env.Type, projectFileListReply{Files: files}, env.Meta.ID)
}

// projectFileLoadReq is the data shape for v1/project/file/load. path is
// project-relative. The reply carries the raw bytes as a string — the
// caller decodes based on the file extension.
type projectFileLoadReq struct {
	Project string `json:"project"`
	Path    string `json:"path"`
}

type projectFileLoadReply struct {
	Content string `json:"content"`
}

func handleProjectFileLoad(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectFileLoadReq
	if err := json.Unmarshal(env.Data, &req); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "invalid data: "+err.Error())
	}
	project, err := s.GetOrLoadProject(req.Project)
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "load project: "+err.Error())
	}
	data, err := os.ReadFile(filepath.Join(project.Path, req.Path))
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "read file: "+err.Error())
	}
	return api.WriteEnvelope(ctx, c, env.Type, projectFileLoadReply{Content: string(data)}, env.Meta.ID)
}

// projectFileSaveReq is the data shape for v1/project/file/save. content
// is the YAML encoding of the actions list. The handler parses it before
// writing so an invalid file fails at save time, not at the next compile.
type projectFileSaveReq struct {
	Project string `json:"project"`
	Path    string `json:"path"`
	Content string `json:"content"`
}

func handleProjectFileSave(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectFileSaveReq
	if err := json.Unmarshal(env.Data, &req); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "invalid data: "+err.Error())
	}
	project, err := s.GetOrLoadProject(req.Project)
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "load project: "+err.Error())
	}
	var actions []domain.Action
	if err := yaml.Unmarshal([]byte(req.Content), &actions); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "parse yaml: "+err.Error())
	}
	if err := domain.SaveFile(project.Path, req.Path, actions); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "save file: "+err.Error())
	}
	logger.Info("file saved", "project", project.Path, "path", req.Path)
	return writeOK(ctx, c, env)
}

// projectFileDeleteReq is the data shape for v1/project/file/delete. The
// path may point at a file or a directory — both are removed. The handler
// refuses paths that resolve outside the project root.
type projectFileDeleteReq struct {
	Project string `json:"project"`
	Path    string `json:"path"`
}

func handleProjectFileDelete(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectFileDeleteReq
	if err := json.Unmarshal(env.Data, &req); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "invalid data: "+err.Error())
	}
	project, err := s.GetOrLoadProject(req.Project)
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "load project: "+err.Error())
	}
	if err := domain.DeleteFile(project.Path, req.Path); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, err.Error())
	}
	logger.Info("file deleted", "project", project.Path, "path", req.Path)
	return writeOK(ctx, c, env)
}

// projectConfigLoadReq is the data shape for v1/project/config/load. The
// reply carries the YAML as a generic map so unknown fields round-trip
// through the GUI untouched.
type projectConfigLoadReq struct {
	Project string `json:"project"`
}

type projectConfigLoadReply struct {
	Config map[string]any `json:"config"`
}

func handleProjectConfigLoad(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectConfigLoadReq
	if err := json.Unmarshal(env.Data, &req); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "invalid data: "+err.Error())
	}
	project, err := s.GetOrLoadProject(req.Project)
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "load project: "+err.Error())
	}
	cfg, err := domain.LoadConfig(project.Path)
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "load config: "+err.Error())
	}
	return api.WriteEnvelope(ctx, c, env.Type, projectConfigLoadReply{Config: cfg}, env.Meta.ID)
}

// projectConfigSaveReq is the data shape for v1/project/config/save. config
// is the same shape the load endpoint returns — handlers do not parse it
// into a typed struct, so the GUI can ship arbitrary fields.
type projectConfigSaveReq struct {
	Project string         `json:"project"`
	Config  map[string]any `json:"config"`
}

func handleProjectConfigSave(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectConfigSaveReq
	if err := json.Unmarshal(env.Data, &req); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "invalid data: "+err.Error())
	}
	project, err := s.GetOrLoadProject(req.Project)
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "load project: "+err.Error())
	}
	if err := domain.SaveConfig(project.Path, req.Config); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, err.Error())
	}
	logger.Info("config saved", "project", project.Path)
	return writeOK(ctx, c, env)
}

// projectActionLoadReq is the data shape for v1/project/action/load. file
// is project-relative. The reply carries the compiled .test.lua (empty
// when stale or missing) and a boolean telling the GUI whether to trigger
// a recompile before showing the user the source.
type projectActionLoadReq struct {
	Project string `json:"project"`
	File    string `json:"file"`
}

type projectActionLoadReply struct {
	Code     string `json:"code"`
	UpToDate bool   `json:"upToDate"`
}

func handleProjectActionLoad(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectActionLoadReq
	if err := json.Unmarshal(env.Data, &req); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "invalid data: "+err.Error())
	}
	project, err := s.GetOrLoadProject(req.Project)
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "load project: "+err.Error())
	}
	code, upToDate := domain.LoadCompiledLua(project.Path, req.File)
	return api.WriteEnvelope(ctx, c, env.Type, projectActionLoadReply{Code: code, UpToDate: upToDate}, env.Meta.ID)
}

// projectVisualLoadReq is the data shape for v1/project/visual/load. file
// and actionId locate a single (file, action) screenshot pair. baseline and
// current are base64-encoded PNGs; both are omitted when the corresponding
// file is missing on disk.
type projectVisualLoadReq struct {
	Project  string `json:"project"`
	File     string `json:"file"`
	ActionID string `json:"actionId"`
}

type projectVisualLoadReply struct {
	Baseline string `json:"baseline,omitempty"`
	Current  string `json:"current,omitempty"`
}

func handleProjectVisualLoad(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectVisualLoadReq
	if err := json.Unmarshal(env.Data, &req); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "invalid data: "+err.Error())
	}
	project, err := s.GetOrLoadProject(req.Project)
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "load project: "+err.Error())
	}
	baseline, current := domain.LoadVisualPair(project.Path, req.File, req.ActionID)
	return api.WriteEnvelope(ctx, c, env.Type, projectVisualLoadReply{Baseline: baseline, Current: current}, env.Meta.ID)
}

// projectVisualAcceptReq is the data shape for v1/project/visual/accept.
// An empty file promotes screenshots for every test file in the project;
// a non-empty file targets just that one file's bucket.
type projectVisualAcceptReq struct {
	Project string `json:"project"`
	File    string `json:"file,omitempty"`
}

func handleProjectVisualAccept(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectVisualAcceptReq
	if err := json.Unmarshal(env.Data, &req); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "invalid data: "+err.Error())
	}
	project, err := s.GetOrLoadProject(req.Project)
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "load project: "+err.Error())
	}
	if req.File == "" {
		var total int
		for _, f := range project.Files {
			n, err := domain.AcceptBaselines(project.Path, bucketFor(f.Path))
			if err != nil {
				logger.Warn("accept baselines", "file", f.Path, "err", err)
				continue
			}
			total += n
		}
		logger.Info("baselines accepted (all)", "project", project.Path, "count", total)
	} else {
		n, err := domain.AcceptBaselines(project.Path, bucketFor(req.File))
		if err != nil {
			return api.WriteError(ctx, c, env.Type, env.Meta.ID, err.Error())
		}
		logger.Info("baselines accepted", "project", project.Path, "file", req.File, "count", n)
	}
	return writeOK(ctx, c, env)
}

// projectCleanReq is the data shape for v1/project/clean. By default only
// the current-run screenshots are removed; includeBaselines also drops the
// accepted baselines, and includeLua also drops compiled .test.lua files.
// dryRun reports what would have been removed without touching disk.
type projectCleanReq struct {
	Project          string `json:"project"`
	IncludeBaselines bool   `json:"includeBaselines,omitempty"`
	IncludeLua       bool   `json:"includeLua,omitempty"`
	DryRun           bool   `json:"dryRun,omitempty"`
}

func handleProjectClean(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectCleanReq
	if err := json.Unmarshal(env.Data, &req); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "invalid data: "+err.Error())
	}
	project, err := s.GetOrLoadProject(req.Project)
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "load project: "+err.Error())
	}
	type cleanTarget struct {
		path  string
		label string
		skip  bool
	}
	targets := []cleanTarget{
		{path: filepath.Join(project.Path, domain.VisualDir), label: "current screenshots"},
		{path: filepath.Join(project.Path, domain.BaselinesDir), label: "baselines", skip: !req.IncludeBaselines},
	}
	for _, t := range targets {
		if t.skip {
			continue
		}
		if _, err := os.Stat(t.path); err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				logger.Info("skip clean", "label", t.label)
				continue
			}
			return api.WriteError(ctx, c, env.Type, env.Meta.ID, "stat "+t.label+": "+err.Error())
		}
		if req.DryRun {
			logger.Info("would remove", "label", t.label, "path", t.path)
			continue
		}
		if err := os.RemoveAll(t.path); err != nil {
			return api.WriteError(ctx, c, env.Type, env.Meta.ID, "remove "+t.label+": "+err.Error())
		}
		logger.Info("removed", "label", t.label, "path", t.path)
	}
	if req.IncludeLua {
		for _, f := range project.Files {
			luaPath := filepath.Join(project.Path, strings.TrimSuffix(f.Path, ".test.yml")+".test.lua")
			if _, err := os.Stat(luaPath); err != nil {
				continue
			}
			if req.DryRun {
				logger.Info("would remove compiled", "path", luaPath)
				continue
			}
			if err := os.Remove(luaPath); err != nil {
				return api.WriteError(ctx, c, env.Type, env.Meta.ID, "remove "+luaPath+": "+err.Error())
			}
			logger.Info("removed compiled", "path", luaPath)
		}
	}
	return writeOK(ctx, c, env)
}

// bucketFor returns the per-file subdirectory under VisualDir / BaselinesDir
// for a test file. The bucket is the file's basename without the .test.yml
// extension — matches the saveBaseline (CLI) and AcceptBaselines (SDK)
// convention so GUI and CLI writes land in the same place.
func bucketFor(relPath string) string {
	return strings.TrimSuffix(filepath.Base(relPath), ".test.yml")
}
