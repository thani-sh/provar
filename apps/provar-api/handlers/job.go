package handlers

import (
	"context"
	"errors"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
)

func init() {
	api.Register("v1/project/job/stop", &jobCommandHandler{action: stopAction})
	api.Register("v1/project/job/pause", &jobCommandHandler{action: pauseAction})
	api.Register("v1/project/job/resume", &jobCommandHandler{action: resumeAction})
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

// jobCommandHandler adapts a jobAction into a Handler. Three near-identical
// handlers would be ten lines of duplication each; one struct with the
// action set at init() does the job.
type jobCommandHandler struct {
	api.BaseHandler
	action jobAction
}

func (h *jobCommandHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req jobControlReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	job, ok := s.LookupJob(req.JobID)
	if !ok {
		return h.WriteError(ctx, c, env, errors.New("unknown jobId"))
	}
	if err := h.action(job); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	return h.WriteReply(ctx, c, env, jobControlReply{OK: true})
}
