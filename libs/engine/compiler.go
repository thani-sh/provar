package engine

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine/browser"
	"github.com/thani-sh/provar/libs/engine/browsertools"
	"github.com/thani-sh/provar/libs/models"
)

// Compiler turns a list of actions into a Lua script by walking each action in a fresh
// LLM session. The LLM uses a fixed set of stateless browser tools (see browsertools)
// to figure out how to fulfil the action; the compiler reads the browser's action log
// after the session ends and translates each recorded action 1:1 to a Lua statement.
type Compiler struct {
	Client models.Client
}

// NewCompiler creates a Compiler that opens a fresh LLM session per action.
func NewCompiler(client models.Client) *Compiler {
	return &Compiler{Client: client}
}

// Compile walks actions in order. For each one it opens a fresh session with the browser
// tools, asks the LLM to fulfil the action, drains Recv, then reads the browser's
// action log and translates each entry to a Lua statement. The final Lua bundles every
// action as `function steps.<id>(page) ... end`.
func (c *Compiler) Compile(ctx context.Context, actions []domain.Action, opts CompileOptions) (*CompileResult, error) {
	bodies := make([]string, 0, len(actions))
	for _, action := range actions {
		body, err := c.compileAction(ctx, action, opts)
		if err != nil {
			return nil, fmt.Errorf("compile %s: %w", action.ID, err)
		}
		bodies = append(bodies, body)
	}
	return &CompileResult{
		Success: true,
		LuaCode: assembleLua(actions, bodies),
	}, nil
}

func (c *Compiler) compileAction(ctx context.Context, action domain.Action, opts CompileOptions) (string, error) {
	opts.Browser.ClearActions()
	tools := browsertools.Tools(opts.Browser)
	session, err := c.Client.CreateSession(ctx, systemPrompt(), tools...)
	if err != nil {
		return "", fmt.Errorf("create session: %w", err)
	}
	prompt := buildActionPrompt(action, opts.Vars)
	if err := session.Send(ctx, []models.Attachment{{Type: models.AttachmentTypeText, Text: prompt}}); err != nil {
		return "", fmt.Errorf("send: %w", err)
	}
	for range session.Recv() {
	}
	body := translateActions(opts.Browser.Actions())
	if body == "" {
		return "", fmt.Errorf("no actions recorded by LLM")
	}
	return body, nil
}

func assembleLua(actions []domain.Action, bodies []string) string {
	var sb strings.Builder
	sb.WriteString("local steps = {}\n\n")
	for i, a := range actions {
		fmt.Fprintf(&sb, "function steps.%s(page)\n", a.ID)
		sb.WriteString(bodies[i])
		if !strings.HasSuffix(bodies[i], "\n") {
			sb.WriteString("\n")
		}
		sb.WriteString("end\n\n")
	}
	sb.WriteString("return steps\n")
	return sb.String()
}

// translateActions turns the browser's recorded action log into Lua source. Each entry
// becomes one statement; observation tools (get_page_source, get_page_screenshot) and
// the done sentinel produce no Lua output.
func translateActions(actions []browser.Action) string {
	var sb strings.Builder
	for _, a := range actions {
		switch a.Name {
		case "navigate":
			if url, ok := a.Args["url"].(string); ok {
				fmt.Fprintf(&sb, "page:navigate(%s)\n", luaString(url))
			}
		case "click":
			if sel, ok := a.Args["selector"].(string); ok {
				fmt.Fprintf(&sb, "page:locator(%s):click()\n", luaString(sel))
			}
		case "fill":
			sel, _ := a.Args["selector"].(string)
			val, _ := a.Args["value"].(string)
			fmt.Fprintf(&sb, "page:locator(%s):fill(%s)\n", luaString(sel), luaString(val))
		case "wait_for":
			if sel, ok := a.Args["selector"].(string); ok {
				fmt.Fprintf(&sb, "page:locator(%s):waitFor()\n", luaString(sel))
			}
		}
	}
	return sb.String()
}

// luaString formats a Go string as a Lua double-quoted string literal. The runtime
// accepts only `page:navigate(url)` style literals, so we always emit double quotes
// and escape the same characters Lua's loader does.
func luaString(s string) string {
	var sb strings.Builder
	sb.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"', '\\':
			sb.WriteByte('\\')
			sb.WriteRune(r)
		case '\n':
			sb.WriteString(`\n`)
		case '\r':
			sb.WriteString(`\r`)
		case '\t':
			sb.WriteString(`\t`)
		default:
			sb.WriteRune(r)
		}
	}
	sb.WriteByte('"')
	return sb.String()
}

func systemPrompt() string {
	return `You drive a real browser to complete one user-facing action of an end-to-end test.

Use the provided tools to perform the action step by step. After each tool call you see the result (often an error message, or a snapshot of the new page state). Use the result to decide your next move.

When the action is fully complete — every step a real user would perform has been done — call the done tool. Do NOT call done prematurely.

If a tool call fails, do not give up. Read the error, observe the page (with get_page_source or get_page_screenshot), pick a corrected selector or value, and try again. You may retry as many times as you need.

Rules:
- Drive the app through its UI: click, fill, navigate. Do not invent workarounds.
- All selectors, field names, URLs, and values must be visible on the page or in the project variables listed below. If a value is missing, generate a unique one (e.g. a timestamp-based email) rather than guessing.
- {{var}} placeholders work inside string values for tool arguments; they are substituted at run time.
- CSS selectors only. Use get_page_source to inspect the DOM if you're unsure.
- get_page_source and get_page_screenshot are observation tools — they do not produce Lua code, just information for you.`
}

func buildActionPrompt(action domain.Action, vars map[string]string) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "Complete this action end-to-end:\n\n")
	fmt.Fprintf(&sb, "Action ID: %s\n", action.ID)
	fmt.Fprintf(&sb, "Action Title: %s\n", action.Name)
	fmt.Fprintf(&sb, "Action Description: %s\n\n", action.Info)
	if len(vars) > 0 {
		keys := make([]string, 0, len(vars))
		for k := range vars {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		sb.WriteString("Available project variables (use {{name}} in tool arguments; substituted at run time):\n")
		for _, k := range keys {
			fmt.Fprintf(&sb, "- {{%s}} = %s\n", k, vars[k])
		}
		sb.WriteString("\n")
	}
	sb.WriteString("Drive the browser with the tools. Call done when the action is complete.")
	return sb.String()
}
