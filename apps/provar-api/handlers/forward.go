package handlers

import (
	"context"
	"errors"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/logger"
)

// closer is anything with a Close() error method (browser.Session today,
// possibly other resources later). Pass via an interface to keep Forward
// reusable across any resource-owning engine.
type closer interface {
	Close() error
}

// jobStateEvents enumerates the engine event types that are state
// transitions. The ADR folds every transition into a single wire event
// (v1/project/job/state-changed) with the new state in `data.state`. The
// wire type is atomic; the value here is the new state name. State
// transitions are shared across every Forwarder — they're a property of
// the job, not of the engine producing the rest of the stream.
var jobStateEvents = map[string]string{
	"stopped": "stopped",
	"paused":  "paused",
	"resumed": "resumed",
}

// Forwarder ranges over a Job's event stream and writes each event to the
// connection, rewriting the engine type to a wire type via the Events
// table. Each handler that produces a streaming job builds its own
// Forwarder with the wire types it wants to publish — the table is the
// only source of truth for wire names, no transformation is applied to
// unknown types.
type Forwarder struct {
	Events map[string]string
}

// Forward runs until the job's event stream closes (engine emitted its
// terminal event and called Job.Close), then cleans up the optional
// resource cl (browser session etc.) and forgets the job from the registry.
//
// If ctx is cancelled (client disconnected), Forward stops forwarding and
// cleans up. The engine job itself isn't stopped — it runs to completion
// because its events would otherwise be lost to any future subscriber.
func (f *Forwarder) Forward(ctx context.Context, s *api.Server, c *websocket.Conn, job *domain.Job, cl closer) {
	for ev := range job.Subscribe() {
		if state, ok := jobStateEvents[ev.Type]; ok {
			if err := api.WriteEnvelope(ctx, c, "v1/project/job/state-changed", map[string]any{
				"jobId": job.ID,
				"state": state,
			}, ""); err != nil {
				logger.Debug("forward event", "jobId", job.ID, "err", err)
				return
			}
			continue
		}
		wireType, ok := f.Events[ev.Type]
		if !ok {
			// Unknown event type — a miss here means the table is out of
			// date with the engine. Log it loudly and skip; the rest of
			// the stream continues.
			logger.Warn("unknown engine event", "jobId", job.ID, "type", ev.Type)
			continue
		}
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
}
