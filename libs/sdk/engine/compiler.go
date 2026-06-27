package engine

import (
	"context"
	"fmt"
	"strings"

	"github.com/thani-sh/provar/libs/sdk/domain"
	"github.com/thani-sh/provar/libs/sdk/models"
)

// Compiler handles logical compilation.
type Compiler struct {
	Session models.Session
}

// NewCompiler creates a new Compiler.
func NewCompiler(session models.Session) *Compiler {
	return &Compiler{Session: session}
}

// Compile compiles a list of actions into Lua executable steps.
func (c *Compiler) Compile(ctx context.Context, actions []domain.Action, opts CompileOptions) (*CompileResult, error) {
	prompt := buildPrompt(actions)
	attachment := models.Attachment{
		Type: models.AttachmentTypeText,
		Text: prompt,
	}
	err := c.Session.Send(ctx, []models.Attachment{attachment})
	if err != nil {
		return nil, fmt.Errorf("failed to send compile prompt to LLM: %w", err)
	}
	var response string
	for chunk := range c.Session.Recv() {
		response += chunk
	}
	luaCode := extractLuaCode(response)
	if luaCode == "" {
		return &CompileResult{Success: false}, fmt.Errorf("LLM returned empty compiled code")
	}
	return &CompileResult{
		Success: true,
		LuaCode: luaCode,
	}, nil
}

func buildPrompt(actions []domain.Action) string {
	var sb strings.Builder
	sb.WriteString("You are a test compiler for Provar. Your task is to compile a high-level test scenario into a Lua script that automates a browser using a standard Page and Locator API.\n\n")
	sb.WriteString("Here is the Page and Locator API that is exposed to the Lua script:\n")
	sb.WriteString("- `page:navigate(url)`: Navigates to a URL and waits for the page to load.\n")
	sb.WriteString("- `page:locator(selector)`: Returns a Locator object for the given CSS selector.\n")
	sb.WriteString("- `locator:fill(value)`: Inputs the value into the field.\n")
	sb.WriteString("- `locator:click()`: Clicks the element.\n")
	sb.WriteString("- `locator:waitFor()`: Waits for the element to become visible.\n\n")
	sb.WriteString("The output must be a valid Lua script structured exactly like this:\n")
	sb.WriteString("```lua\n")
	sb.WriteString("local steps = {}\n\n")
	sb.WriteString("function steps.action_id_1(page)\n")
	sb.WriteString("  page:navigate(\"https://example.com/login\")\n")
	sb.WriteString("end\n\n")
	sb.WriteString("function steps.action_id_2(page)\n")
	sb.WriteString("  page:locator(\"input[name='email']\"):fill(\"user@example.com\")\n")
	sb.WriteString("  page:locator(\"button[type='submit']\"):click()\n")
	sb.WriteString("end\n\n")
	sb.WriteString("return steps\n")
	sb.WriteString("```\n\n")
	sb.WriteString("Here are the actions of the test scenario to compile. For each action, write the corresponding Lua function under the action's ID.\n\n")
	for _, action := range actions {
		sb.WriteString(fmt.Sprintf("Action ID: %s\n", action.ID))
		sb.WriteString(fmt.Sprintf("Action Name: %s\n", action.Name))
		sb.WriteString(fmt.Sprintf("Action Description: %s\n\n", action.Info))
	}
	sb.WriteString("Respond ONLY with the complete compiled Lua script enclosed in a ```lua ... ``` code block. Do not include any explanations, introduction, or other conversational text.")
	return sb.String()
}

func extractLuaCode(response string) string {
	cleaned := strings.TrimSpace(response)
	if strings.Contains(cleaned, "```lua") {
		parts := strings.Split(cleaned, "```lua")
		if len(parts) > 1 {
			cleaned = parts[1]
			idx := strings.Index(cleaned, "```")
			if idx != -1 {
				cleaned = cleaned[:idx]
			}
		}
	} else if strings.Contains(cleaned, "```") {
		parts := strings.Split(cleaned, "```")
		if len(parts) > 1 {
			cleaned = parts[1]
			idx := strings.Index(cleaned, "```")
			if idx != -1 {
				cleaned = cleaned[:idx]
			}
		}
	}
	return strings.TrimSpace(cleaned)
}
