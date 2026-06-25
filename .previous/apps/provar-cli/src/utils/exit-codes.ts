/**
 * ExitCode is the set of exit codes used by the `provar` CLI. Kept centralized so callers don't
 * pass magic numbers through the codebase. The mapping follows the standard Unix convention with
 * 130 reserved for SIGINT/SIGTERM termination (128 + signal number 2).
 */
export const ExitCode = {
  /** All work completed successfully. */
  Success: 0,
  /** A runtime error — failed LLM call, missing API key, in-flight test failure. */
  RuntimeError: 1,
  /** A usage error — bad arguments, missing target, unknown command. */
  UsageError: 2,
  /** The process was terminated by SIGINT (128 + 2) or SIGTERM (128 + 15). */
  SigInt: 130,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];
