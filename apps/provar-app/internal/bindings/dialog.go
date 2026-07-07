package bindings

import (
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Dialog exposes native OS dialogs. Desktop only — no provar-api
// equivalent because the API runs server-side.
type Dialog struct {
	BaseBinding
}

// SelectProject opens a native folder picker. Returns the chosen
// path, or empty string if the user cancelled.
func (d Dialog) SelectProject() (string, error) {
	return runtime.OpenDirectoryDialog(d.Ctx, runtime.OpenDialogOptions{
		Title: "Select Project",
	})
}
