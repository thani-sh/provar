package action

import (
	"context"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
)

func init() {
	api.Register("v1/project/action/load", &projectActionLoadHandler{})
}

// projectActionLoadReq is the data shape for v1/project/action/load. file
// is project-relative. The reply carries the compiled .test.lua (empty
// when stale or missing) and a boolean telling the GUI whether to trigger
// a recompile before showing the user the source.
type projectActionLoadReq struct {
	Project string `json:"project"`
	File    string `json:"file"`
}

type projectActionLoadReply struct {
	Code     string `json:"code"`
	UpToDate bool   `json:"upToDate"`
}

type projectActionLoadHandler struct {
	api.BaseHandler
}

func (h *projectActionLoadHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectActionLoadReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	project, err := h.LoadProject(s, req.Project)
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	code, upToDate := domain.LoadCompiledLua(project.Path, req.File)
	return h.WriteReply(ctx, c, env, projectActionLoadReply{Code: code, UpToDate: upToDate})
}
