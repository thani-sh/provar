package models

import (
	"context"
	"errors"
	"fmt"
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
)

var (
	errModelRequired  = errors.New("model name is required")
	errAPIKeyRequired = errors.New("api key is required")
)

// Session represents a stateful chat session keeping conversation history.
type Session interface {
	Send(ctx context.Context, message string) error
	Recv() <-chan string
}

// Client defines the common interface for establishing chat sessions.
type Client interface {
	CreateSession(ctx context.Context) (Session, error)
}

// NewClient initializes a Client based on the selected provider.
func NewClient(provider Provider, apiKey string, baseURL string, model string) (Client, error) {
	if provider == Google {
		return NewGoogleClient(apiKey, model), nil
	}
	if provider == OpenAI {
		return NewOpenAIClient(apiKey, baseURL, model), nil
	}
	if provider == Anthropic {
		return NewAnthropicClient(apiKey, baseURL, model), nil
	}
	return nil, fmt.Errorf("unsupported provider: %s", provider)
}
