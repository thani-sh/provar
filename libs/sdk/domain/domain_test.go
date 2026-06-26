package domain

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadProject(t *testing.T) {
	tempDir := t.TempDir()
	provarDir := filepath.Join(tempDir, ".provar")
	err := os.MkdirAll(provarDir, 0755)
	if err != nil {
		t.Fatalf("failed to create .provar dir: %v", err)
	}
	configData := `{
		"variables": {
			"baseUrl": "https://example.com",
			"timeout": 30,
			"verbose": true
		}
	}`
	err = os.WriteFile(filepath.Join(provarDir, "config.json"), []byte(configData), 0644)
	if err != nil {
		t.Fatalf("failed to write config.json: %v", err)
	}
	os.Setenv("timeout", "60")
	defer os.Unsetenv("timeout")
	project, err := LoadProject(tempDir)
	if err != nil {
		t.Fatalf("LoadProject returned error: %v", err)
	}
	if project.Path != tempDir {
		t.Errorf("expected Path to be %q, got %q", tempDir, project.Path)
	}
	if project.Vars["baseUrl"] != "https://example.com" {
		t.Errorf("expected baseUrl to be %q, got %q", "https://example.com", project.Vars["baseUrl"])
	}
	if project.Vars["timeout"] != "60" {
		t.Errorf("expected timeout to be overridden by env variable to %q, got %q", "60", project.Vars["timeout"])
	}
	if project.Vars["verbose"] != "true" {
		t.Errorf("expected verbose to be coerced to %q, got %q", "true", project.Vars["verbose"])
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
	provarDir := filepath.Join(tempDir, ".provar")
	_ = os.MkdirAll(provarDir, 0755)
	_ = os.WriteFile(filepath.Join(provarDir, "config.json"), []byte(`{invalid}`), 0644)
	_, err := LoadProject(tempDir)
	if err == nil {
		t.Error("expected error for invalid config JSON, got nil")
	}
}

func TestJob_Lifecycle(t *testing.T) {
	job := NewJob("job-123", JobIdle)
	if job.ID != "job-123" {
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
		if ev.ID != "job-123-pause" {
			t.Errorf("expected event ID to be job-123-pause, got %q", ev.ID)
		}
		if ev.Type != "paused" {
			t.Errorf("expected event Type to be paused, got %q", ev.Type)
		}
		if ev.Data != "Job paused by user" {
			t.Errorf("expected event Data to be 'Job paused by user', got %v", ev.Data)
		}
	case <-time.After(100 * time.Millisecond):
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
		if ev.ID != "job-123-resume" {
			t.Errorf("expected event ID to be job-123-resume, got %q", ev.ID)
		}
		if ev.Type != "resumed" {
			t.Errorf("expected event Type to be resumed, got %q", ev.Type)
		}
	case <-time.After(100 * time.Millisecond):
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
		if ev.ID != "job-123-stop" {
			t.Errorf("expected event ID to be job-123-stop, got %q", ev.ID)
		}
		if ev.Type != "stopped" {
			t.Errorf("expected event Type to be stopped, got %q", ev.Type)
		}
	case <-time.After(100 * time.Millisecond):
		t.Error("timeout waiting for Stop event")
	}
}
