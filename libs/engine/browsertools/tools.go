// Package browsertools exposes the compile-time browser as a set of stateless
// models.ModelTool implementations. Each tool wraps a single browser primitive
// (Click, Fill, Navigate, etc.), records the call to the browser session's action log,
// and returns the result back to the LLM. Tools hold a reference to the browser
// session but no per-call state, so the same tool instance can be reused across many
// calls and across many actions.
package browsertools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/thani-sh/provar/libs/engine/browser"
	"github.com/thani-sh/provar/libs/logger"
	"github.com/thani-sh/provar/libs/models"
)

// Tools returns the standard tool set for the compile-time loop: navigation, fill,
// click, wait_for, get_page_source, get_page_screenshot, and a done sentinel. The
// returned slice can be passed directly to models.Client.CreateSession.
func Tools(b *browser.Session) []models.ModelTool {
	return []models.ModelTool{
		&navigateTool{b: b},
		&fillTool{b: b},
		&clickTool{b: b},
		&waitForTool{b: b},
		&getPageSourceTool{b: b},
		&getPageScreenshotTool{b: b},
		&doneTool{},
	}
}

// --- navigate ---

type navigateTool struct{ b *browser.Session }

func (t *navigateTool) Name() string { return "navigate" }
func (t *navigateTool) Description() string {
	return "Navigate the browser to the given absolute URL and wait for the page to load. Use {{var}} placeholders inside the URL string for project variables (e.g. \"{{baseUrl}}/login\")."
}
func (t *navigateTool) Parameters() json.RawMessage {
	return json.RawMessage(`{"type":"object","properties":{"url":{"type":"string","description":"Absolute URL to navigate to. May contain {{var}} placeholders."}},"required":["url"]}`)
}
func (t *navigateTool) Execute(ctx context.Context, args json.RawMessage) (models.ToolResult, error) {
	var p struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		return models.ToolResult{}, fmt.Errorf("navigate: bad args: %w", err)
	}
	if err := requireNonBlank("navigate", "url", p.URL); err != nil {
		return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeText, Text: err.Error() + " — call get_page_source to find a real URL, or use {{baseUrl}}."}}}, nil
	}
	logger.Debug("tool", "name", "navigate", "url", p.URL)
	t.b.RecordAction("navigate", map[string]any{"url": p.URL})
	if err := t.b.Navigate(p.URL); err != nil {
		return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeText, Text: "navigate failed: " + err.Error()}}}, nil
	}
	return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeText, Text: "navigated to " + p.URL}}}, nil
}

// --- click ---

type clickTool struct{ b *browser.Session }

func (t *clickTool) Name() string { return "click" }
func (t *clickTool) Description() string {
	return "Click the first element matching the given CSS selector. Use this for buttons, links, and any clickable element."
}
func (t *clickTool) Parameters() json.RawMessage {
	return json.RawMessage(`{"type":"object","properties":{"selector":{"type":"string","description":"CSS selector passed to document.querySelector."}},"required":["selector"]}`)
}
func (t *clickTool) Execute(ctx context.Context, args json.RawMessage) (models.ToolResult, error) {
	var p struct {
		Selector string `json:"selector"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		return models.ToolResult{}, fmt.Errorf("click: bad args: %w", err)
	}
	if err := requireNonBlank("click", "selector", p.Selector); err != nil {
		return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeText, Text: err.Error() + " — call get_page_source to find a real selector."}}}, nil
	}
	logger.Debug("tool", "name", "click", "selector", p.Selector)
	t.b.RecordAction("click", map[string]any{"selector": p.Selector})
	if err := t.b.Click(p.Selector); err != nil {
		return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeText, Text: "click failed: " + err.Error()}}}, nil
	}
	return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeText, Text: "clicked " + p.Selector}}}, nil
}

// --- fill ---

type fillTool struct{ b *browser.Session }

func (t *fillTool) Name() string { return "fill" }
func (t *fillTool) Description() string {
	return "Fill an input element matching the given CSS selector with the given value."
}
func (t *fillTool) Parameters() json.RawMessage {
	return json.RawMessage(`{"type":"object","properties":{"selector":{"type":"string","description":"CSS selector for the input element."},"value":{"type":"string","description":"Value to type into the input. May contain {{var}} placeholders."}},"required":["selector","value"]}`)
}
func (t *fillTool) Execute(ctx context.Context, args json.RawMessage) (models.ToolResult, error) {
	var p struct {
		Selector string `json:"selector"`
		Value    string `json:"value"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		return models.ToolResult{}, fmt.Errorf("fill: bad args: %w", err)
	}
	// Empty `value` is allowed (clears the field). Empty `selector` is not.
	if err := requireNonBlank("fill", "selector", p.Selector); err != nil {
		return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeText, Text: err.Error() + " — call get_page_source to find a real selector."}}}, nil
	}
	logger.Debug("tool", "name", "fill", "selector", p.Selector)
	t.b.RecordAction("fill", map[string]any{"selector": p.Selector, "value": p.Value})
	if err := t.b.Fill(p.Selector, p.Value); err != nil {
		return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeText, Text: "fill failed: " + err.Error()}}}, nil
	}
	return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeText, Text: "filled " + p.Selector + " with " + p.Value}}}, nil
}

// --- wait_for ---

type waitForTool struct{ b *browser.Session }

func (t *waitForTool) Name() string { return "wait_for" }
func (t *waitForTool) Description() string {
	return "Block until the element matching the given CSS selector becomes visible. Raises if the element never appears. Use this to verify that the page reached a particular state (e.g. \"wait_for 'dashboard-heading'\" confirms the dashboard rendered)."
}
func (t *waitForTool) Parameters() json.RawMessage {
	return json.RawMessage(`{"type":"object","properties":{"selector":{"type":"string","description":"CSS selector for the element to wait for."}},"required":["selector"]}`)
}
func (t *waitForTool) Execute(ctx context.Context, args json.RawMessage) (models.ToolResult, error) {
	var p struct {
		Selector string `json:"selector"`
	}
	if err := json.Unmarshal(args, &p); err != nil {
		return models.ToolResult{}, fmt.Errorf("wait_for: bad args: %w", err)
	}
	if err := requireNonBlank("wait_for", "selector", p.Selector); err != nil {
		return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeText, Text: err.Error() + " — call get_page_source to find a real selector."}}}, nil
	}
	logger.Debug("tool", "name", "wait_for", "selector", p.Selector)
	t.b.RecordAction("wait_for", map[string]any{"selector": p.Selector})
	el, err := t.b.Element(p.Selector)
	if err != nil {
		return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeText, Text: "wait_for failed: " + err.Error()}}}, nil
	}
	// Bounded timeout: rod's default sleeper retries indefinitely. Without this, a
	// selector that never appears hangs the whole compile.
	if err := el.Timeout(15 * time.Second).WaitVisible(); err != nil {
		return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeText, Text: "wait_for failed: " + err.Error()}}}, nil
	}
	return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeText, Text: "wait_for ok: " + p.Selector}}}, nil
}

type getPageSourceTool struct{ b *browser.Session }

func (t *getPageSourceTool) Name() string { return "get_page_source" }
func (t *getPageSourceTool) Description() string {
	return "Return the current page's outer HTML so you can see what the page looks like after the previous action. Useful for picking selectors based on the actual DOM."
}
func (t *getPageSourceTool) Parameters() json.RawMessage {
	return json.RawMessage(`{"type":"object","properties":{}}`)
}
func (t *getPageSourceTool) Execute(ctx context.Context, args json.RawMessage) (models.ToolResult, error) {
	html, err := t.b.GetPageSource()
	if err != nil {
		return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeText, Text: "get_page_source failed: " + err.Error()}}}, nil
	}
	logger.Debug("tool", "name", "get_page_source", "bytes", len(html))
	return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeText, Text: html}}}, nil
}

// --- get_page_screenshot ---

type getPageScreenshotTool struct{ b *browser.Session }

func (t *getPageScreenshotTool) Name() string { return "get_page_screenshot" }
func (t *getPageScreenshotTool) Description() string {
	return "Capture a PNG screenshot of the current page so you can see what it looks like visually. Useful for picking elements whose selectors aren't obvious from the DOM alone."
}
func (t *getPageScreenshotTool) Parameters() json.RawMessage {
	return json.RawMessage(`{"type":"object","properties":{}}`)
}
func (t *getPageScreenshotTool) Execute(ctx context.Context, args json.RawMessage) (models.ToolResult, error) {
	shot, err := t.b.Screenshot()
	if err != nil {
		return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeText, Text: "get_page_screenshot failed: " + err.Error()}}}, nil
	}
	logger.Debug("tool", "name", "get_page_screenshot", "bytes", len(shot))
	return models.ToolResult{Content: []models.Attachment{{Type: models.AttachmentTypeImage, Data: shot, MIME: "image/png"}}}, nil
}

// --- done ---

type doneTool struct{}

func (t *doneTool) Name() string { return "done" }
func (t *doneTool) Description() string {
	return "Call this when the action is fully complete and no further UI interactions are needed. After calling done, the session ends."
}
func (t *doneTool) Parameters() json.RawMessage {
	return json.RawMessage(`{"type":"object","properties":{}}`)
}
func (t *doneTool) Execute(ctx context.Context, args json.RawMessage) (models.ToolResult, error) {
	logger.Debug("tool", "name", "done")
	return models.ToolResult{}, nil
}

// requireNonBlank refuses tool args that the LLM sometimes emits as empty or
// whitespace-only strings — values that would otherwise silently produce dead
// `page:navigate("")` / `page:locator(""):click()` lines in the compiled Lua
// and (worse) trigger rod's empty-URL path. Returns a descriptive error meant
// to be returned to the LLM as a tool result so the model can react.
func requireNonBlank(tool, field, value string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("%s refused: %s is empty or whitespace-only", tool, field)
	}
	return nil
}
