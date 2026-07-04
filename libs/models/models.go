package models

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// Provider represents one of the supported AI model providers.
type Provider string

const (
	// Google represents the Google AI provider.
	Google Provider = "google"
	// OpenAI represents the OpenAI provider.
	OpenAI Provider = "openai"
	// Anthropic represents the Anthropic provider.
	Anthropic Provider = "anthropic"
)

const (
	chanBuffer = 100
	// maxToolIterations caps the per-session tool-call loop as a safety net against
	// runaway loops. Generous enough for realistic interactions; small enough that a
	// stuck agent bails quickly.
	maxToolIterations = 64
)

var (
	errModelRequired  = errors.New("model name is required")
	errAPIKeyRequired = errors.New("api key is required")
)

// AttachmentType defines the type of content in an attachment.
type AttachmentType string

const (
	// AttachmentTypeText represents a text attachment.
	AttachmentTypeText AttachmentType = "text"
	// AttachmentTypeImage represents an image attachment.
	AttachmentTypeImage AttachmentType = "image"
)

// Attachment represents a content block (text or image) sent to or received from a model.
type Attachment struct {
	Type AttachmentType
	Text string
	Data []byte
	MIME string
}

// ModelTool is the provider-agnostic shape of a tool the LLM can call. The interface
// lives in models so the providers can declare tools at session creation; implementations
// live outside models so they can be domain-specific (compiler, runner, future agents)
// without coupling the transport layer to any one caller. Tools should be stateless.
type ModelTool interface {
	Name() string
	Description() string
	Parameters() json.RawMessage
	Execute(ctx context.Context, args json.RawMessage) (ToolResult, error)
}

// ToolResult is what a tool returns to the session after Execute. Content is sent back
// to the model as the tool_result message. Returning a non-nil error is reserved for
// unrecoverable conditions (programmer bugs, panics); a "statement failed: missing
// element" result is just content — the model should react and retry.
type ToolResult struct {
	Content []Attachment
}

// Session represents a stateful chat session keeping conversation history. The session
// drives the tool-call loop internally: when the LLM calls a tool, the session invokes
// Execute, sends the result back as a tool_result, and continues. Recv only delivers
// the LLM's text output — tool-call events are not exposed.
type Session interface {
	Send(ctx context.Context, attachments []Attachment) error
	Recv() <-chan string
}

// Client defines the common interface for establishing chat sessions. Tools are
// declared once at session creation; the empty case behaves exactly like a text-only
// session.
type Client interface {
	CreateSession(ctx context.Context, systemPrompt string, tools ...ModelTool) (Session, error)
}

// NewClient initializes a Client based on the selected provider.
func NewClient(provider Provider, apiKey string, baseURL string, model string) (Client, error) {
	if provider == Google {
		return NewGoogleClient(apiKey, baseURL, model), nil
	}
	if provider == OpenAI {
		return NewOpenAIClient(apiKey, baseURL, model), nil
	}
	if provider == Anthropic {
		return NewAnthropicClient(apiKey, baseURL, model), nil
	}
	return nil, fmt.Errorf("unsupported provider: %s", provider)
}

// thinkFilter filters out content inside <think>...</think> tags.
type thinkFilter struct {
	inThink bool
	buf     string
}

func (f *thinkFilter) Process(chunk string) string {
	f.buf += chunk
	var output string
	for {
		if !f.inThink {
			idx := strings.Index(f.buf, "<think>")
			if idx != -1 {
				output += f.buf[:idx]
				f.buf = f.buf[idx+len("<think>"):]
				f.inThink = true
				continue
			}
			var maxKeep int
			for i := 1; i < 7; i++ {
				if len(f.buf) >= i && strings.HasPrefix("<think>", f.buf[len(f.buf)-i:]) {
					maxKeep = i
				}
			}
			flushLen := len(f.buf) - maxKeep
			if flushLen > 0 {
				output += f.buf[:flushLen]
				f.buf = f.buf[flushLen:]
			}
			break
		} else {
			idx := strings.Index(f.buf, "</think>")
			if idx != -1 {
				f.buf = f.buf[idx+len("</think>"):]
				f.inThink = false
				continue
			}
			var maxKeep int
			for i := 1; i < 8; i++ {
				if len(f.buf) >= i && strings.HasPrefix("</think>", f.buf[len(f.buf)-i:]) {
					maxKeep = i
				}
			}
			discardLen := len(f.buf) - maxKeep
			if discardLen > 0 {
				f.buf = f.buf[discardLen:]
			}
			break
		}
	}
	return output
}

func (f *thinkFilter) Flush() string {
	if f.inThink {
		return ""
	}
	res := f.buf
	f.buf = ""
	return res
}

// toolResultText flattens a ToolResult's content into a single string. Image
// attachments are represented by a placeholder so the LLM knows something was returned
// without us having to thread multimodal content through every provider's tool-result
// format (which differs across Google / OpenAI / Anthropic).
func toolResultText(r ToolResult) string {
	var sb strings.Builder
	for _, a := range r.Content {
		if a.Type == AttachmentTypeImage {
			fmt.Fprintf(&sb, "[image:%s:%dB]\n", a.MIME, len(a.Data))
			continue
		}
		sb.WriteString(a.Text)
		if !strings.HasSuffix(a.Text, "\n") {
			sb.WriteString("\n")
		}
	}
	return sb.String()
}
