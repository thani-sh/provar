package handlers

import (
	"context"
	"errors"
	"strings"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/logger"
)

// closer is anything with a Close() error method (browser.Session today,
// possibly other resources later). Pass via an interface to keep forwardJob
// reusable across compile and run.
type closer interface {
	Close() error
}

// engineToWireType maps engine event type constants to their wire-side
// suffixes. The namespace prefix ("project/compile" or "project/run") is
// prepended by wireTypeFor. Explicit per-type entries because the engine
// uses an inconsistent naming scheme (some types have a "compile-" / "run-"
// prefix, others don't), and one of them ("visual-comparison-triggered")
// loses the "comparison" segment on the wire side. A pure dash-to-slash
// conversion produces duplicate prefixes like "v1/project/compile/compile/
// started" — don't try to be clever here, the table is the source of truth.
var engineToWireType = map[string]string{
	"compile-started":             "started",
	"compile-finished":            "finished",
	"action-started":              "action-started",
	"action-finished":             "action-finished",
	"action-failed":               "action-failed",
	"run-started":                 "started",
	"run-finished":                "finished",
	"visual-comparison-triggered": "visual-triggered",
}

// wireTypeFor builds the full wire type from the namespace and engine event
// type. Unknown engine types fall back to a dash-to-slash conversion — keeps
// new engine events visible to clients even before this map is updated.
func wireTypeFor(namespace, engineType string) string {
	if suffix, ok := engineToWireType[engineType]; ok {
		return "v1/" + namespace + "/" + suffix
	}
	return "v1/" + namespace + "/" + strings.ReplaceAll(engineType, "-", "/")
}

// forwardJob ranges over a Job's event stream, rewrites the engine event type
// into the wire namespace (v1/project/compile/* or v1/project/run/*), and
// writes each event to the connection. When the stream closes (engine has
// emitted its terminal event and called Job.Close), the goroutine cleans up
// the browser and forgets the job from the registry.
//
// If ctx is cancelled (client disconnected), forwardJob stops forwarding and
// cleans up. The engine job itself isn't stopped — it runs to completion
// because its events would otherwise be lost to any future subscriber.
func forwardJob(ctx context.Context, s *api.Server, c *websocket.Conn, job *domain.Job, cl closer, namespace string) {
	for ev := range job.Subscribe() {
		wireType := wireTypeFor(namespace, ev.Type)
		payload := map[string]any{"jobId": job.ID}
		if ev.Data != nil {
			payload["data"] = ev.Data
		}
		if err := api.WriteEnvelope(ctx, c, wireType, payload, ""); err != nil {
			// Connection broke. Let the engine finish on its own — its events
			// would be lost to this client anyway. Don't Stop() the job: a
			// later reconnect could pick it up if we wanted to support that.
			logger.Debug("forward event", "jobId", job.ID, "err", err)
			return
		}
	}
	if cl != nil {
		if err := cl.Close(); err != nil && !errors.Is(err, context.Canceled) {
			logger.Debug("close resource", "jobId", job.ID, "err", err)
		}
	}
	s.ForgetJob(job.ID)
	logger.Info("job finished", "jobId", job.ID, "kind", namespace)
}
