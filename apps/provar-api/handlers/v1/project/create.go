package project

import (
	"context"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/logger"
)

func init() {
	api.Register("v1/project/create", &projectCreateHandler{})
}

// projectCreateReq is the data shape for v1/project/create. path is the
// absolute target directory; sample seeds a demo .test.yml + baseUrl
// pointing at SampleDemoURL; force removes an existing target first.
type projectCreateReq struct {
	Path   string `json:"path"`
	Sample bool   `json:"sample,omitempty"`
	Force  bool   `json:"force,omitempty"`
}

type projectCreateHandler struct {
	api.BaseHandler
}

func (h *projectCreateHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectCreateReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	if err := domain.InitProject(req.Path, req.Sample, req.Force); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	logger.Info("project created", "path", req.Path, "sample", req.Sample, "force", req.Force)
	return h.WriteOK(ctx, c, env)
}
