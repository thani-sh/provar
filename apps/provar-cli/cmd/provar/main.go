// Command provar is the Provar CLI entry point.
package main

import (
	"context"
	"os"

	"github.com/thani-sh/provar/apps/provar-cli/commands"
	"github.com/thani-sh/provar/apps/provar-cli/helpers"
)

func main() {
	ctx, cancel := helpers.WithSignal(context.Background())
	defer cancel()
	p := helpers.NewPrinter(os.Stdout, os.Stderr)
	code := commands.Dispatch(ctx, os.Args[1:], p)
	if ctx.Err() != nil {
		os.Exit(int(helpers.ExitSigInt))
	}
	os.Exit(code)
}
