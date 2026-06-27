package browser

import (
	"context"
	"fmt"

	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/launcher"
	"github.com/go-rod/rod/lib/proto"
	"github.com/yuin/gopher-lua"
)

// Session represents an active browser and script execution context.
type Session struct {
	browser *rod.Browser
	page    *rod.Page
	L       *lua.LState
	steps   *lua.LTable
}

// NewSession starts a browser and initializes the Lua VM.
func NewSession(ctx context.Context, headless bool) (*Session, error) {
	l := launcher.New().Headless(headless)
	u, err := l.Launch()
	if err != nil {
		return nil, fmt.Errorf("failed to launch browser: %w", err)
	}
	browser := rod.New().ControlURL(u)
	err = browser.Connect()
	if err != nil {
		return nil, fmt.Errorf("failed to connect to browser: %w", err)
	}
	page, err := browser.Page(proto.TargetCreateTarget{})
	if err != nil {
		_ = browser.Close()
		return nil, fmt.Errorf("failed to open page: %w", err)
	}
	L := lua.NewState()
	L.SetContext(ctx)
	registerPageType(L)
	registerLocatorType(L)
	return &Session{
		browser: browser,
		page:    page,
		L:       L,
	}, nil
}

// Close terminates the browser and shuts down the Lua VM.
func (s *Session) Close() error {
	s.L.Close()
	return s.browser.Close()
}

// LoadScript loads the compiled Lua steps script into the VM and caches step functions internally.
func (s *Session) LoadScript(luaCode string) error {
	err := s.L.DoString(luaCode)
	if err != nil {
		return fmt.Errorf("failed to load lua script: %w", err)
	}
	tbl := s.L.Get(-1)
	if tbl.Type() != lua.LTTable {
		return fmt.Errorf("expected script to return a steps table, got %s", tbl.Type().String())
	}
	s.steps = tbl.(*lua.LTable)
	s.L.Pop(1)
	return nil
}

// ExecuteStep runs a specific step function by its string identifier (e.g. "open_page").
func (s *Session) ExecuteStep(stepName string) error {
	if s.steps == nil {
		return fmt.Errorf("no script loaded")
	}
	fn := s.L.GetField(s.steps, stepName)
	if fn.Type() != lua.LTFunction {
		return fmt.Errorf("step function '%s' not found in steps table", stepName)
	}
	pageUd := s.L.NewUserData()
	pageUd.Value = &luaPage{page: s.page}
	s.L.SetMetatable(pageUd, s.L.GetTypeMetatable(luaPageTypeName))
	err := s.L.CallByParam(lua.P{
		Fn:      fn,
		NRet:    0,
		Protect: true,
	}, pageUd)
	if err != nil {
		return fmt.Errorf("lua error: %w", err)
	}
	return nil
}

// Screenshot captures the current page screenshot (PNG).
func (s *Session) Screenshot() ([]byte, error) {
	return s.page.Screenshot(true, nil)
}
