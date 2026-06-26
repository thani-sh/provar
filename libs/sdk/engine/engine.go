package engine

import "github.com/thani-sh/provar/libs/sdk/domain"

// Compiler handles the compilation of scenarios into runnable instructions.
type Compiler struct{}

// Compile compiles a scenario definition and returns a Job tracking the progress.
func (c *Compiler) Compile(s domain.Scenario) (*domain.Job, error) {
	// TODO: Implement scenario compilation logic.
	return nil, nil
}

// Runner manages the execution of compiled scenarios.
type Runner struct{}

// Run executes a compiled scenario and returns a Job tracking the progress.
func (r *Runner) Run(s domain.Scenario) (*domain.Job, error) {
	// TODO: Implement scenario running/execution logic.
	return nil, nil
}
