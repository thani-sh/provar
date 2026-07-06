package project

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/logger"
)

func init() {
	api.Register("v1/project/clean", &projectCleanHandler{})
}

// projectCleanReq is the data shape for v1/project/clean. By default only
// the current-run screenshots are removed; includeBaselines also drops the
// accepted baselines, and includeLua also drops compiled .test.lua files.
// dryRun reports what would have been removed without touching disk.
type projectCleanReq struct {
	Project          string `json:"project"`
	IncludeBaselines bool   `json:"includeBaselines,omitempty"`
	IncludeLua       bool   `json:"includeLua,omitempty"`
	DryRun           bool   `json:"dryRun,omitempty"`
}

type projectCleanHandler struct {
	api.BaseHandler
}

func (h *projectCleanHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectCleanReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	project, err := h.LoadProject(s, req.Project)
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	type cleanTarget struct {
		path  string
		label string
		skip  bool
	}
	targets := []cleanTarget{
		{path: filepath.Join(project.Path, domain.VisualDir), label: "current screenshots"},
		{path: filepath.Join(project.Path, domain.BaselinesDir), label: "baselines", skip: !req.IncludeBaselines},
	}
	for _, t := range targets {
		if t.skip {
			continue
		}
		if _, err := os.Stat(t.path); err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				logger.Info("skip clean", "label", t.label)
				continue
			}
			return h.WriteError(ctx, c, env, fmt.Errorf("stat %s: %w", t.label, err))
		}
		if req.DryRun {
			logger.Info("would remove", "label", t.label, "path", t.path)
			continue
		}
		if err := os.RemoveAll(t.path); err != nil {
			return h.WriteError(ctx, c, env, fmt.Errorf("remove %s: %w", t.label, err))
		}
		logger.Info("removed", "label", t.label, "path", t.path)
	}
	if req.IncludeLua {
		for _, f := range project.Files {
			luaPath := filepath.Join(project.Path, strings.TrimSuffix(f.Path, ".test.yml")+".test.lua")
			if _, err := os.Stat(luaPath); err != nil {
				continue
			}
			if req.DryRun {
				logger.Info("would remove compiled", "path", luaPath)
				continue
			}
			if err := os.Remove(luaPath); err != nil {
				return h.WriteError(ctx, c, env, fmt.Errorf("remove %s: %w", luaPath, err))
			}
			logger.Info("removed compiled", "path", luaPath)
		}
	}
	return h.WriteOK(ctx, c, env)
}
