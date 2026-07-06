package file

import (
	"context"

	"github.com/coder/websocket"
	"go.yaml.in/yaml/v4"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/logger"
)

func init() {
	api.Register("v1/project/file/save", &projectFileSaveHandler{})
}

// projectFileSaveReq is the data shape for v1/project/file/save. content
// is the YAML encoding of the actions list. The handler parses it before
// writing so an invalid file fails at save time, not at the next compile.
type projectFileSaveReq struct {
	Project string `json:"project"`
	Path    string `json:"path"`
	Content string `json:"content"`
}

type projectFileSaveHandler struct {
	api.BaseHandler
}

func (h *projectFileSaveHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectFileSaveReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	project, err := h.LoadProject(s, req.Project)
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	var actions []domain.Action
	if err := yaml.Unmarshal([]byte(req.Content), &actions); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	if err := domain.SaveFile(project.Path, req.Path, actions); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	logger.Info("file saved", "project", project.Path, "path", req.Path)
	return h.WriteOK(ctx, c, env)
}
