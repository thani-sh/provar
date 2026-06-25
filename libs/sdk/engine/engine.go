package engine

import "github.com/thani-sh/provar/libs/sdk/domain"

// Compiler handles the compilation of tests into runnable instructions.
type Compiler struct{}

// Compile compiles a test definition and returns a Job tracking the progress.
func (c *Compiler) Compile(t *domain.Test) (*domain.Job, error) {
	// TODO: Implement test compilation logic.
	return nil, nil
}

// Runner manages the execution of compiled tests.
type Runner struct{}

// Run executes a compiled test and returns a Job tracking the progress.
func (r *Runner) Run(t *domain.Test) (*domain.Job, error) {
	// TODO: Implement test running/execution logic.
	return nil, nil
}
