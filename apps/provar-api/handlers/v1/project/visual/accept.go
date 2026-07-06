package visual

import (
	"context"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/logger"
)

func init() {
	api.Register("v1/project/visual/accept", &projectVisualAcceptHandler{})
}

// projectVisualAcceptReq is the data shape for v1/project/visual/accept.
// An empty file promotes screenshots for every test file in the project;
// a non-empty file targets just that one file's bucket.
type projectVisualAcceptReq struct {
	Project string `json:"project"`
	File    string `json:"file,omitempty"`
}

type projectVisualAcceptHandler struct {
	api.BaseHandler
}

func (h *projectVisualAcceptHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	var req projectVisualAcceptReq
	if err := h.Decode(env, &req); err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	project, err := h.LoadProject(s, req.Project)
	if err != nil {
		return h.WriteError(ctx, c, env, err)
	}
	if req.File == "" {
		var total int
		for _, f := range project.Files {
			n, err := domain.AcceptBaselines(project.Path, domain.VisualBucket(f.Path))
			if err != nil {
				logger.Warn("accept baselines", "file", f.Path, "err", err)
				continue
			}
			total += n
		}
		logger.Info("baselines accepted (all)", "project", project.Path, "count", total)
	} else {
		n, err := domain.AcceptBaselines(project.Path, domain.VisualBucket(req.File))
		if err != nil {
			return h.WriteError(ctx, c, env, err)
		}
		logger.Info("baselines accepted", "project", project.Path, "file", req.File, "count", n)
	}
	return h.WriteOK(ctx, c, env)
}
