package job

import (
	"context"
	"errors"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
)

func init() {
	api.Register("v1/project/job/resume", &projectJobResumeHandler{})
}

// projectJobResumeReq is the data shape for v1/project/job/resume. jobId
// is the id returned by the original v1/project/compile or v1/project/run
// reply.
type projectJobResumeReq struct {
	JobID string `json:"jobId"`
}

type projectJobResumeHandler struct {
	api.BaseHandler
}

func (h *projectJobResumeHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectJobResumeReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	job, ok := s.LookupJob(req.JobID)
	if !ok {
		return h.WriteError(ctx, c, env, errors.New("unknown jobId"))
	}
	if err := job.Resume(); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	return h.WriteOK(ctx, c, env)
}
