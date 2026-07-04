package browser

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/launcher"
	"github.com/go-rod/rod/lib/proto"
	"github.com/yuin/gopher-lua"
)

// defaultBrowserTimeout caps every page/element call inside the compile-time browser.
// Rod's default sleeper retries indefinitely; without this a missing selector or a
// stalled page hangs the whole compile.
const defaultBrowserTimeout = 15 * time.Second

// Action represents one recorded browser interaction. It is the source of truth for what
// happened during a compile-time loop; the compiler reads the action log and translates
// each entry 1:1 to a Lua statement.
type Action struct {
	Name string         // tool name: "navigate", "click", "fill", "get_page_source", "get_page_screenshot"
	Args map[string]any // arguments passed to the tool
}

// Session represents an active browser and script execution context.
type Session struct {
	browser *rod.Browser
	page    *rod.Page
	L       *lua.LState
	steps   *lua.LTable

	mu      sync.Mutex
	actions []Action
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
	// Bound every subsequent page/element call so a missing selector or unresponsive
	// page doesn't hang the whole compile. Rod's default sleeper retries forever.
	page = page.Timeout(defaultBrowserTimeout)
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
	if _, ok := fn.(*lua.LFunction); !ok {
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

// RecordAction appends an entry to the in-memory action log. Used by the compile-time
// tool wrappers to record what the LLM did so the compiler can translate to Lua.
func (s *Session) RecordAction(name string, args map[string]any) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.actions = append(s.actions, Action{Name: name, Args: args})
}

// Actions returns a copy of the recorded actions since the last ClearActions call.
func (s *Session) Actions() []Action {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Action, len(s.actions))
	copy(out, s.actions)
	return out
}

// ClearActions resets the action log. The compiler calls this before starting each
// action's loop so the action log is scoped per compiled action.
func (s *Session) ClearActions() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.actions = nil
}

// --- compile-time primitives (called by tool wrappers, not by the runtime Lua VM) ---

// Navigate loads the given URL and waits for the page to settle.
func (s *Session) Navigate(url string) error {
	if err := s.page.Navigate(url); err != nil {
		return fmt.Errorf("navigate %q: %w", url, err)
	}
	if err := s.page.WaitLoad(); err != nil {
		return fmt.Errorf("navigate %q: wait load: %w", url, err)
	}
	return nil
}

// Click finds the element matching the CSS selector and clicks it.
func (s *Session) Click(selector string) error {
	el, err := s.page.Element(selector)
	if err != nil {
		return fmt.Errorf("click %q: find element: %w", selector, err)
	}
	if err := el.Click(proto.InputMouseButtonLeft, 1); err != nil {
		return fmt.Errorf("click %q: %w", selector, err)
	}
	return nil
}

// Fill finds the input element matching the CSS selector and types the value into it.
func (s *Session) Fill(selector, value string) error {
	el, err := s.page.Element(selector)
	if err != nil {
		return fmt.Errorf("fill %q: find element: %w", selector, err)
	}
	if err := el.Input(value); err != nil {
		return fmt.Errorf("fill %q: %w", selector, err)
	}
	return nil
}

// GetPageSource returns the current page's outer HTML. Used as a tool result so the LLM
// can observe the post-action DOM.
func (s *Session) GetPageSource() (string, error) {
	return s.page.HTML()
}

// Element resolves a CSS selector against the current page and returns the underlying
// rod element. Used by tool wrappers that need to do something more than a single
// primitive call (e.g. wait_for needs to call WaitVisible).
func (s *Session) Element(selector string) (*rod.Element, error) {
	return s.page.Element(selector)
}
