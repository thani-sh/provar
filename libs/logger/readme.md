# @provar/logger

Minimal level-gated logger for provar Go libraries.

The default Logger reads its level from the `LOG_LEVEL` environment variable once
at startup. Default level is `info`. Case-insensitive names: `debug`, `info`,
`warn`/`warning`, `error`/`err`. Unknown or empty values fall back to `info`.
Output goes to `os.Stderr` so it doesn't share a stream with structured CLI
output written to stdout.

## Usage

```go
import "github.com/thani-sh/provar/libs/logger"

logger.Info("compiled", "file", "login.test.lua")
logger.Debug("tool call", "tool", "navigate", "url", url)
```

For isolated loggers (tests, per-component sinks):

```go
var buf bytes.Buffer
l := logger.New(logger.LevelDebug, &buf)
l.Info("captured", "k", "v")
```
