// Package commands contains the application-specific subcommand handlers. It depends only
// on the helpers package (cross-cutting primitives) and the SDK packages — never the other
// way around.
package commands

import (
	"context"
	"fmt"

	"github.com/thani-sh/provar/apps/provar-cli/helpers"
)

// Registry is the ordered list of known commands. Adding a subcommand = one new file in
// this package + one entry here. Order is the help-screen display order.
var Registry = []helpers.Command{
	setupCmd,
	listCmd,
	validateCmd,
	compileCmd,
	runCmd,
	testCmd,
	doctorCmd,
	cleanCmd,
	acceptBaselineCmd,
}

// Dispatch parses argv, finds the matching command, and runs it. It handles --help (top
// level and per-command), unknown commands, and missing positionals before the per-command
// handler is invoked — handlers never see those cases.
func Dispatch(ctx context.Context, args []string, p *helpers.Printer) int {
	if len(args) == 0 {
		printTopHelp(p)
		return int(helpers.ExitUsage)
	}
	switch args[0] {
	case "--help", "-h":
		printTopHelp(p)
		return int(helpers.ExitSuccess)
	}
	var cmd helpers.Command
	found := false
	for _, c := range Registry {
		if c.Name == args[0] {
			cmd = c
			found = true
			break
		}
	}
	if !found {
		p.Error("unknown command: %s", args[0])
		printTopHelp(p)
		return int(helpers.ExitUsage)
	}
	rest := args[1:]
	if len(rest) > 0 && (rest[0] == "--help" || rest[0] == "-h") {
		printCommandHelp(cmd, p)
		return int(helpers.ExitSuccess)
	}
	target := ""
	if cmd.NeedsTarget {
		if len(rest) == 0 || startsWithFlag(rest[0]) {
			p.Error("%s requires a target path", cmd.Name)
			printCommandHelp(cmd, p)
			return int(helpers.ExitUsage)
		}
		target = rest[0]
		rest = rest[1:]
	}
	flags, err := helpers.Parse(rest, cmd.Flags)
	if err != nil {
		p.Error("%s: %v", cmd.Name, err)
		printCommandHelp(cmd, p)
		return int(helpers.ExitUsage)
	}
	return cmd.Run(ctx, target, flags, p)
}

func startsWithFlag(s string) bool {
	return len(s) > 0 && s[0] == '-'
}

func printTopHelp(p *helpers.Printer) {
	fmt.Fprintln(p.Out, helpers.FormatBold("provar")+" — AI-driven end-to-end test engine")
	fmt.Fprintln(p.Out)
	fmt.Fprintln(p.Out, "Usage:")
	fmt.Fprintln(p.Out, "  provar <command> [target] [flags]")
	fmt.Fprintln(p.Out)
	fmt.Fprintln(p.Out, "Commands:")
	for _, c := range Registry {
		fmt.Fprintf(p.Out, "  %s\t%s\n", helpers.FormatBold(c.Name), c.Summary)
	}
	fmt.Fprintln(p.Out)
	fmt.Fprintln(p.Out, "Run 'provar <command> --help' for command-specific flags.")
}

func printCommandHelp(cmd helpers.Command, p *helpers.Printer) {
	fmt.Fprintf(p.Out, "%s — %s\n", helpers.FormatBold(cmd.Name), cmd.Summary)
	if cmd.NeedsTarget {
		fmt.Fprintf(p.Out, "\nUsage: provar %s <target> [flags]\n", cmd.Name)
	} else {
		fmt.Fprintf(p.Out, "\nUsage: provar %s [flags]\n", cmd.Name)
	}
	if len(cmd.Flags.Specs) > 0 {
		fmt.Fprintln(p.Out, "\nFlags:")
		for _, s := range cmd.Flags.Specs {
			label := "--" + s.Name
			if s.Alias != "" {
				label += ", -" + s.Alias
			}
			if s.HasValue {
				label += " <value>"
			}
			required := ""
			if s.Required {
				required = " " + helpers.FormatDim("(required)")
			}
			fmt.Fprintf(p.Out, "  %s%s\n", label, required)
		}
	}
}
