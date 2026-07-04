package engine

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/thani-sh/provar/libs/domain"
	"github.com/thani-sh/provar/libs/engine/browser"
	"github.com/thani-sh/provar/libs/engine/browsertools"
	"github.com/thani-sh/provar/libs/logger"
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
	logger.Debug("compile action start", "id", action.ID, "tools", len(tools))
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
	logger.Debug("compile action end", "id", action.ID, "bytes", len(body))
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
	return `You complete one step of an end-to-end browser test by driving a real browser through tool calls. Each step starts fresh: the browser is on whatever page the previous step left it on, but you have no memory of how it got there. Drive, observe, decide, repeat.

PROCESS — follow this loop every turn:
1. If you don't already know what page you're on, call get_page_source (or get_page_screenshot for layout-only checks) to locate the elements you need.
2. Do one user-intent interaction — navigate, click, or fill — with a real selector or URL. One tool call per turn.
3. Read the result. It tells you whether the call worked and hints at the new page state. If the page clearly transitioned to something you don't recognise, observe again: get_page_source, or wait_for on a known element, then check the result of that.
4. With the new state understood, decide the next interaction and loop back to step 2. If the step's intent is realised, call done.

RULES:
- Do NOT repeat the same call with the same arguments after it succeeded. Retry only if the call failed, and only after observing why.
- Do NOT call navigate, click, fill, or wait_for with empty or whitespace-only arguments. Those calls produce dead code in the test.
- Drive the app through its UI: click, fill, navigate. Do not invent workarounds (no direct URL hacks, no API calls, no evaluating JavaScript).
- All selectors, URLs, and field values must be visible on the page or come from the project variables in your action prompt. If a value is missing, generate a unique one (e.g. a timestamp-based email) rather than guessing.
- {{var}} placeholders work inside string arguments. Use the placeholder form in tool arguments; the runtime resolves the value at execution time. Do not paste resolved values into tool arguments — placeholders keep tests portable across environments.
- get_page_source returns the full HTML — call it only when you actually need selectors. get_page_screenshot is for visual layout.
- CSS selectors only.`
}

func buildActionPrompt(action domain.Action, vars map[string]string) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "Step ID: %s\n\n", action.ID)
	fmt.Fprintf(&sb, "User's intent: %s — %s\n\n", action.Name, action.Info)
	if len(vars) > 0 {
		keys := make([]string, 0, len(vars))
		for k := range vars {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		sb.WriteString("Project variables (use {{name}} placeholders in tool arguments; the runtime substitutes them at execution time):\n")
		for _, k := range keys {
			fmt.Fprintf(&sb, "  {{%s}}\n", k)
		}
		sb.WriteString("\n")
	}
	sb.WriteString("The browser state carries across steps in this file. After the first step, the browser is wherever the previous step left it; on the first step it starts on an empty tab. If you don't already know what page you're on, call get_page_source before acting. Follow the process loop in your system prompt. Call done when the user's intent is realised.")
	return sb.String()
}
