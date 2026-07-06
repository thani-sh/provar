package handlers

import (
	"context"
	"errors"
	"io/fs"
	"os"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/logger"
)

func init() {
	api.Register("v1/settings/load", &settingsLoadHandler{})
	api.Register("v1/settings/save", &settingsSaveHandler{})
}

// settingsLoadReply is the reply for v1/settings/load. settings is the
// parsed YAML; home is the directory the file lives in (so the GUI can
// open it in a file manager); settingsExists is false when the user has
// never saved — the GUI should still show defaults in that case.
type settingsLoadReply struct {
	Settings       *domain.Settings `json:"settings"`
	Home           string           `json:"home"`
	SettingsExists bool             `json:"settingsExists"`
}

type settingsLoadHandler struct {
	api.BaseHandler
}

func (h *settingsLoadHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	settings, err := domain.LoadSettings()
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	path, err := domain.SettingsPath()
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	home, _ := os.UserHomeDir()
	_, statErr := os.Stat(path)
	exists := statErr == nil || !errors.Is(statErr, fs.ErrNotExist)
	return h.WriteReply(ctx, c, env, settingsLoadReply{
		Settings:       settings,
		Home:           home,
		SettingsExists: exists,
	})
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
