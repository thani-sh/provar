package handlers

import (
	"context"
	"encoding/json"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
)

func init() {
	api.Register("v1/project/job/stop", handleJobCommand(stopAction))
	api.Register("v1/project/job/pause", handleJobCommand(pauseAction))
	api.Register("v1/project/job/resume", handleJobCommand(resumeAction))
}

// jobControlReq is the data shape for every v1/project/job/* command.
// jobId is the id returned by the original v1/project/compile or
// v1/project/run reply.
type jobControlReq struct {
	JobID string `json:"jobId"`
}

// jobControlReply is the ak-paired reply. ok=false carries an error string.
type jobControlReply struct {
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

// jobAction is the verb applied to a job by the dispatcher.
type jobAction func(*domain.Job) error

func stopAction(j *domain.Job) error   { return j.Stop() }
func pauseAction(j *domain.Job) error  { return j.Pause() }
func resumeAction(j *domain.Job) error { return j.Resume() }

// handleJobCommand adapts a jobAction into a Handler. Three near-identical
// handlers would be ten lines of duplication each; one wrapper does the job.
func handleJobCommand(action jobAction) api.Handler {
	return func(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
		var req jobControlReq
		if err := json.Unmarshal(env.Data, &req); err != nil {
			return api.WriteError(ctx, c, env.Type, env.Meta.ID, "invalid data: "+err.Error())
		}
		job, ok := s.LookupJob(req.JobID)
		if !ok {
			return api.WriteError(ctx, c, env.Type, env.Meta.ID, "unknown jobId")
		}
		if err := action(job); err != nil {
			return api.WriteError(ctx, c, env.Type, env.Meta.ID, err.Error())
		}
		return api.WriteEnvelope(ctx, c, env.Type, jobControlReply{OK: true}, env.Meta.ID)
	}
}
