package config

import (
	"context"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
)

func init() {
	api.Register("v1/project/config/load", &projectConfigLoadHandler{})
}

// projectConfigLoadReq is the data shape for v1/project/config/load. The
// reply carries the YAML as a generic map so unknown fields round-trip
// through the GUI untouched.
type projectConfigLoadReq struct {
	Project string `json:"project"`
}

type projectConfigLoadReply struct {
	Config map[string]any `json:"config"`
}

type projectConfigLoadHandler struct {
	api.BaseHandler
}

func (h *projectConfigLoadHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectConfigLoadReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	project, err := h.LoadProject(s, req.Project)
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	cfg, err := domain.LoadConfig(project.Path)
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	return h.WriteReply(ctx, c, env, projectConfigLoadReply{Config: cfg})
}
