package helpers

import "context"

// Command is a single subcommand. Every cross-cutting concern is wired here, not inside the handler.
type Command struct {
	Name        string
	Summary     string
	Flags       FlagBinding
	NeedsTarget bool
	Run         func(ctx context.Context, target string, fl Flags, p *Printer) int
}
