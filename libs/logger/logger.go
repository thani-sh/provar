// Package logger is a minimal level-gated logger for provar Go libraries. The
// level is read once at startup from the LOG_LEVEL environment variable
// (case-insensitive: "debug", "info", "warn"/"warning", "error"/"err"). Unknown
// or empty values fall back to the default LevelInfo. Output goes to os.Stderr
// so it doesn't share a stream with structured CLI output.
//
// Usage:
//
//	logger.Info("compiled", "file", "login.test.lua")
//	logger.Debug("tool call", "tool", "navigate", "url", "{{baseUrl}}/login")
//
// Tests can redirect output and override the level via logger.New(...).
package logger

import (
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"time"
)

// Level is the severity of a log message.
type Level int

// Severity levels, ordered from least to most severe. A logger drops messages
// whose level is lower than its own.
const (
	// LevelDebug is for verbose trace info, off by default.
	LevelDebug Level = iota
	// LevelInfo is the default level. Significant lifecycle events.
	LevelInfo
	// LevelWarn is for recoverable anomalies.
	LevelWarn
	// LevelError is for operation-failing conditions.
	LevelError
)

// String returns the canonical lowercase name of l.
func (l Level) String() string {
	switch l {
	case LevelDebug:
		return "debug"
	case LevelInfo:
		return "info"
	case LevelWarn:
		return "warn"
	case LevelError:
		return "error"
	}
	return "info"
}

// ParseLevel maps a string name to a Level. The match is case-insensitive and
// whitespace-tolerant. Unknown or empty input returns LevelInfo so a typo in the
// env var never accidentally elevates verbosity.
func ParseLevel(s string) Level {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "debug":
		return LevelDebug
	case "warn", "warning":
		return LevelWarn
	case "error", "err":
		return LevelError
	case "info", "":
		return LevelInfo
	}
	return LevelInfo
}

// Logger writes level-gated, timestamped messages to its output. Each Logger is
// safe for concurrent use.
type Logger struct {
	mu    sync.Mutex
	level Level
	out   io.Writer
}

// New builds a Logger at the given level writing to w. A nil w falls back to
// os.Stderr. Use this from tests to capture or silence output.
func New(level Level, w io.Writer) *Logger {
	if w == nil {
		w = os.Stderr
	}
	return &Logger{level: level, out: w}
}

var defaultLogger = New(ParseLevel(os.Getenv("LOG_LEVEL")), os.Stderr)

// Default returns the process-wide Logger. Its level was set from LOG_LEVEL at
// startup; use SetLevel to change it at runtime.
func Default() *Logger { return defaultLogger }

// Level returns the current minimum severity.
func (l *Logger) Level() Level {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.level
}

// SetLevel changes the minimum severity. Subsequent calls below the new level
// are dropped.
func (l *Logger) SetLevel(level Level) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.level = level
}

// Debug logs at debug level. Key/value pairs (kv) are rendered as key=value
// after the message. An uneven trailing entry in kv is dropped.
func (l *Logger) Debug(msg string, kv ...any) { l.log(LevelDebug, msg, kv) }

// Info logs at info level.
func (l *Logger) Info(msg string, kv ...any) { l.log(LevelInfo, msg, kv) }

// Warn logs at warn level.
func (l *Logger) Warn(msg string, kv ...any) { l.log(LevelWarn, msg, kv) }

// Error logs at error level.
func (l *Logger) Error(msg string, kv ...any) { l.log(LevelError, msg, kv) }

func (l *Logger) log(level Level, msg string, kv []any) {
	l.mu.Lock()
	curr := l.level
	out := l.out
	l.mu.Unlock()
	if level < curr {
		return
	}
	var b strings.Builder
	b.Grow(len(msg) + 32 + len(kv)*8)
	b.WriteString(time.Now().Format(time.RFC3339))
	b.WriteByte(' ')
	b.WriteString(strings.ToUpper(level.String()))
	b.WriteByte(' ')
	b.WriteString(msg)
	for i := 0; i+1 < len(kv); i += 2 {
		fmt.Fprintf(&b, " %s=%v", kv[i], kv[i+1])
	}
	b.WriteByte('\n')
	_, _ = io.WriteString(out, b.String())
}

// Package-level shortcuts for ergonomics. Call sites use logger.Info(...) and
// friends without reaching into Default() at every call site.

// Info logs at info level on the default logger.
func Info(msg string, kv ...any) { Default().Info(msg, kv...) }

// Debug logs at debug level on the default logger.
func Debug(msg string, kv ...any) { Default().Debug(msg, kv...) }

// Warn logs at warn level on the default logger.
func Warn(msg string, kv ...any) { Default().Warn(msg, kv...) }

// Error logs at error level on the default logger.
func Error(msg string, kv ...any) { Default().Error(msg, kv...) }

// SetLevel changes the default logger's level.
func SetLevel(level Level) { Default().SetLevel(level) }
