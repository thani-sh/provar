package domain

import "time"

// Project represents the project configuration and directory context.
type Project struct {
	ProjectDir string
	BaseURL    string
}

// Step represents a single user-facing test action (e.g. Click, Navigate).
type Step struct {
	ID       string
	Action   string
	Selector string
}

// Test represents an end-to-end test definition composed of multiple steps.
type Test struct {
	ID    string
	Name  string
	Steps []Step
}

// JobStatus represents the state of a running job.
type JobStatus string

const (
	// JobIdle represents a job that has not started yet.
	JobIdle JobStatus = "idle"
	// JobRunning represents a job currently executing.
	JobRunning JobStatus = "running"
	// JobPaused represents a job whose execution is temporarily suspended.
	JobPaused JobStatus = "paused"
	// JobCompleted represents a job that successfully completed execution.
	JobCompleted JobStatus = "completed"
	// JobStopped represents a job that was manually terminated.
	JobStopped JobStatus = "stopped"
	// JobFailed represents a job that terminated with an error.
	JobFailed JobStatus = "failed"
)

// Event contains the status update and information related to a Job.
type Event struct {
	Status    JobStatus
	Message   string
	Timestamp time.Time
}

// Job represents an asynchronous execution task (e.g., compilation or running).
type Job struct {
	ID     string
	Status JobStatus
}

// Subscribe returns a channel of events related to the job from that point onwards.
func (j *Job) Subscribe() <-chan Event {
	// TODO: Implement event subscription channel.
	return nil
}

// Stop terminates the job execution.
func (j *Job) Stop() error {
	// TODO: Implement job stop operation.
	return nil
}

// Pause pauses the job execution.
func (j *Job) Pause() error {
	// TODO: Implement job pause operation.
	return nil
}

// Resume resumes a paused job execution.
func (j *Job) Resume() error {
	// TODO: Implement job resume operation.
	return nil
}

// LoadProject loads the project configuration from a given project directory path.
func LoadProject(projectDir string) (*Project, error) {
	// TODO: Implement project config loading.
	return nil, nil
}
