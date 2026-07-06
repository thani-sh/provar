package file

import (
	"context"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/logger"
)

func init() {
	api.Register("v1/project/file/delete", &projectFileDeleteHandler{})
}

// projectFileDeleteReq is the data shape for v1/project/file/delete. The
// path may point at a file or a directory — both are removed. The handler
// refuses paths that resolve outside the project root.
type projectFileDeleteReq struct {
	Project string `json:"project"`
	Path    string `json:"path"`
}

type projectFileDeleteHandler struct {
	api.BaseHandler
}

func (h *projectFileDeleteHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectFileDeleteReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	project, err := h.LoadProject(s, req.Project)
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	if err := domain.DeleteFile(project.Path, req.Path); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	logger.Info("file deleted", "project", project.Path, "path", req.Path)
	return h.WriteOK(ctx, c, env)
}
