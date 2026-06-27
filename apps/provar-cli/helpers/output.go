package helpers

import (
	"fmt"
	"io"
)

// ANSI escape sequences for terminal coloring. Kept as package-level constants so
// per-call formatting is a single string concat rather than a function call.
const (
	ansiReset  = "\033[0m"
	ansiBold   = "\033[1m"
	ansiDim    = "\033[2m"
	ansiRed    = "\033[31m"
	ansiGreen  = "\033[32m"
	ansiYellow = "\033[33m"
	ansiCyan   = "\033[36m"
)

// Printer writes human-readable output to two sinks: Out for progress and success, Err for
// warnings and errors. Splitting the sinks lets callers redirect stderr independently.
type Printer struct {
	Out io.Writer
	Err io.Writer
}

// NewPrinter constructs a Printer writing to out (progress, success) and err (warnings, errors).
func NewPrinter(out, err io.Writer) *Printer {
	return &Printer{Out: out, Err: err}
}

// Info prints a progress line to stdout.
func (p *Printer) Info(format string, a ...any) {
	fmt.Fprintln(p.Out, cyan(fmt.Sprintf(format, a...)))
}

// Warn prints a warning to stderr.
func (p *Printer) Warn(format string, a ...any) {
	fmt.Fprintln(p.Err, yellow(fmt.Sprintf(format, a...)))
}

// Error prints an error to stderr.
func (p *Printer) Error(format string, a ...any) {
	fmt.Fprintln(p.Err, red(fmt.Sprintf(format, a...)))
}

// Success prints a success line to stdout.
func (p *Printer) Success(format string, a ...any) {
	fmt.Fprintln(p.Out, green(fmt.Sprintf(format, a...)))
}

func bold(s string) string   { return ansiBold + s + ansiReset }
func dim(s string) string    { return ansiDim + s + ansiReset }
func red(s string) string    { return ansiRed + s + ansiReset }
func green(s string) string  { return ansiGreen + s + ansiReset }
func yellow(s string) string { return ansiYellow + s + ansiReset }
func cyan(s string) string   { return ansiCyan + s + ansiReset }

// FormatBold returns s wrapped in ANSI bold for use in --help output and similar.
func FormatBold(s string) string { return bold(s) }

// FormatDim returns s wrapped in ANSI dim for use in --help output and similar.
func FormatDim(s string) string { return dim(s) }
