package domain

import (
	"fmt"
	"sync"

	"github.com/thani-sh/suuid-go"
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

const (
	eventStoppedType   = "stopped"
	eventStopMsg       = "Job stopped by user"
	eventPausedType    = "paused"
	eventPauseMsg      = "Job paused by user"
	eventResumedType   = "resumed"
	eventResumeMsg     = "Job resumed by user"
	eventChannelBuffer = 10
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

// NewJob initializes a new Job in the given Status. The ID is generated
// internally — callers don't inject one.
func NewJob(status JobStatus) *Job {
	return &Job{
		ID:     newID(),
		Status: status,
	}
}

// NewEvent builds an Event with a freshly-generated ID. Used at every emit
// site so call sites read as `job.Emit(NewEvent("started", nil))` instead of
// four-line struct literals.
func NewEvent(typ string, data any) Event {
	return Event{
		ID:   newID(),
		Type: typ,
		Data: data,
	}
}

// newID generates a short base62 ID. Panics on failure — entropy exhaustion
// is unrecoverable for an event stream that depends on unique IDs.
func newID() string {
	id, err := suuid.V4()
	if err != nil {
		panic(fmt.Sprintf("generate id: %v", err))
	}
	return id
}

// GetStatus returns the current status of the job thread-safely.
func (j *Job) GetStatus() JobStatus {
	j.mu.RLock()
	defer j.mu.RUnlock()
	return j.Status
}

// SetStatus updates the status of the job thread-safely.
func (j *Job) SetStatus(status JobStatus) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Status = status
}

// Subscribe returns a channel of events related to the job from that point onwards.
func (j *Job) Subscribe() <-chan Event {
	j.mu.Lock()
	defer j.mu.Unlock()
	ch := make(chan Event, eventChannelBuffer)
	j.listeners = append(j.listeners, ch)
	return ch
}

// Stop terminates the job execution.
func (j *Job) Stop() error {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.Status != JobRunning && j.Status != JobPaused && j.Status != JobIdle {
		return nil
	}
	j.Status = JobStopped
	j.emit(NewEvent(eventStoppedType, eventStopMsg))
	return nil
}

// Pause pauses the job execution.
func (j *Job) Pause() error {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.Status != JobRunning {
		return nil
	}
	j.Status = JobPaused
	j.emit(NewEvent(eventPausedType, eventPauseMsg))
	return nil
}

// Resume resumes a paused job execution.
func (j *Job) Resume() error {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.Status != JobPaused {
		return nil
	}
	j.Status = JobRunning
	j.emit(NewEvent(eventResumedType, eventResumeMsg))
	return nil
}

// emit sends an event to all subscribed listeners.
// Assumes j.mu is locked.
func (j *Job) emit(e Event) {
	for _, listener := range j.listeners {
		select {
		case listener <- e:
		default:
		}
	}
}

// Emit sends an event to all subscribed listeners thread-safely.
func (j *Job) Emit(e Event) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.emit(e)
}

// Close terminates all listener channels so consumers ranging over
// Subscribe() can break out. Safe to call multiple times. After Close the
// job is effectively dead — emitting more events is a no-op for the
// listeners that already saw the close.
func (j *Job) Close() {
	j.mu.Lock()
	defer j.mu.Unlock()
	for _, ch := range j.listeners {
		close(ch)
	}
	j.listeners = nil
}
