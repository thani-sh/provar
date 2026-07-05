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

// implicitWaitTimeout caps the per-call implicit wait that click/fill/
// assert_exists do before acting on an element. Spec: all implicit waits
// must be 5s or less.
//
// Applied via `s.page.Timeout(implicitWaitTimeout).Element(...)` (and
// equivalent for the other operations), which returns a *clone* of the page
// with the deadline — the original page context is untouched, so the page
// never dies wall-clock style. A previous version applied `page.Timeout(d)`
// once in NewSession and accidentally set a deadline on the page's entire
// lifetime, dead-lettering every operation after d seconds.
const implicitWaitTimeout = 5 * time.Second

// Options bundles the chrome settings NewSession needs. Kept as a struct
// (instead of positional args) so adding a field like DeviceScaleFactor
// later doesn't churn every caller.
type Options struct {
	Headless bool
	Width    int
	Height   int
}

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
//
// IMPORTANT: do NOT call `page.Timeout(d)` here — it sets a wall-clock
// deadline on the page's entire context, which dead-letters every operation
// once d elapses. Per-call timeouts are applied at the Session.* methods
// via `s.page.Timeout(implicitWaitTimeout).X(...)` instead, which scopes the
// deadline to a single call without leaking onto the page.
//
// Width/Height in opts are applied to the page viewport. Pass 0 for either
// to use the rod default; callers that want explicit control should resolve
// defaults upstream (see domain.BrowserConfig.resolved).
func NewSession(ctx context.Context, opts Options) (*Session, error) {
	l := launcher.New().Headless(opts.Headless)
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
	if opts.Width > 0 && opts.Height > 0 {
		// We don't emulate touch or scale — just plain desktop pixels.
		if err := page.SetViewport(&proto.EmulationSetDeviceMetricsOverride{
			Width:             opts.Width,
			Height:            opts.Height,
			DeviceScaleFactor: 1.0,
			Mobile:            false,
		}); err != nil {
			_ = browser.Close()
			return nil, fmt.Errorf("set viewport %dx%d: %w", opts.Width, opts.Height, err)
		}
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

// Navigate loads the given URL and waits for the page to settle. The per-call
// `s.page.Timeout(...)` clone scopes the deadline to navigate+waitLoad —
// without this, the page context would have no upper bound on a stalled site.
func (s *Session) Navigate(url string) error {
	p := s.page.Timeout(implicitWaitTimeout)
	if err := p.Navigate(url); err != nil {
		return fmt.Errorf("navigate %q: %w", url, err)
	}
	if err := p.WaitLoad(); err != nil {
		return fmt.Errorf("navigate %q: wait load: %w", url, err)
	}
	return nil
}

// Click finds the element matching the CSS selector, waits up to
// implicitWaitTimeout for it to be visible, and clicks it. The whole
// find+wait+click is bounded by implicitWaitTimeout — the `page.Timeout()`
// clone scopes the deadline to this single call without leaking onto the
// page's lifetime.
func (s *Session) Click(selector string) error {
	p := s.page.Timeout(implicitWaitTimeout)
	el, err := p.Element(selector)
	if err != nil {
		return fmt.Errorf("click %q: find element: %w", selector, err)
	}
	if err := el.WaitVisible(); err != nil {
		return fmt.Errorf("click %q: not visible: %w", selector, err)
	}
	if err := el.Click(proto.InputMouseButtonLeft, 1); err != nil {
		return fmt.Errorf("click %q: %w", selector, err)
	}
	return nil
}

// Fill finds the input element matching the CSS selector, waits up to
// implicitWaitTimeout for it to be visible, and types the value into it.
// Same per-call timeout pattern as Click — see Click for the rationale.
func (s *Session) Fill(selector, value string) error {
	p := s.page.Timeout(implicitWaitTimeout)
	el, err := p.Element(selector)
	if err != nil {
		return fmt.Errorf("fill %q: find element: %w", selector, err)
	}
	if err := el.WaitVisible(); err != nil {
		return fmt.Errorf("fill %q: not visible: %w", selector, err)
	}
	if err := el.Input(value); err != nil {
		return fmt.Errorf("fill %q: %w", selector, err)
	}
	return nil
}

// AssertExists waits up to implicitWaitTimeout for the element matching the
// CSS selector to become visible, returning an error naming the selector if
// it doesn't. Used by the compile-time tool wrapper to record a verification
// step the LLM emits as `assert_exists` — the corresponding Lua runtime
// method (page:assertExists) does the same check at run time.
func (s *Session) AssertExists(selector string) error {
	p := s.page.Timeout(implicitWaitTimeout)
	el, err := p.Element(selector)
	if err != nil {
		return fmt.Errorf("assertExists %q: %w", selector, err)
	}
	if err := el.WaitVisible(); err != nil {
		return fmt.Errorf("assertExists %q: not visible: %w", selector, err)
	}
	return nil
}

// GetPageSource returns the current page's outer HTML. Used as a tool result so the LLM
// can observe the post-action DOM. Per-call 5s timeout so a wedged page doesn't hang.
func (s *Session) GetPageSource() (string, error) {
	return s.page.Timeout(implicitWaitTimeout).HTML()
}

// Element resolves a CSS selector against the current page and returns the underlying
// rod element. Used by tool wrappers that need to do something more than a single
// primitive call (e.g. wait_for needs to call WaitVisible). The returned element
// inherits a 5s context from the per-call page.Timeout clone.
func (s *Session) Element(selector string) (*rod.Element, error) {
	return s.page.Timeout(implicitWaitTimeout).Element(selector)
}
