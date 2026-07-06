package config

import (
	"context"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/logger"
)

func init() {
	api.Register("v1/project/config/save", &projectConfigSaveHandler{})
}

// projectConfigSaveReq is the data shape for v1/project/config/save. config
// is the same shape the load endpoint returns — handlers do not parse it
// into a typed struct, so the GUI can ship arbitrary fields.
type projectConfigSaveReq struct {
	Project string         `json:"project"`
	Config  map[string]any `json:"config"`
}

type projectConfigSaveHandler struct {
	api.BaseHandler
}

func (h *projectConfigSaveHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectConfigSaveReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	project, err := h.LoadProject(s, req.Project)
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	if err := domain.SaveConfig(project.Path, req.Config); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	logger.Info("config saved", "project", project.Path)
	return h.WriteOK(ctx, c, env)
}
