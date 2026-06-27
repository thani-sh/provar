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
