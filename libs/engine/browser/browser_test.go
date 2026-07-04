package browser

import (
	"testing"

	"github.com/yuin/gopher-lua"
)

func TestLuaRegistration(t *testing.T) {
	L := lua.NewState()
	defer L.Close()
	registerPageType(L)
	registerLocatorType(L)
	mtPage := L.GetTypeMetatable(luaPageTypeName)
	if mtPage == lua.LNil {
		t.Error("expected Page metatable to be registered")
	}
	mtLocator := L.GetTypeMetatable(luaLocatorTypeName)
	if mtLocator == lua.LNil {
		t.Error("expected Locator metatable to be registered")
	}
}

// TestLuaPageMethods locks in the public Lua Page API: every method the
// compiler emits must exist on the Page type. If a refactor drops or renames
// one, the compiled Lua will fail at run time with "attempt to call a nil
// value" — this test catches that at unit-test time instead.
func TestLuaPageMethods(t *testing.T) {
	L := lua.NewState()
	defer L.Close()
	registerPageType(L)
	mtPage := L.GetTypeMetatable(luaPageTypeName).(*lua.LTable)
	idx := mtPage.RawGetString("__index").(*lua.LTable)
	for _, method := range []string{"navigate", "locator", "assertExists"} {
		fn := idx.RawGetString(method)
		if fn.Type() != lua.LTFunction {
			t.Errorf("Page.%s should be a function, got %s", method, fn.Type())
		}
	}
}
