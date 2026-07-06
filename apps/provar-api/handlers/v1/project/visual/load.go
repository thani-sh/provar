package visual

import (
	"context"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
)

func init() {
	api.Register("v1/project/visual/load", &projectVisualLoadHandler{})
}

// projectVisualLoadReq is the data shape for v1/project/visual/load. file
// and actionId locate a single (file, action) screenshot pair. baseline and
// current are base64-encoded PNGs; both are omitted when the corresponding
// file is missing on disk.
type projectVisualLoadReq struct {
	Project  string `json:"project"`
	File     string `json:"file"`
	ActionID string `json:"actionId"`
}

type projectVisualLoadReply struct {
	Baseline string `json:"baseline,omitempty"`
	Current  string `json:"current,omitempty"`
}

type projectVisualLoadHandler struct {
	api.BaseHandler
}

func (h *projectVisualLoadHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectVisualLoadReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	project, err := h.LoadProject(s, req.Project)
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	baseline, current := domain.LoadVisualPair(project.Path, req.File, req.ActionID)
	return h.WriteReply(ctx, c, env, projectVisualLoadReply{Baseline: baseline, Current: current})
}
