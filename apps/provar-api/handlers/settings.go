package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"os"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/logger"
)

func init() {
	api.Register("v1/settings/load", handleSettingsLoad)
	api.Register("v1/settings/save", handleSettingsSave)
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

func handleSettingsLoad(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	settings, err := domain.LoadSettings()
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "load settings: "+err.Error())
	}
	path, err := domain.SettingsPath()
	if err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "locate settings: "+err.Error())
	}
	home, _ := os.UserHomeDir()
	_, statErr := os.Stat(path)
	exists := statErr == nil || !errors.Is(statErr, fs.ErrNotExist)
	return api.WriteEnvelope(ctx, c, env.Type, settingsLoadReply{
		Settings:       settings,
		Home:           home,
		SettingsExists: exists,
	}, env.Meta.ID)
}

// settingsSaveReq is the data shape for v1/settings/save. The full Settings
// struct is round-tripped — the handler overwrites the on-disk file with
// whatever the GUI sends.
type settingsSaveReq struct {
	Settings *domain.Settings `json:"settings"`
}

func handleSettingsSave(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req settingsSaveReq
	if err := json.Unmarshal(env.Data, &req); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "invalid data: "+err.Error())
	}
	if req.Settings == nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "settings is required")
	}
	if err := req.Settings.Validate(); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "validate: "+err.Error())
	}
	if err := domain.SaveSettings(req.Settings); err != nil {
		return api.WriteError(ctx, c, env.Type, env.Meta.ID, "save: "+err.Error())
	}
	logger.Info("settings saved", "provider", req.Settings.Provider)
	return writeOK(ctx, c, env)
}
