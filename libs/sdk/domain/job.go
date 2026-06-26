package domain

import (
	"sync"
)

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
	ID   string
	Type string
	Data any
}

// Job represents an asynchronous execution task (e.g., compilation or running).
type Job struct {
	ID        string
	Status    JobStatus
	mu        sync.RWMutex
	listeners []chan Event
}

// NewJob initializes a new Job with the given ID and Status.
func NewJob(id string, status JobStatus) *Job {
	return &Job{
		ID:     id,
		Status: status,
	}
}

// Subscribe returns a channel of events related to the job from that point onwards.
func (j *Job) Subscribe() <-chan Event {
	j.mu.Lock()
	defer j.mu.Unlock()
	ch := make(chan Event, 10)
	j.listeners = append(j.listeners, ch)
	return ch
}

// Stop terminates the job execution.
func (j *Job) Stop() error {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.Status == JobRunning || j.Status == JobPaused || j.Status == JobIdle {
		j.Status = JobStopped
		j.emit(Event{
			ID:   j.ID + "-stop",
			Type: "stopped",
			Data: "Job stopped by user",
		})
	}
	return nil
}

// Pause pauses the job execution.
func (j *Job) Pause() error {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.Status == JobRunning {
		j.Status = JobPaused
		j.emit(Event{
			ID:   j.ID + "-pause",
			Type: "paused",
			Data: "Job paused by user",
		})
	}
	return nil
}

// Resume resumes a paused job execution.
func (j *Job) Resume() error {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.Status == JobPaused {
		j.Status = JobRunning
		j.emit(Event{
			ID:   j.ID + "-resume",
			Type: "resumed",
			Data: "Job resumed by user",
		})
	}
	return nil
}

// emit sends an event to all subscribed listeners.
// Assumes j.mu is locked.
func (j *Job) emit(e Event) {
	for _, listener := range j.listeners {
		select {
		case listener <- e:
		default:
			// Non-blocking write to prevent stalling if listener channel is full
		}
	}
}
