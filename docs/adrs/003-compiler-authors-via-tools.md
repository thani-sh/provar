# 003 - Compiler Authors via Tools

## Context

The compiler currently authors all Lua for an action in a single LLM call. The LLM sees only the page state at the start of the action and has to predict what the page looks like after each interaction. For actions that span several interactions ("log in, navigate, fill, submit, verify"), the LLM often picks selectors that don't exist after the predicted click, and the whole body fails.

The `recent-changes` branch tried to fix this by adding a compile-time browser, a heal loop, and a review agent. None addressed the root cause: the LLM never sees fresh page state while authoring. Each layer added complexity without solving the problem.

## Decision

`libs/models` gains tool-calling support via a generic `ModelTool` interface. The interface is implemented **outside** the models package — first use is the compiler, future use cases will add their own. Implementations are stateless. The session drives the tool-call loop internally: when the LLM calls a tool, the session invokes `Execute`, sends the result back as a `tool_result`, and continues. `Recv()` does not emit tool-call events; it only delivers the LLM's text output. The loop ends when the LLM stops calling tools.

```go
type ModelTool interface {
    Name() string
    Description() string
    Parameters() json.RawMessage
    Execute(ctx context.Context, args json.RawMessage) (ToolResult, error)
}

type ToolResult struct {
    Content []Attachment
}
```

The compiler provides a fixed set of stateless browser primitives, each mapped 1:1 to one Lua statement:

| Tool                  | Lua equivalent                       |
| --------------------- | ------------------------------------ |
| `get_page_source`     | (observation only)                   |
| `get_page_screenshot` | (observation only)                   |
| `navigate`            | `page:navigate(url)`                 |
| `click`               | `page:locator(sel):click()`          |
| `fill`                | `page:locator(sel):fill(value)`      |
| `done`                | (terminal signal)                    |

The compiler owns the browser session and reads its action log after `Recv()` closes. The log translates 1:1 to Lua statements inside `steps.<id>(page) ... end`. The LLM's initial prompt carries the action description and project vars; the browser starts at `about:blank` and the LLM derives the starting URL from vars or the action description.

## Consequences

**Pros**

- LLM gets fresh page state after every action — no more predicting post-click selectors.
- Stateless tools are reusable beyond the compiler (test failure explainer, code reviewer, anything that drives a browser).
- Compiler observes via the browser session — no tool events leak out of `models`.
- Removes the recent-changes complexity: no fence extraction, no format policing, no review agent, no heal loop.

**Cons**

- Tool calling requires plumbing across all three providers (`genai`, `openai-go`, `anthropic-sdk-go`). Google's `genai.Schema` differs from OpenAI / Anthropic's JSON Schema, so the Google adapter needs translation.
- More LLM calls per action (3–15 typical). Latency and cost grow. Sessions need a max-iteration cap as a safety net.
- Tool call IDs are provider-specific; the models package normalises them so callers don't see the difference.

**Rejected**

- *Per-statement `next_statement` tool*: couples a domain concept into the tool vocabulary and gives the LLM less freedom to observe and reason.
- *Heal loop + review agent* (recent-changes): tries to keep the one-shot "generate complete body, then verify" model and bolt observation on as a retry. Doesn't address the root cause.
- *`page:observe()` Lua API*: requires the compiler to interleave LLM calls with Lua execution; brittle and indirect.
