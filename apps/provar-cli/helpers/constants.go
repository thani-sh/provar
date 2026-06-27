// Package helpers provides cross-cutting primitives shared by every provar subcommand:
// argument parsing, exit codes, output formatting, signal cancellation, and the Command
// contract.
package helpers

// ExitCode is the set of exit codes used by the provar CLI.
type ExitCode int

const (
	// ExitSuccess means all work completed successfully.
	ExitSuccess ExitCode = 0
	// ExitRuntime means a runtime error — failed LLM call, missing API key, in-flight test failure.
	ExitRuntime ExitCode = 1
	// ExitUsage means a usage error — bad arguments, missing target, unknown command.
	ExitUsage ExitCode = 2
	// ExitSigInt means the process was terminated by SIGINT (128 + 2) or SIGTERM (128 + 15).
	ExitSigInt ExitCode = 130
)
