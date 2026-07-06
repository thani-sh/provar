package file

import (
	"context"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
)

func init() {
	api.Register("v1/project/file/list", &projectFileListHandler{})
}

// projectFileListReq is the data shape for v1/project/file/list. project
// is the absolute project root; the reply lists every .test.yml under it,
// relative to the root.
type projectFileListReq struct {
	Project string `json:"project"`
}

type projectFileListReply struct {
	Files []string `json:"files"`
}

type projectFileListHandler struct {
	api.BaseHandler
}

func (h *projectFileListHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectFileListReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	project, err := h.LoadProject(s, req.Project)
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	files := make([]string, len(project.Files))
	for i, f := range project.Files {
		files[i] = f.Path
	}
	return h.WriteReply(ctx, c, env, projectFileListReply{Files: files})
}
