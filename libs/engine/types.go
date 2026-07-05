package engine

import (
	"time"

	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine/browser"
)

// CompileOptions configures the compilation execution.
type CompileOptions struct {
	SpecPath string
	Vars     map[string]string
	Browser  *browser.Session
}

// RunOptions configures the execution environment.
type RunOptions struct {
	Headless bool
	Vars     map[string]string
	UpTo     string
	Browser  domain.BrowserConfig // effective (defaults applied) viewport — passed to browser.NewSession
}

// RunResult represents the execution results.
type RunResult struct {
	Success  bool
	Duration time.Duration
	Errors   []TaskError
}

// TaskError represents an error associated with a specific task execution.
type TaskError struct {
	TaskID string
	Err    error
}
