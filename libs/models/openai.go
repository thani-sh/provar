package models

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	"github.com/thani-sh/provar/libs/logger"
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

func (c *openaiClient) CreateSession(ctx context.Context, systemPrompt string, tools ...ModelTool) (Session, error) {
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
	openaiTools := make([]openai.ChatCompletionToolParam, 0, len(tools))
	for _, t := range tools {
		var params map[string]any
		if err := json.Unmarshal(t.Parameters(), &params); err != nil {
			params = map[string]any{"type": "object"}
		}
		openaiTools = append(openaiTools, openai.ChatCompletionToolParam{
			Type: "function",
			Function: openai.FunctionDefinitionParam{
				Name:        t.Name(),
				Description: openai.String(t.Description()),
				Parameters:  params,
			},
		})
	}
	logger.Debug("model session", "provider", "openai", "model", c.model, "tools", len(tools))
	return &openaiSession{
		client:      &client,
		model:       c.model,
		messages:    messages,
		tools:       tools,
		openaiTools: openaiTools,
		ch:          make(chan string, chanBuffer),
	}, nil
}

type openaiSession struct {
	client      *openai.Client
	model       string
	messages    []openai.ChatCompletionMessageParamUnion
	tools       []ModelTool
	openaiTools []openai.ChatCompletionToolParam
	ch          chan string
}

func (s *openaiSession) Send(ctx context.Context, attachments []Attachment) error {
	s.messages = append(s.messages, userMessage(attachments))
	var textSnippets []string
	for _, a := range attachments {
		if a.Type == AttachmentTypeText {
			textSnippets = append(textSnippets, truncate(a.Text, 400))
		}
	}
	if len(textSnippets) > 0 {
		logger.Debug("model input", "provider", "openai", "texts", textSnippets)
	}
	s.ch = make(chan string, chanBuffer)
	go s.runLoop(ctx)
	return nil
}

func (s *openaiSession) Recv() <-chan string {
	return s.ch
}

func (s *openaiSession) runLoop(ctx context.Context) {
	defer close(s.ch)
	toolByName := make(map[string]ModelTool, len(s.tools))
	for _, t := range s.tools {
		toolByName[t.Name()] = t
	}
	for iter := 0; ; iter++ {
		if len(s.tools) > 0 && iter >= maxToolIterations {
			s.ch <- "error: exceeded max tool iterations"
			return
		}
		assistantText, toolCalls, finishReason, err := s.streamOnce(ctx)
		if err != nil {
			return
		}
		if len(toolCalls) == 0 {
			s.messages = append(s.messages, openai.AssistantMessage(assistantText))
			_ = finishReason
			return
		}
		assistantParam := openai.ChatCompletionMessageParamUnion{
			OfAssistant: &openai.ChatCompletionAssistantMessageParam{
				Content: openai.ChatCompletionAssistantMessageParamContentUnion{
					OfString: openai.String(assistantText),
				},
			},
		}
		s.messages = append(s.messages, assistantParam)
		toolCallBuilders := make(map[int64]*openaiToolCallBuilder, len(toolCalls))
		for _, tc := range toolCalls {
			builder, ok := toolCallBuilders[tc.Index]
			if !ok {
				builder = &openaiToolCallBuilder{id: tc.ID, name: tc.Function.Name}
				toolCallBuilders[tc.Index] = builder
			}
			if tc.ID != "" {
				builder.id = tc.ID
			}
			if tc.Function.Name != "" {
				builder.name = tc.Function.Name
			}
			builder.args.WriteString(tc.Function.Arguments)
		}
		if assistantText != "" {
			logger.Debug("model text", "provider", "openai", "iter", iter, "len", len(assistantText), "snippet", truncate(assistantText, 400))
		}
		for _, builder := range toolCallBuilders {
			logger.Debug("model tool call", "provider", "openai", "iter", iter, "name", builder.name, "args", truncate(builder.args.String(), 400))
		}
		for _, builder := range toolCallBuilders {
			tool, ok := toolByName[builder.name]
			if !ok {
				s.ch <- fmt.Sprintf("error: unknown tool %q", builder.name)
				return
			}
			result, execErr := tool.Execute(ctx, json.RawMessage(builder.args.String()))
			if execErr != nil {
				s.ch <- fmt.Sprintf("error: tool %q: %v", builder.name, execErr)
				return
			}
			content := toolResultText(result)
			logger.Debug("model tool result", "provider", "openai", "name", builder.name, "content", truncate(content, 400))
			s.messages = append(s.messages, openai.ToolMessage(content, builder.id))
		}
	}
}

type openaiToolCallBuilder struct {
	id   string
	name string
	args strings.Builder
}

// streamOnce runs one round-trip to the model. It streams text to Recv as it arrives
// and returns the accumulated text plus any tool-call deltas.
func (s *openaiSession) streamOnce(ctx context.Context) (string, []openai.ChatCompletionChunkChoiceDeltaToolCall, string, error) {
	params := openai.ChatCompletionNewParams{
		Model:    openai.ChatModel(s.model),
		Messages: s.messages,
	}
	if len(s.openaiTools) > 0 {
		params.Tools = s.openaiTools
	}
	stream := s.client.Chat.Completions.NewStreaming(ctx, params)
	var filter thinkFilter
	var textBuilder strings.Builder
	var toolCalls []openai.ChatCompletionChunkChoiceDeltaToolCall
	for stream.Next() {
		chunk := stream.Current()
		if len(chunk.Choices) == 0 {
			continue
		}
		choice := chunk.Choices[0]
		if choice.Delta.Content != "" {
			filtered := filter.Process(choice.Delta.Content)
			if filtered != "" {
				s.ch <- filtered
				textBuilder.WriteString(filtered)
			}
		}
		for _, tc := range choice.Delta.ToolCalls {
			toolCalls = append(toolCalls, tc)
		}
	}
	if flushed := filter.Flush(); flushed != "" {
		s.ch <- flushed
		textBuilder.WriteString(flushed)
	}
	if err := stream.Err(); err != nil {
		return "", nil, "", err
	}
	return textBuilder.String(), toolCalls, "", nil
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
