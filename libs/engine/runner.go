package engine

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine/browser"
	"github.com/thani-sh/provar/libs/logger"
)

const (
	eventRunStarted             = "run-started"
	eventTaskStarted            = "task-started"
	eventTaskFinished           = "task-finished"
	eventTaskFailed             = "task-failed"
	eventVisualCompareTriggered = "visual-comparison-triggered"
	eventRunFinished            = "run-finished"
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
	job := domain.NewJob(uuid.New().String(), domain.JobRunning)
	go func() {
		startTime := time.Now()
		job.Emit(domain.Event{
			ID:   uuid.New().String(),
			Type: eventRunStarted,
		})
		s, err := browser.NewSession(ctx, opts.Headless)
		if err != nil {
			job.SetStatus(domain.JobFailed)
			job.Emit(domain.Event{
				ID:   uuid.New().String(),
				Type: eventRunFinished,
				Data: err.Error(),
			})
			return
		}
		defer func() {
			_ = s.Close()
		}()
		interpolated := interpolateVars(luaCode, opts.Vars)
		err = s.LoadScript(interpolated)
		if err != nil {
			job.SetStatus(domain.JobFailed)
			job.Emit(domain.Event{
				ID:   uuid.New().String(),
				Type: eventRunFinished,
				Data: err.Error(),
			})
			return
		}
		for _, action := range actions {
			if !runWaitLoop(ctx, job) {
				break
			}
			job.Emit(domain.Event{
				ID:   uuid.New().String(),
				Type: eventTaskStarted,
				Data: map[string]string{
					"taskId": action.ID,
					"title":  action.Name,
				},
			})
			logger.Debug("run step start", "id", action.ID, "name", action.Name)
			err = s.ExecuteStep(action.ID)
			if err != nil {
				job.SetStatus(domain.JobFailed)
				job.Emit(domain.Event{
					ID:   uuid.New().String(),
					Type: eventTaskFailed,
					Data: map[string]string{
						"taskId": action.ID,
						"error":  err.Error(),
					},
				})
				break
			}
			job.Emit(domain.Event{
				ID:   uuid.New().String(),
				Type: eventTaskFinished,
				Data: map[string]string{
					"taskId": action.ID,
				},
			})
			screenshotBytes, err := s.Screenshot()
			if err == nil {
				screenshotBase64 := base64.StdEncoding.EncodeToString(screenshotBytes)
				job.Emit(domain.Event{
					ID:   uuid.New().String(),
					Type: eventVisualCompareTriggered,
					Data: map[string]any{
						"taskId":           action.ID,
						"screenshotBase64": screenshotBase64,
					},
				})
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
		job.Emit(domain.Event{
			ID:   uuid.New().String(),
			Type: eventRunFinished,
			Data: map[string]any{
				"status":   string(finalStatus),
				"duration": time.Since(startTime).String(),
			},
		})
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
