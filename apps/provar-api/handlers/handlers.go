// Package handlers is the WebSocket API handlers' facade. The actual
// handler implementations live in nested subpackages, one per directory
// (mirroring the event type path). The root package imports them with
// blank identifiers so cmd/provar-api's single import of this package
// pulls in every wire-type handler — adding a new endpoint means
// creating a file in the right nested directory, no other wiring.
package handlers

import (
	// Pull in every nested handler package so their init() functions
	// register the handlers with api.Register. Keep this list in sync
	// with the directory tree under v1/.
	_ "github.com/thani-sh/provar/apps/provar-api/handlers/v1/doctor"
	_ "github.com/thani-sh/provar/apps/provar-api/handlers/v1/project"
	_ "github.com/thani-sh/provar/apps/provar-api/handlers/v1/project/action"
	_ "github.com/thani-sh/provar/apps/provar-api/handlers/v1/project/config"
	_ "github.com/thani-sh/provar/apps/provar-api/handlers/v1/project/file"
	_ "github.com/thani-sh/provar/apps/provar-api/handlers/v1/project/job"
	_ "github.com/thani-sh/provar/apps/provar-api/handlers/v1/project/visual"
	_ "github.com/thani-sh/provar/apps/provar-api/handlers/v1/settings"
)
