package engine

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine/browser"
	"github.com/thani-sh/provar/libs/logger"
)

const (
	EventRunStarted             = "run-started"
	EventTaskStarted            = "task-started"
	EventTaskFinished           = "task-finished"
	EventTaskFailed             = "task-failed"
	EventVisualCompareTriggered = "visual-comparison-triggered"
	EventRunFinished            = "run-finished"
)

// Runner manages the execution of compiled scenarios.
type Runner struct{}

// NewRunner creates a new test runner.
func NewRunner() *Runner {
	return &Runner{}
}

// Run executes a compiled scenario and returns a Job tracking the progress.
func (r *Runner) Run(ctx context.Context, actions []domain.Action, luaCode string, opts RunOptions) (*domain.Job, error) {
	logger.Debug("run start", "actions", len(actions), "headless", opts.Headless)
	job := domain.NewJob(domain.JobRunning)
	go func() {
		startTime := time.Now()
		job.Emit(domain.NewEvent(EventRunStarted, nil))
		w, h := opts.Browser.Resolved()
		s, err := browser.NewSession(ctx, browser.Options{
			Headless: opts.Headless,
			Width:    w,
			Height:   h,
		})
		if err != nil {
			job.SetStatus(domain.JobFailed)
			job.Emit(domain.NewEvent(EventRunFinished, err.Error()))
			return
		}
		defer func() {
			_ = s.Close()
		}()
		interpolated := interpolateVars(luaCode, opts.Vars)
		err = s.LoadScript(interpolated)
		if err != nil {
			job.SetStatus(domain.JobFailed)
			job.Emit(domain.NewEvent(EventRunFinished, err.Error()))
			return
		}
		for _, action := range actions {
			if !runWaitLoop(ctx, job) {
				break
			}
			job.Emit(domain.NewEvent(EventTaskStarted, map[string]string{
				"taskId": action.ID,
				"title":  action.Name,
			}))
			logger.Debug("run step start", "id", action.ID, "name", action.Name)
			err = s.ExecuteStep(action.ID)
			if err != nil {
				job.SetStatus(domain.JobFailed)
				job.Emit(domain.NewEvent(EventTaskFailed, map[string]string{
					"taskId": action.ID,
					"error":  err.Error(),
				}))
				break
			}
			job.Emit(domain.NewEvent(EventTaskFinished, map[string]string{
				"taskId": action.ID,
			}))
			screenshotBytes, err := s.Screenshot()
			if err == nil {
				screenshotBase64 := base64.StdEncoding.EncodeToString(screenshotBytes)
				job.Emit(domain.NewEvent(EventVisualCompareTriggered, map[string]any{
					"taskId":           action.ID,
					"screenshotBase64": screenshotBase64,
				}))
			}
			if opts.UpTo != "" && action.ID == opts.UpTo {
				break
			}
		}
		finalStatus := job.GetStatus()
		if finalStatus == domain.JobRunning {
			job.SetStatus(domain.JobCompleted)
			finalStatus = domain.JobCompleted
		}
		job.Emit(domain.NewEvent(EventRunFinished, map[string]any{
			"status":   string(finalStatus),
			"duration": time.Since(startTime).String(),
		}))
		// Close the listener channels so consumers ranging over Subscribe()
		// can break out. Without this the run loops forever waiting for
		// events that will never come.
		job.Close()
	}()
	return job, nil
}

func interpolateVars(code string, vars map[string]string) string {
	for k, v := range vars {
		placeholder := fmt.Sprintf("{{%s}}", k)
		code = strings.ReplaceAll(code, placeholder, v)
	}
	return code
}

func runWaitLoop(ctx context.Context, job *domain.Job) bool {
	for {
		select {
		case <-ctx.Done():
			job.SetStatus(domain.JobStopped)
			return false
		default:
		}
		status := job.GetStatus()
		if status == domain.JobStopped {
			return false
		}
		if status == domain.JobPaused {
			time.Sleep(50 * time.Millisecond)
			continue
		}
		break
	}
	return true
}
