package models

import (
	"context"
	"encoding/base64"
	"fmt"

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

func (c *openaiClient) CreateSession(ctx context.Context, systemPrompt string) (Session, error) {
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
	var messages []openai.ChatCompletionMessageParamUnion
	if systemPrompt != "" {
		messages = append(messages, openai.SystemMessage(systemPrompt))
	}
	return &openaiSession{
		client:   &client,
		model:    c.model,
		messages: messages,
		ch:       make(chan string, chanBuffer),
	}, nil
}

type openaiSession struct {
	client   *openai.Client
	model    string
	messages []openai.ChatCompletionMessageParamUnion
	ch       chan string
}

func (s *openaiSession) Send(ctx context.Context, attachments []Attachment) error {
	s.messages = append(s.messages, userMessage(attachments))
	stream := s.client.Chat.Completions.NewStreaming(ctx, openai.ChatCompletionNewParams{
		Model:    openai.ChatModel(s.model),
		Messages: s.messages,
	})
	s.ch = make(chan string, chanBuffer)
	go func() {
		defer close(s.ch)
		var filter thinkFilter
		var fullContent string
		for stream.Next() {
			chunk := stream.Current()
			if len(chunk.Choices) > 0 {
				content := chunk.Choices[0].Delta.Content
				filtered := filter.Process(content)
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
			s.messages = append(s.messages, assistantMessage(fullContent))
		}
	}()
	return nil
}

func (s *openaiSession) Recv() <-chan string {
	return s.ch
}

func userMessage(attachments []Attachment) openai.ChatCompletionMessageParamUnion {
	var parts []openai.ChatCompletionContentPartUnionParam
	for _, a := range attachments {
		if a.Type == AttachmentTypeImage {
			base64Data := base64.StdEncoding.EncodeToString(a.Data)
			urlStr := fmt.Sprintf("data:%s;base64,%s", a.MIME, base64Data)
			parts = append(parts, openai.ChatCompletionContentPartUnionParam{
				OfImageURL: &openai.ChatCompletionContentPartImageParam{
					ImageURL: openai.ChatCompletionContentPartImageImageURLParam{
						URL: urlStr,
					},
				},
			})
		} else {
			parts = append(parts, openai.ChatCompletionContentPartUnionParam{
				OfText: &openai.ChatCompletionContentPartTextParam{
					Text: a.Text,
				},
			})
		}
	}
	return openai.ChatCompletionMessageParamUnion{
		OfUser: &openai.ChatCompletionUserMessageParam{
			Content: openai.ChatCompletionUserMessageParamContentUnion{
				OfArrayOfContentParts: parts,
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
