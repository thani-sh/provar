package project

import (
	"context"

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
	result, err := domain.Clean(project, domain.CleanOptions{
		IncludeBaselines: req.IncludeBaselines,
		IncludeLua:       req.IncludeLua,
		DryRun:           req.DryRun,
	})
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	for _, item := range result.Items {
		switch item.Action {
		case domain.CleanActionRemoved:
			logger.Info("removed", "label", item.Label, "path", item.Path)
		case domain.CleanActionWouldRemove:
			logger.Info("would remove", "label", item.Label, "path", item.Path)
		case domain.CleanActionNotFound:
			logger.Info("skip clean", "label", item.Label)
		}
	}
	return h.WriteOK(ctx, c, env)
}
