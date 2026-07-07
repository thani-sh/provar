package bindings

import (
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Shell exposes desktop shell integration. Desktop only — opens
// URLs in the user's default browser.
type Shell struct {
	BaseBinding
}

// OpenExternal opens url in the OS default handler.
func (s Shell) OpenExternal(url string) error {
	runtime.BrowserOpenURL(s.Ctx, url)
	return nil
}
