package models

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/thani-sh/provar/libs/logger"
)

const (
	maxTokens         = 4096
	eventContentStart = "content_block_start"
	eventContentDelta = "content_block_delta"
	eventContentStop  = "content_block_stop"
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

func (c *anthropicClient) CreateSession(ctx context.Context, systemPrompt string, tools ...ModelTool) (Session, error) {
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
	anthTools := make([]anthropic.ToolUnionParam, 0, len(tools))
	for _, t := range tools {
		var params map[string]any
		if err := json.Unmarshal(t.Parameters(), &params); err != nil {
			params = map[string]any{"type": "object"}
		}
		anthTools = append(anthTools, anthropic.ToolUnionParam{
			OfTool: &anthropic.ToolParam{
				Name:        t.Name(),
				Description: anthropic.String(t.Description()),
				InputSchema: anthropic.ToolInputSchemaParam{
					Properties: params,
				},
			},
		})
	}
	logger.Debug("model session", "provider", "anthropic", "model", c.model, "tools", len(tools))
	return &anthropicSession{
		client:       &client,
		model:        c.model,
		systemPrompt: systemPrompt,
		tools:        tools,
		anthTools:    anthTools,
		ch:           make(chan string, chanBuffer),
	}, nil
}

type anthropicSession struct {
	client       *anthropic.Client
	model        string
	systemPrompt string
	tools        []ModelTool
	anthTools    []anthropic.ToolUnionParam
	messages     []anthropic.MessageParam
	ch           chan string
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
	s.ch = make(chan string, chanBuffer)
	go s.runLoop(ctx)
	return nil
}

func (s *anthropicSession) Recv() <-chan string {
	return s.ch
}

func (s *anthropicSession) runLoop(ctx context.Context) {
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
		toolUses, textContent, err := s.streamOnce(ctx)
		if err != nil {
			return
		}
		var assistantBlocks []anthropic.ContentBlockParamUnion
		if textContent != "" {
			assistantBlocks = append(assistantBlocks, anthropic.NewTextBlock(textContent))
		}
		for _, tu := range toolUses {
			assistantBlocks = append(assistantBlocks, anthropic.NewToolUseBlock(tu.ID, json.RawMessage(tu.Args.String()), tu.Name))
		}
		s.messages = append(s.messages, anthropic.NewAssistantMessage(assistantBlocks...))
		if len(toolUses) == 0 {
			return
		}
		var resultBlocks []anthropic.ContentBlockParamUnion
		for _, tu := range toolUses {
			tool, ok := toolByName[tu.Name]
			if !ok {
				resultBlocks = append(resultBlocks, anthropic.NewToolResultBlock(tu.ID, "unknown tool "+tu.Name, true))
				continue
			}
			result, execErr := tool.Execute(ctx, json.RawMessage(tu.Args.String()))
			if execErr != nil {
				s.ch <- "error: tool \"" + tu.Name + "\": " + execErr.Error()
				return
			}
			resultBlocks = append(resultBlocks, anthropic.NewToolResultBlock(tu.ID, toolResultText(result), false))
		}
		s.messages = append(s.messages, anthropic.NewUserMessage(resultBlocks...))
	}
}

type anthropicToolUse struct {
	ID   string
	Name string
	Args strings.Builder
}

// streamOnce runs one round-trip to the model. It streams text to Recv as it arrives
// and returns the accumulated tool-use blocks plus the full text content.
func (s *anthropicSession) streamOnce(ctx context.Context) ([]anthropicToolUse, string, error) {
	params := anthropic.MessageNewParams{
		Model:     anthropic.Model(s.model),
		MaxTokens: maxTokens,
		Messages:  s.messages,
	}
	if s.systemPrompt != "" {
		params.System = []anthropic.TextBlockParam{
			{Text: s.systemPrompt},
		}
	}
	if len(s.anthTools) > 0 {
		params.Tools = s.anthTools
	}
	stream := s.client.Messages.NewStreaming(ctx, params)
	var filter thinkFilter
	var textBuilder strings.Builder
	var toolUses []anthropicToolUse
	activeByIndex := make(map[int64]*anthropicToolUse)
	for stream.Next() {
		event := stream.Current()
		switch event.Type {
		case eventContentStart:
			start := event.AsContentBlockStart()
			if start.ContentBlock.Type == "tool_use" {
				tu := &anthropicToolUse{
					ID:   start.ContentBlock.ID,
					Name: start.ContentBlock.Name,
				}
				toolUses = append(toolUses, anthropicToolUse{})
				activeByIndex[start.Index] = &toolUses[len(toolUses)-1]
				*activeByIndex[start.Index] = *tu
			}
		case eventContentDelta:
			delta := event.AsContentBlockDelta()
			switch delta.Delta.Type {
			case "text_delta":
				filtered := filter.Process(delta.Delta.Text)
				if filtered != "" {
					s.ch <- filtered
					textBuilder.WriteString(filtered)
				}
			case "input_json_delta":
				if tu, ok := activeByIndex[event.Index]; ok {
					tu.Args.WriteString(delta.Delta.PartialJSON)
				}
			}
		case eventContentStop:
			delete(activeByIndex, event.Index)
		}
	}
	if flushed := filter.Flush(); flushed != "" {
		s.ch <- flushed
		textBuilder.WriteString(flushed)
	}
	if err := stream.Err(); err != nil {
		return nil, "", err
	}
	return toolUses, textBuilder.String(), nil
}
