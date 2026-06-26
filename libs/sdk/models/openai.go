package models

import (
	"context"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

type openaiClient struct {
	apiKey  string
	baseURL string
	model   string
}

// NewOpenAIClient creates a Client configured for OpenAI.
func NewOpenAIClient(apiKey string, baseURL string, model string) Client {
	return &openaiClient{
		apiKey:  apiKey,
		baseURL: baseURL,
		model:   model,
	}
}

func (c *openaiClient) CreateSession(ctx context.Context) (Session, error) {
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
	client := openai.NewClient(opts...)
	return &openaiSession{
		client: &client,
		model:  c.model,
		ch:     make(chan string, chanBuffer),
	}, nil
}

type openaiSession struct {
	client   *openai.Client
	model    string
	messages []openai.ChatCompletionMessageParamUnion
	ch       chan string
}

func (s *openaiSession) Send(ctx context.Context, message string) error {
	s.messages = append(s.messages, userMessage(message))
	stream := s.client.Chat.Completions.NewStreaming(ctx, openai.ChatCompletionNewParams{
		Model:    openai.ChatModel(s.model),
		Messages: s.messages,
	})
	s.ch = make(chan string, chanBuffer)
	go func() {
		defer close(s.ch)
		var fullContent string
		for stream.Next() {
			chunk := stream.Current()
			if len(chunk.Choices) > 0 {
				content := chunk.Choices[0].Delta.Content
				s.ch <- content
				fullContent += content
			}
		}
		if err := stream.Err(); err == nil {
			s.messages = append(s.messages, assistantMessage(fullContent))
		}
	}()
	return nil
}

func (s *openaiSession) Recv() <-chan string {
	return s.ch
}

func userMessage(content string) openai.ChatCompletionMessageParamUnion {
	return openai.ChatCompletionMessageParamUnion{
		OfUser: &openai.ChatCompletionUserMessageParam{
			Content: openai.ChatCompletionUserMessageParamContentUnion{
				OfString: openai.String(content),
			},
		},
	}
}

func assistantMessage(content string) openai.ChatCompletionMessageParamUnion {
	return openai.ChatCompletionMessageParamUnion{
		OfAssistant: &openai.ChatCompletionAssistantMessageParam{
			Content: openai.ChatCompletionAssistantMessageParamContentUnion{
				OfString: openai.String(content),
			},
		},
	}
}
