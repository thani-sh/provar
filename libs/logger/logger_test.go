package logger

import (
	"bytes"
	"io"
	"strings"
	"testing"
)

func TestParseLevel(t *testing.T) {
	cases := []struct {
		in   string
		want Level
	}{
		{"", LevelInfo},
		{"info", LevelInfo},
		{"INFO", LevelInfo},
		{"  info  ", LevelInfo},
		{"debug", LevelDebug},
		{"DEBUG", LevelDebug},
		{"warn", LevelWarn},
		{"warning", LevelWarn},
		{"WARN", LevelWarn},
		{"error", LevelError},
		{"err", LevelError},
		{"garbage", LevelInfo},
	}
	for _, c := range cases {
		if got := ParseLevel(c.in); got != c.want {
			t.Errorf("ParseLevel(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestLevelString(t *testing.T) {
	for _, lv := range []Level{LevelDebug, LevelInfo, LevelWarn, LevelError} {
		if lv.String() == "" {
			t.Errorf("Level %d has empty String()", int(lv))
		}
	}
	if got := Level(999).String(); got != "info" {
		t.Errorf("unknown Level .String() = %q, want %q", got, "info")
	}
}

func TestLogFiltering(t *testing.T) {
	var buf bytes.Buffer
	l := New(LevelInfo, &buf)
	l.Debug("hidden-debug")
	l.Info("shown-info")
	l.Warn("shown-warn")
	out := buf.String()
	if strings.Contains(out, "hidden-debug") {
		t.Errorf("debug should be filtered at info level, got: %s", out)
	}
	if !strings.Contains(out, "INFO shown-info") {
		t.Errorf("expected 'INFO shown-info' in output, got: %s", out)
	}
	if !strings.Contains(out, "WARN shown-warn") {
		t.Errorf("expected 'WARN shown-warn' in output, got: %s", out)
	}
}

func TestSetLevel(t *testing.T) {
	var buf bytes.Buffer
	l := New(LevelInfo, &buf)
	l.Info("before")
	l.SetLevel(LevelError)
	l.Info("filtered-after")
	l.Error("kept")
	out := buf.String()
	if !strings.Contains(out, "before") {
		t.Errorf("expected 'before' in output: %s", out)
	}
	if strings.Contains(out, "filtered-after") {
		t.Errorf("info should be filtered after SetLevel(error): %s", out)
	}
	if !strings.Contains(out, "ERROR kept") {
		t.Errorf("expected 'ERROR kept' in output: %s", out)
	}
}

func TestLogKeyValues(t *testing.T) {
	var buf bytes.Buffer
	l := New(LevelDebug, &buf)
	l.Info("step", "id", "open_login_page", "tool", "navigate")
	out := buf.String()
	for _, want := range []string{"step", "id=open_login_page", "tool=navigate"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in output: %s", want, out)
		}
	}
	// Uneven trailing arg is dropped, not rendered as key= with empty value.
	l.Info("odd", "a", 1, "b")
	out = buf.String()
	if strings.Contains(out, "b= ") || strings.HasSuffix(strings.TrimRight(out, "\n"), " b=") {
		t.Errorf("trailing odd key should be dropped, got: %s", out)
	}
}

func TestNewNilWriter(t *testing.T) {
	l := New(LevelInfo, nil)
	if l.out == nil {
		t.Error("New(nil writer) should fall back to os.Stderr, got nil")
	}
}

// TestPackageLevelShortcuts guards the package-level Info/Debug/etc helpers
// against future drift away from the default logger.
func TestPackageLevelShortcuts(t *testing.T) {
	prev := Default().Level()
	prevW := saveAndSwapOutput()
	t.Cleanup(func() {
		Default().SetLevel(prev)
		restoreOutput(prevW)
	})
	var buf bytes.Buffer
	restoreOutput(&buf)
	Default().SetLevel(LevelDebug)
	Info("shortcut-info", "k", "v")
	out := buf.String()
	if !strings.Contains(out, "INFO shortcut-info") {
		t.Errorf("package Info did not write to default logger: %s", out)
	}
	if !strings.Contains(out, "k=v") {
		t.Errorf("package Info did not include kv pair: %s", out)
	}
}

// saveAndSwapOutput swaps Default()'s output to a fresh buffer and returns the
// previous writer so the caller can restore it. Used by tests above to inspect
// what the default logger emits without disturbing parallel tests.
func saveAndSwapOutput() io.Writer {
	defaultLogger.mu.Lock()
	prev := defaultLogger.out
	defaultLogger.out = &bytes.Buffer{}
	defaultLogger.mu.Unlock()
	return prev
}

func restoreOutput(w io.Writer) {
	defaultLogger.mu.Lock()
	defaultLogger.out = w
	defaultLogger.mu.Unlock()
}
