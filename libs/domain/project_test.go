package domain

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

const (
	testSubdir        = ".provar"
	testFilename      = "config.yml"
	testTestsDir      = ".provar/tests"
	testAuthDir       = ".provar/tests/auth"
	testYmlExtension  = ".test.yml"
	testKeyTimeout    = "timeout"
	testValTimeout    = "60"
	testKeyBaseURL    = "baseUrl"
	testValBaseURL    = "https://example.com"
	testKeyVerbose    = "verbose"
	testValVerbose    = "true"
	invalidYAML       = `key: "unclosed`
	testYMLLogin      = "- id: open_page\n  name: Open Page\n  info: Navigate to the login page\n- id: fill_credentials\n  name: Fill Credentials\n  info: Enter the email and password\n"
	testYMLLogout     = "- id: click_logout\n  name: Click Logout\n  info: Click the logout button\n"
	testLoginRelPath  = ".provar/tests/auth/login.test.yml"
	testLogoutRelPath = ".provar/tests/logout.test.yml"
	testEmptyRelPath  = ".provar/tests/empty.test.yml"
	testBrokenRelPath = ".provar/tests/broken.test.yml"
	testActionOpenID  = "open_page"
	testActionFillID  = "fill_credentials"
	testJobID         = "job-123"
	testPauseType     = "paused"
	testPauseData     = "Job paused by user"
	testResumeType    = "resumed"
	testStopType      = "stopped"
	testTimeout       = 100 * time.Millisecond
	testConfigContent = "variables:\n  baseUrl: https://example.com\n  timeout: 30\n  verbose: true\n"
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
		t.Fatalf("failed to write config.yml: %v", err)
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
		t.Error("expected error for missing config.yml, got nil")
	}
}

func TestLoadProject_InvalidYAML(t *testing.T) {
	tempDir := t.TempDir()
	provarDir := filepath.Join(tempDir, testSubdir)
	_ = os.MkdirAll(provarDir, dirPerm)
	_ = os.WriteFile(filepath.Join(provarDir, testFilename), []byte(invalidYAML), filePerm)
	_, err := LoadProject(tempDir)
	if err == nil {
		t.Error("expected error for invalid config YAML, got nil")
	}
}

func TestLoadProject_NoTestsDir(t *testing.T) {
	tempDir := t.TempDir()
	provarDir := filepath.Join(tempDir, testSubdir)
	if err := os.MkdirAll(provarDir, dirPerm); err != nil {
		t.Fatalf("failed to create .provar dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(provarDir, testFilename), []byte(testConfigContent), filePerm); err != nil {
		t.Fatalf("failed to write config.yml: %v", err)
	}
	project, err := LoadProject(tempDir)
	if err != nil {
		t.Fatalf("LoadProject returned error: %v", err)
	}
	if len(project.Files) != 0 {
		t.Errorf("expected Files to be empty when tests dir is missing, got %d entries", len(project.Files))
	}
}

func TestLoadProject_WithTestFiles(t *testing.T) {
	tempDir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(tempDir, testTestsDir), dirPerm); err != nil {
		t.Fatalf("failed to create tests dir: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(tempDir, testAuthDir), dirPerm); err != nil {
		t.Fatalf("failed to create auth dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tempDir, testLoginRelPath), []byte(testYMLLogin), filePerm); err != nil {
		t.Fatalf("failed to write login.test.yml: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tempDir, testLogoutRelPath), []byte(testYMLLogout), filePerm); err != nil {
		t.Fatalf("failed to write logout.test.yml: %v", err)
	}
	provarDir := filepath.Join(tempDir, testSubdir)
	if err := os.MkdirAll(provarDir, dirPerm); err != nil {
		t.Fatalf("failed to create .provar dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(provarDir, testFilename), []byte(testConfigContent), filePerm); err != nil {
		t.Fatalf("failed to write config.yml: %v", err)
	}
	project, err := LoadProject(tempDir)
	if err != nil {
		t.Fatalf("LoadProject returned error: %v", err)
	}
	if len(project.Files) != 2 {
		t.Fatalf("expected 2 files, got %d", len(project.Files))
	}
	if project.Files[0].Path != testLoginRelPath {
		t.Errorf("expected first file path %q, got %q", testLoginRelPath, project.Files[0].Path)
	}
	if project.Files[1].Path != testLogoutRelPath {
		t.Errorf("expected second file path %q, got %q", testLogoutRelPath, project.Files[1].Path)
	}
	loginActions, err := ParseFile(project.Path, project.Files[0].Path)
	if err != nil {
		t.Fatalf("ParseFile login returned error: %v", err)
	}
	if len(loginActions) != 2 {
		t.Fatalf("expected 2 actions in login file, got %d", len(loginActions))
	}
	if loginActions[0].ID != testActionOpenID {
		t.Errorf("expected first action ID %q, got %q", testActionOpenID, loginActions[0].ID)
	}
	if loginActions[1].ID != testActionFillID {
		t.Errorf("expected second action ID %q, got %q", testActionFillID, loginActions[1].ID)
	}
	logoutActions, err := ParseFile(project.Path, project.Files[1].Path)
	if err != nil {
		t.Fatalf("ParseFile logout returned error: %v", err)
	}
	if logoutActions[0].Info != "Click the logout button" {
		t.Errorf("expected logout action info %q, got %q", "Click the logout button", logoutActions[0].Info)
	}
}

func TestLoadProject_IgnoresNonTestFiles(t *testing.T) {
	tempDir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(tempDir, testTestsDir), dirPerm); err != nil {
		t.Fatalf("failed to create tests dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tempDir, testTestsDir, "notes.md"), []byte("# notes"), filePerm); err != nil {
		t.Fatalf("failed to write notes.md: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tempDir, testTestsDir, "login.test.yml"), []byte(testYMLLogin), filePerm); err != nil {
		t.Fatalf("failed to write login.test.yml: %v", err)
	}
	provarDir := filepath.Join(tempDir, testSubdir)
	if err := os.MkdirAll(provarDir, dirPerm); err != nil {
		t.Fatalf("failed to create .provar dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(provarDir, testFilename), []byte(testConfigContent), filePerm); err != nil {
		t.Fatalf("failed to write config.yml: %v", err)
	}
	project, err := LoadProject(tempDir)
	if err != nil {
		t.Fatalf("LoadProject returned error: %v", err)
	}
	if len(project.Files) != 1 {
		t.Errorf("expected 1 file (test.yml only), got %d", len(project.Files))
	}
}

func TestLoadProject_ToleratesMalformedTestFiles(t *testing.T) {
	tempDir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(tempDir, testTestsDir), dirPerm); err != nil {
		t.Fatalf("failed to create tests dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tempDir, testBrokenRelPath), []byte(invalidYAML), filePerm); err != nil {
		t.Fatalf("failed to write broken.test.yml: %v", err)
	}
	provarDir := filepath.Join(tempDir, testSubdir)
	if err := os.MkdirAll(provarDir, dirPerm); err != nil {
		t.Fatalf("failed to create .provar dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(provarDir, testFilename), []byte(testConfigContent), filePerm); err != nil {
		t.Fatalf("failed to write config.yml: %v", err)
	}
	project, err := LoadProject(tempDir)
	if err != nil {
		t.Fatalf("LoadProject should tolerate malformed test files, got error: %v", err)
	}
	if len(project.Files) != 1 {
		t.Fatalf("expected 1 file discovered despite malformed content, got %d", len(project.Files))
	}
}

func TestParseFile_Empty(t *testing.T) {
	tempDir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(tempDir, testTestsDir), dirPerm); err != nil {
		t.Fatalf("failed to create tests dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tempDir, testEmptyRelPath), []byte(""), filePerm); err != nil {
		t.Fatalf("failed to write empty.test.yml: %v", err)
	}
	actions, err := ParseFile(tempDir, testEmptyRelPath)
	if err != nil {
		t.Fatalf("ParseFile returned error: %v", err)
	}
	if len(actions) != 0 {
		t.Errorf("expected empty actions for empty file, got %d", len(actions))
	}
}

func TestParseFile_Malformed(t *testing.T) {
	tempDir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(tempDir, testTestsDir), dirPerm); err != nil {
		t.Fatalf("failed to create tests dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tempDir, testBrokenRelPath), []byte(invalidYAML), filePerm); err != nil {
		t.Fatalf("failed to write broken.test.yml: %v", err)
	}
	_, err := ParseFile(tempDir, testBrokenRelPath)
	if err == nil {
		t.Error("expected error for malformed YAML, got nil")
	}
}

func TestParseFile_Missing(t *testing.T) {
	tempDir := t.TempDir()
	_, err := ParseFile(tempDir, testBrokenRelPath)
	if err == nil {
		t.Error("expected error for missing file, got nil")
	}
}

func TestInitProject_Empty(t *testing.T) {
	tempDir := t.TempDir()
	target := filepath.Join(tempDir, "myproj")
	if err := InitProject(target, false, false); err != nil {
		t.Fatalf("InitProject returned error: %v", err)
	}
	if _, err := os.Stat(filepath.Join(target, ".provar", "config.yml")); err != nil {
		t.Errorf("expected config.yml to exist: %v", err)
	}
	if _, err := os.Stat(filepath.Join(target, ".provar", "tests")); err != nil {
		t.Errorf("expected tests dir to exist: %v", err)
	}
	if _, err := os.Stat(filepath.Join(target, ".provar", "tests", "login.test.yml")); err == nil {
		t.Error("expected no sample test file in empty mode")
	}
}

// TestInitProject_WritesGitignore locks in the .gitignore generation so a
// freshly-set-up project is Git-clean from the first commit. Without this,
// users routinely commit compiled .test.lua and current-run screenshots
// before noticing the noise.
func TestInitProject_WritesGitignore(t *testing.T) {
	tempDir := t.TempDir()
	target := filepath.Join(tempDir, "myproj")
	if err := InitProject(target, false, false); err != nil {
		t.Fatalf("InitProject returned error: %v", err)
	}
	data, err := os.ReadFile(filepath.Join(target, ".gitignore"))
	if err != nil {
		t.Fatalf("expected .gitignore to exist: %v", err)
	}
	body := string(data)
	// Compiled Lua must be ignored (regeneratable from .test.yml).
	if !strings.Contains(body, ".provar/tests/**/*.test.lua") {
		t.Errorf(".gitignore should ignore compiled .test.lua, got:\n%s", body)
	}
	// Current-run screenshots must be ignored.
	if !strings.Contains(body, ".provar/visual/") {
		t.Errorf(".gitignore should ignore .provar/visual/, got:\n%s", body)
	}
	// Baselines must NOT be ignored — they're the visual source of truth.
	for _, line := range strings.Split(body, "\n") {
		if strings.Contains(line, "baselines") && !strings.HasPrefix(strings.TrimSpace(line), "#") {
			t.Errorf(".gitignore should not ignore baselines, got line: %q", line)
		}
	}
}

// TestBrowserConfigResolvedDefaults locks in the default viewport. Without
// the default, the browser.NewSession call would skip SetViewport entirely,
// leaving the page at rod's default size — a regression for users who don't
// (yet) configure browser.width/height.
func TestBrowserConfigResolvedDefaults(t *testing.T) {
	cases := []struct {
		name         string
		in           BrowserConfig
		wantW, wantH int
	}{
		{"empty config", BrowserConfig{}, defaultBrowserWidth, defaultBrowserHeight},
		{"only width", BrowserConfig{Width: 800}, 800, defaultBrowserHeight},
		{"only height", BrowserConfig{Height: 600}, defaultBrowserWidth, 600},
		{"both set", BrowserConfig{Width: 1920, Height: 1080}, 1920, 1080},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			gotW, gotH := c.in.Resolved()
			if gotW != c.wantW || gotH != c.wantH {
				t.Errorf("Resolved() = (%d, %d), want (%d, %d)", gotW, gotH, c.wantW, c.wantH)
			}
		})
	}
}

// TestLoadProjectBrowserConfig verifies the project config's browser block
// flows through to Project.Browser with defaults applied. The whole
// pipeline (yaml parse → project field) is exercised here; NewSession-side
// viewport application is verified end-to-end via the run smoke test.
func TestLoadProjectBrowserConfig(t *testing.T) {
	tempDir := t.TempDir()
	target := filepath.Join(tempDir, "myproj")
	if err := os.MkdirAll(filepath.Join(target, configSubdir), dirPerm); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	cfg := []byte("browser:\n  width: 800\n  height: 600\n")
	if err := os.WriteFile(filepath.Join(target, configSubdir, configFilename), cfg, filePerm); err != nil {
		t.Fatalf("write config: %v", err)
	}
	p, err := LoadProject(target)
	if err != nil {
		t.Fatalf("LoadProject: %v", err)
	}
	if p.Browser.Width != 800 || p.Browser.Height != 600 {
		t.Errorf("Browser = %+v, want 800x600", p.Browser)
	}
}

// TestLoadProjectBrowserDefaults confirms LoadProject fills in defaults when
// the config has no browser block at all (backward-compat for existing
// projects with just `variables:`).
func TestLoadProjectBrowserDefaults(t *testing.T) {
	tempDir := t.TempDir()
	target := filepath.Join(tempDir, "myproj")
	if err := os.MkdirAll(filepath.Join(target, configSubdir), dirPerm); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	cfg := []byte("variables:\n  baseUrl: http://localhost:3000\n")
	if err := os.WriteFile(filepath.Join(target, configSubdir, configFilename), cfg, filePerm); err != nil {
		t.Fatalf("write config: %v", err)
	}
	p, err := LoadProject(target)
	if err != nil {
		t.Fatalf("LoadProject: %v", err)
	}
	if p.Browser.Width != defaultBrowserWidth || p.Browser.Height != defaultBrowserHeight {
		t.Errorf("Browser defaults = %+v, want %dx%d", p.Browser, defaultBrowserWidth, defaultBrowserHeight)
	}
}

func TestInitProject_Sample(t *testing.T) {
	tempDir := t.TempDir()
	target := filepath.Join(tempDir, "myproj")
	if err := InitProject(target, true, false); err != nil {
		t.Fatalf("InitProject returned error: %v", err)
	}
	configData, err := os.ReadFile(filepath.Join(target, ".provar", "config.yml"))
	if err != nil {
		t.Fatalf("expected config.yml to exist: %v", err)
	}
	if string(configData) != sampleConfigYML {
		t.Errorf("expected sample config, got %q", string(configData))
	}
	loginData, err := os.ReadFile(filepath.Join(target, ".provar", "tests", "login.test.yml"))
	if err != nil {
		t.Fatalf("expected login.test.yml to exist: %v", err)
	}
	if string(loginData) != sampleLoginYML {
		t.Errorf("expected sample login test, got %q", string(loginData))
	}
}

func TestInitProject_ExistingNoForce(t *testing.T) {
	tempDir := t.TempDir()
	target := filepath.Join(tempDir, "myproj")
	if err := os.MkdirAll(target, dirPerm); err != nil {
		t.Fatalf("setup: %v", err)
	}
	if err := InitProject(target, false, false); err == nil {
		t.Error("expected error when target exists without force, got nil")
	}
}

func TestInitProject_ExistingWithForce(t *testing.T) {
	tempDir := t.TempDir()
	target := filepath.Join(tempDir, "myproj")
	if err := os.MkdirAll(target, dirPerm); err != nil {
		t.Fatalf("setup: %v", err)
	}
	if err := os.WriteFile(filepath.Join(target, "stale.txt"), []byte("stale"), filePerm); err != nil {
		t.Fatalf("setup: %v", err)
	}
	if err := InitProject(target, false, true); err != nil {
		t.Fatalf("InitProject returned error: %v", err)
	}
	if _, err := os.Stat(filepath.Join(target, "stale.txt")); err == nil {
		t.Error("expected stale file to be removed by force")
	}
	if _, err := os.Stat(filepath.Join(target, ".provar", "config.yml")); err != nil {
		t.Errorf("expected config.yml after force overwrite: %v", err)
	}
}

func TestInitProject_RejectsDangerousTargets(t *testing.T) {
	cases := []string{"", "/", ".", ".."}
	for _, target := range cases {
		if err := InitProject(target, false, true); err == nil {
			t.Errorf("expected error for dangerous target %q, got nil", target)
		}
	}
}

func TestInitProject_CreatesParentDirs(t *testing.T) {
	tempDir := t.TempDir()
	target := filepath.Join(tempDir, "deeply", "nested", "myproj")
	if err := InitProject(target, false, false); err != nil {
		t.Fatalf("InitProject returned error: %v", err)
	}
	if _, err := os.Stat(filepath.Join(target, ".provar", "config.yml")); err != nil {
		t.Errorf("expected config.yml under nested target: %v", err)
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
