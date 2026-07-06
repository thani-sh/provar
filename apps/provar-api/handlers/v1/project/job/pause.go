package job

import (
	"context"
	"errors"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
)

func init() {
	api.Register("v1/project/job/pause", &projectJobPauseHandler{})
}

// projectJobPauseReq is the data shape for v1/project/job/pause. jobId is
// the id returned by the original v1/project/compile or v1/project/run
// reply.
type projectJobPauseReq struct {
	JobID string `json:"jobId"`
}

type projectJobPauseHandler struct {
	api.BaseHandler
}

func (h *projectJobPauseHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectJobPauseReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	job, ok := s.LookupJob(req.JobID)
	if !ok {
		return h.WriteError(ctx, c, env, errors.New("unknown jobId"))
	}
	if err := job.Pause(); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	return h.WriteOK(ctx, c, env)
}
