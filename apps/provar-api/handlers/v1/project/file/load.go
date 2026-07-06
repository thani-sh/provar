package file

import (
	"context"
	"os"
	"path/filepath"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
)

func init() {
	api.Register("v1/project/file/load", &projectFileLoadHandler{})
}

// projectFileLoadReq is the data shape for v1/project/file/load. path is
// project-relative. The reply carries the raw bytes as a string — the
// caller decodes based on the file extension.
type projectFileLoadReq struct {
	Project string `json:"project"`
	Path    string `json:"path"`
}

type projectFileLoadReply struct {
	Content string `json:"content"`
}

type projectFileLoadHandler struct {
	api.BaseHandler
}

func (h *projectFileLoadHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectFileLoadReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	project, err := h.LoadProject(s, req.Project)
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	data, err := os.ReadFile(filepath.Join(project.Path, req.Path))
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	return h.WriteReply(ctx, c, env, projectFileLoadReply{Content: string(data)})
}
