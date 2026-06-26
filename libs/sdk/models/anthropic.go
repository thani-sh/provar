package models

import (
	"context"
	"encoding/base64"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

const (
	maxTokens         = 4096
	eventContentDelta = "content_block_delta"
)

type anthropicClient struct {
	apiKey  string
	baseURL string
	model   string
}

// NewAnthropicClient creates a Client configured for Anthropic Claude.
func NewAnthropicClient(apiKey string, baseURL string, model string) Client {
	return &anthropicClient{
		apiKey:  apiKey,
		baseURL: baseURL,
		model:   model,
	}
}

func (c *anthropicClient) CreateSession(ctx context.Context) (Session, error) {
	if c.model == "" {
		return nil, errModelRequired
	}
	if c.apiKey == "" {
		return nil, errAPIKeyRequired
	}
	opts := []option.RequestOption{
		option.WithAPIKey(c.apiKey),
	}
	if c.baseURL != "" {
		opts = append(opts, option.WithBaseURL(c.baseURL))
	}
	client := anthropic.NewClient(opts...)
	return &anthropicSession{
		client: &client,
		model:  c.model,
		ch:     make(chan string, chanBuffer),
	}, nil
}

type anthropicSession struct {
	client   *anthropic.Client
	model    string
	messages []anthropic.MessageParam
	ch       chan string
}

func (s *anthropicSession) Send(ctx context.Context, attachments []Attachment) error {
	var parts []anthropic.ContentBlockParamUnion
	for _, a := range attachments {
		if a.Type == AttachmentTypeImage {
			base64Data := base64.StdEncoding.EncodeToString(a.Data)
			parts = append(parts, anthropic.NewImageBlock(anthropic.Base64ImageSourceParam{
				Data:      base64Data,
				MediaType: anthropic.Base64ImageSourceMediaType(a.MIME),
			}))
		} else {
			parts = append(parts, anthropic.NewTextBlock(a.Text))
		}
	}
	s.messages = append(s.messages, anthropic.NewUserMessage(parts...))
	stream := s.client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
		Model:     anthropic.Model(s.model),
		MaxTokens: maxTokens,
		Messages:  s.messages,
	})
	s.ch = make(chan string, chanBuffer)
	go func() {
		defer close(s.ch)
		var filter thinkFilter
		var fullContent string
		for stream.Next() {
			event := stream.Current()
			if event.Type == eventContentDelta {
				delta := event.AsContentBlockDelta()
				deltaText := delta.Delta.Text
				filtered := filter.Process(deltaText)
				if filtered != "" {
					s.ch <- filtered
					fullContent += filtered
				}
			}
		}
		flushed := filter.Flush()
		if flushed != "" {
			s.ch <- flushed
			fullContent += flushed
		}
		if err := stream.Err(); err == nil {
			s.messages = append(s.messages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(fullContent)))
		}
	}()
	return nil
}

func (s *anthropicSession) Recv() <-chan string {
	return s.ch
}
