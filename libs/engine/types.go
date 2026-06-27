package engine

import "time"

// CompileOptions configures the compilation execution.
type CompileOptions struct {
	SpecPath string
}

// CompileResult represents the compilation output.
type CompileResult struct {
	Success bool
	LuaCode string
}

// RunOptions configures the execution environment.
type RunOptions struct {
	Headless bool
	Vars     map[string]string
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
