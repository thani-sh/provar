package models

import "context"

// Provider represents one of the supported AI model providers.
type Provider string

const (
	// Google represents the Google AI provider (e.g. Gemini).
	Google Provider = "google"
	// OpenAI represents the OpenAI provider (e.g. GPT).
	OpenAI Provider = "openai"
	// Anthropic represents the Anthropic provider (e.g. Claude).
	Anthropic Provider = "anthropic"
)

// Client handles communication with various LLM backends.
type Client struct {
	Provider Provider
}

// StreamSession starts a bidirectional streaming session with the model using native Go channels.
// It accepts an input channel for prompts/events and an output channel for model responses/events.
func (c *Client) StreamSession(ctx context.Context, in <-chan string, out chan<- string) error {
	// TODO: Implement bidirectional streaming using channels.
	return nil
}
