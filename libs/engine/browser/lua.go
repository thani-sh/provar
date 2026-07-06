package browser

import (
	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/proto"
	"github.com/yuin/gopher-lua"
)

const (
	luaPageTypeName    = "Page"
	luaLocatorTypeName = "Locator"
)

type luaPage struct {
	page *rod.Page
}

type luaLocator struct {
	selector string
	page     *rod.Page
}

func registerPageType(L *lua.LState) {
	mt := L.NewTypeMetatable(luaPageTypeName)
	methods := L.SetFuncs(L.NewTable(), map[string]lua.LGFunction{
		"navigate":     pageGoto,
		"locator":      pageLocator,
		"assertExists": pageAssertExists,
	})
	mt.RawSetString("__index", methods)
}

func registerLocatorType(L *lua.LState) {
	mt := L.NewTypeMetatable(luaLocatorTypeName)
	methods := L.SetFuncs(L.NewTable(), map[string]lua.LGFunction{
		"fill":    locatorFill,
		"click":   locatorClick,
		"waitFor": locatorWaitFor,
	})
	mt.RawSetString("__index", methods)
}

func pageGoto(L *lua.LState) int {
	ud := L.CheckUserData(1)
	lp, ok := ud.Value.(*luaPage)
	if !ok {
		L.RaiseError("expected *luaPage")
		return 0
	}
	url := L.CheckString(2)
	// Per-call 5s timeout — clones the page so the deadline doesn't leak
	// onto the page's lifetime (would otherwise dead-letter every subsequent
	// operation across the whole test run).
	p := lp.page.Timeout(implicitWaitTimeout)
	err := p.Navigate(url)
	if err != nil {
		L.RaiseError("failed to navigate to %s: %v", url, err)
		return 0
	}
	err = p.WaitLoad()
	if err != nil {
		L.RaiseError("failed to wait load: %v", err)
	}
	return 0
}

func pageLocator(L *lua.LState) int {
	ud := L.CheckUserData(1)
	lp, ok := ud.Value.(*luaPage)
	if !ok {
		L.RaiseError("expected *luaPage")
		return 0
	}
	selector := L.CheckString(2)
	locUd := L.NewUserData()
	locUd.Value = &luaLocator{
		selector: selector,
		page:     lp.page,
	}
	L.SetMetatable(locUd, L.GetTypeMetatable(luaLocatorTypeName))
	L.Push(locUd)
	return 1
}

// pageAssertExists waits up to implicitWaitTimeout for the given selector to
// be visible, mirroring the compile-time AssertExists behaviour. Raises on
// timeout — the action fails and the runner reports it.
func pageAssertExists(L *lua.LState) int {
	ud := L.CheckUserData(1)
	lp, ok := ud.Value.(*luaPage)
	if !ok {
		L.RaiseError("expected *luaPage")
		return 0
	}
	selector := L.CheckString(2)
	p := lp.page.Timeout(implicitWaitTimeout)
	el, err := p.Element(selector)
	if err != nil {
		L.RaiseError("assertExists %q: %v", selector, err)
		return 0
	}
	if err := el.WaitVisible(); err != nil {
		L.RaiseError("assertExists %q: %v", selector, err)
		return 0
	}
	return 0
}

func locatorFill(L *lua.LState) int {
	ud := L.CheckUserData(1)
	ll, ok := ud.Value.(*luaLocator)
	if !ok {
		L.RaiseError("expected *luaLocator")
		return 0
	}
	value := L.CheckString(2)
	p := ll.page.Timeout(implicitWaitTimeout)
	el, err := p.Element(ll.selector)
	if err != nil {
		L.RaiseError("failed to find element %s: %v", ll.selector, err)
		return 0
	}
	if err := el.WaitVisible(); err != nil {
		L.RaiseError("element %s did not become visible: %v", ll.selector, err)
		return 0
	}
	err = el.Input(value)
	if err != nil {
		L.RaiseError("failed to input value into %s: %v", ll.selector, err)
	}
	return 0
}

func locatorClick(L *lua.LState) int {
	ud := L.CheckUserData(1)
	ll, ok := ud.Value.(*luaLocator)
	if !ok {
		L.RaiseError("expected *luaLocator")
		return 0
	}
	p := ll.page.Timeout(implicitWaitTimeout)
	el, err := p.Element(ll.selector)
	if err != nil {
		L.RaiseError("failed to find element %s: %v", ll.selector, err)
		return 0
	}
	if err := el.WaitVisible(); err != nil {
		L.RaiseError("element %s did not become visible: %v", ll.selector, err)
		return 0
	}
	err = el.Click(proto.InputMouseButtonLeft, 1)
	if err != nil {
		L.RaiseError("failed to click element %s: %v", ll.selector, err)
	}
	return 0
}

func locatorWaitFor(L *lua.LState) int {
	ud := L.CheckUserData(1)
	ll, ok := ud.Value.(*luaLocator)
	if !ok {
		L.RaiseError("expected *luaLocator")
		return 0
	}
	p := ll.page.Timeout(implicitWaitTimeout)
	el, err := p.Element(ll.selector)
	if err != nil {
		L.RaiseError("failed to find element %s: %v", ll.selector, err)
		return 0
	}
	if err := el.WaitVisible(); err != nil {
		L.RaiseError("element %s did not become visible: %v", ll.selector, err)
		return 0
	}
	return 0
}
