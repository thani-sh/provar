package job

import (
	"context"
	"errors"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
)

func init() {
	api.Register("v1/project/job/stop", &projectJobStopHandler{})
}

// projectJobStopReq is the data shape for v1/project/job/stop. jobId is
// the id returned by the original v1/project/compile or v1/project/run
// reply.
type projectJobStopReq struct {
	JobID string `json:"jobId"`
}

type projectJobStopHandler struct {
	api.BaseHandler
}

func (h *projectJobStopHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectJobStopReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	job, ok := s.LookupJob(req.JobID)
	if !ok {
		return h.WriteError(ctx, c, env, errors.New("unknown jobId"))
	}
	if err := job.Stop(); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	return h.WriteOK(ctx, c, env)
}
