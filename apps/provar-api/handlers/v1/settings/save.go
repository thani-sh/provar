package settings

import (
	"context"
	"errors"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/logger"
)

func init() {
	api.Register("v1/settings/save", &settingsSaveHandler{})
}

// settingsSaveReq is the data shape for v1/settings/save. The full Settings
// struct is round-tripped — the handler overwrites the on-disk file with
// whatever the GUI sends.
type settingsSaveReq struct {
	Settings *domain.Settings `json:"settings"`
}

type settingsSaveHandler struct {
	api.BaseHandler
}

func (h *settingsSaveHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req settingsSaveReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	if req.Settings == nil {
		return h.WriteError(ctx, c, env, errors.New("settings is required"))
	}
	if err := req.Settings.Validate(); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	if err := domain.SaveSettings(req.Settings); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	logger.Info("settings saved", "provider", req.Settings.Provider)
	return h.WriteOK(ctx, c, env)
}
