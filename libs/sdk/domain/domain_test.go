package domain

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
)

const (
	testSubdir        = ".provar"
	testFilename      = "config.json"
	dirPerm           = 0755
	filePerm          = 0644
	testKeyTimeout    = "timeout"
	testValTimeout    = "60"
	testKeyBaseURL    = "baseUrl"
	testValBaseURL    = "https://example.com"
	testKeyVerbose    = "verbose"
	testValVerbose    = "true"
	invalidJSON       = `{invalid}`
	testJobID         = "job-123"
	testPauseType     = "paused"
	testPauseData     = "Job paused by user"
	testResumeType    = "resumed"
	testStopType      = "stopped"
	testTimeout       = 100 * time.Millisecond
	testConfigContent = `{
		"variables": {
			"baseUrl": "https://example.com",
			"timeout": 30,
			"verbose": true
		}
	}`
)

func TestLoadProject(t *testing.T) {
	tempDir := t.TempDir()
	provarDir := filepath.Join(tempDir, testSubdir)
	err := os.MkdirAll(provarDir, dirPerm)
	if err != nil {
		t.Fatalf("failed to create .provar dir: %v", err)
	}
	err = os.WriteFile(filepath.Join(provarDir, testFilename), []byte(testConfigContent), filePerm)
	if err != nil {
		t.Fatalf("failed to write config.json: %v", err)
	}
	os.Setenv(testKeyTimeout, testValTimeout)
	defer os.Unsetenv(testKeyTimeout)
	project, err := LoadProject(tempDir)
	if err != nil {
		t.Fatalf("LoadProject returned error: %v", err)
	}
	if project.Path != tempDir {
		t.Errorf("expected Path to be %q, got %q", tempDir, project.Path)
	}
	if project.Vars[testKeyBaseURL] != testValBaseURL {
		t.Errorf("expected baseUrl to be %q, got %q", testValBaseURL, project.Vars[testKeyBaseURL])
	}
	if project.Vars[testKeyTimeout] != testValTimeout {
		t.Errorf("expected timeout to be overridden by env variable to %q, got %q", testValTimeout, project.Vars[testKeyTimeout])
	}
	if project.Vars[testKeyVerbose] != testValVerbose {
		t.Errorf("expected verbose to be coerced to %q, got %q", testValVerbose, project.Vars[testKeyVerbose])
	}
}

func TestLoadProject_MissingConfig(t *testing.T) {
	tempDir := t.TempDir()
	_, err := LoadProject(tempDir)
	if err == nil {
		t.Error("expected error for missing config.json, got nil")
	}
}

func TestLoadProject_InvalidJSON(t *testing.T) {
	tempDir := t.TempDir()
	provarDir := filepath.Join(tempDir, testSubdir)
	_ = os.MkdirAll(provarDir, dirPerm)
	_ = os.WriteFile(filepath.Join(provarDir, testFilename), []byte(invalidJSON), filePerm)
	_, err := LoadProject(tempDir)
	if err == nil {
		t.Error("expected error for invalid config JSON, got nil")
	}
}

func TestJob_Lifecycle(t *testing.T) {
	job := NewJob(testJobID, JobIdle)
	if job.ID != testJobID {
		t.Errorf("expected ID to be job-123, got %q", job.ID)
	}
	if job.Status != JobIdle {
		t.Errorf("expected Status to be JobIdle, got %q", job.Status)
	}
	ch := job.Subscribe()
	job.Status = JobRunning
	err := job.Pause()
	if err != nil {
		t.Errorf("Pause returned error: %v", err)
	}
	if job.Status != JobPaused {
		t.Errorf("expected status to be JobPaused, got %q", job.Status)
	}
	select {
	case ev := <-ch:
		if _, err := uuid.Parse(ev.ID); err != nil {
			t.Errorf("expected event ID to be a valid UUID, got %q (error: %v)", ev.ID, err)
		}
		if ev.Type != testPauseType {
			t.Errorf("expected event Type to be paused, got %q", ev.Type)
		}
		if ev.Data != testPauseData {
			t.Errorf("expected event Data to be 'Job paused by user', got %v", ev.Data)
		}
	case <-time.After(testTimeout):
		t.Error("timeout waiting for Pause event")
	}
	err = job.Resume()
	if err != nil {
		t.Errorf("Resume returned error: %v", err)
	}
	if job.Status != JobRunning {
		t.Errorf("expected status to be JobRunning, got %q", job.Status)
	}
	select {
	case ev := <-ch:
		if _, err := uuid.Parse(ev.ID); err != nil {
			t.Errorf("expected event ID to be a valid UUID, got %q (error: %v)", ev.ID, err)
		}
		if ev.Type != testResumeType {
			t.Errorf("expected event Type to be resumed, got %q", ev.Type)
		}
	case <-time.After(testTimeout):
		t.Error("timeout waiting for Resume event")
	}
	err = job.Stop()
	if err != nil {
		t.Errorf("Stop returned error: %v", err)
	}
	if job.Status != JobStopped {
		t.Errorf("expected status to be JobStopped, got %q", job.Status)
	}
	select {
	case ev := <-ch:
		if _, err := uuid.Parse(ev.ID); err != nil {
			t.Errorf("expected event ID to be a valid UUID, got %q (error: %v)", ev.ID, err)
		}
		if ev.Type != testStopType {
			t.Errorf("expected event Type to be stopped, got %q", ev.Type)
		}
	case <-time.After(testTimeout):
		t.Error("timeout waiting for Stop event")
	}
}
