package handlers

import (
	"context"

	"github.com/coder/websocket"

	api "github.com/thani-sh/provar/apps/provar-api"
	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine/browser"
)

func init() {
	api.Register("v1/doctor/run", &doctorRunHandler{})
}

// doctorCheck is one row in the doctor reply. ok is true when the check
// passed; error carries the failure message (always omitted on success).
type doctorCheck struct {
	Name  string `json:"name"`
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

// doctorReply is the reply for v1/doctor/run. checks carries the per-check
// result; the order is stable so the GUI can render a fixed-shape list.
type doctorReply struct {
	Checks []doctorCheck `json:"checks"`
}

type doctorRunHandler struct {
	api.BaseHandler
}

func (h *doctorRunHandler) Handle(ctx context.Context, s *api.Server, c *websocket.Conn, env api.Envelope) error {
	checks := []doctorCheck{}
	addCheck := func(name string, err error) {
		c := doctorCheck{Name: name, OK: err == nil}
		if err != nil {
			c.Error = err.Error()
		}
		checks = append(checks, c)
	}
	// Settings file exists and parses.
	settings, err := domain.LoadSettings()
	addCheck("settings file (~/.provar/settings.yml) parses", err)
	if err == nil {
		// Active provider has an API key configured.
		addCheck("settings validate", settings.Validate())
	}
	// Browser can launch headless. Slowest check (3-5s on a cold start),
	// so it's last. Failure usually means rod/Chromium can't find a
	// sandbox or system deps are missing.
	if sess, err := browser.NewSession(ctx, browser.Options{Headless: true}); err != nil {
		addCheck("browser launches (headless)", err)
	} else {
		addCheck("browser launches (headless)", nil)
		_ = sess.Close()
	}
	return h.WriteReply(ctx, c, env, doctorReply{Checks: checks})
}
