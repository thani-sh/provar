package models

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/thani-sh/provar/libs/logger"
	"google.golang.org/genai"
)

const (
	roleUser  = "user"
	roleModel = "model"
)

type googleClient struct {
	apiKey  string
	baseURL string
	model   string
}

// NewGoogleClient creates a Client configured for Google Gemini.
func NewGoogleClient(apiKey string, baseURL string, model string) Client {
	return &googleClient{
		apiKey:  apiKey,
		baseURL: baseURL,
		model:   model,
	}
}

func (c *googleClient) CreateSession(ctx context.Context, systemPrompt string, tools ...ModelTool) (Session, error) {
	if c.model == "" {
		return nil, errModelRequired
	}
	if c.apiKey == "" {
		return nil, errAPIKeyRequired
	}
	cfg := &genai.ClientConfig{
		APIKey:  c.apiKey,
		Backend: genai.BackendGeminiAPI,
	}
	if c.baseURL != "" {
		cfg.HTTPOptions = genai.HTTPOptions{
			BaseURL: c.baseURL,
		}
	}
	client, err := genai.NewClient(ctx, cfg)
	if err != nil {
		return nil, err
	}
	logger.Debug("model session", "provider", "google", "model", c.model, "tools", len(tools))
	return &googleSession{
		client:       client,
		model:        c.model,
		systemPrompt: systemPrompt,
		tools:        tools,
		contents:     nil,
		ch:           make(chan string, chanBuffer),
	}, nil
}

type googleSession struct {
	client       *genai.Client
	model        string
	systemPrompt string
	tools        []ModelTool
	contents     []*genai.Content
	ch           chan string
}

func (s *googleSession) Send(ctx context.Context, attachments []Attachment) error {
	var parts []*genai.Part
	var textSnippets []string
	for _, a := range attachments {
		if a.Type == AttachmentTypeImage {
			parts = append(parts, &genai.Part{
				InlineData: &genai.Blob{
					Data:     a.Data,
					MIMEType: a.MIME,
				},
			})
		} else {
			parts = append(parts, &genai.Part{
				Text: a.Text,
			})
			textSnippets = append(textSnippets, truncate(a.Text, 400))
		}
	}
	s.contents = append(s.contents, &genai.Content{
		Role:  roleUser,
		Parts: parts,
	})
	if len(textSnippets) > 0 {
		logger.Debug("model input", "provider", "google", "texts", textSnippets)
	}
	s.ch = make(chan string, chanBuffer)
	go s.runLoop(ctx)
	return nil
}

func (s *googleSession) Recv() <-chan string {
	return s.ch
}

func (s *googleSession) runLoop(ctx context.Context) {
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
		modelParts, functionCalls, err := s.streamOnce(ctx)
		if err != nil {
			return
		}
		s.contents = append(s.contents, &genai.Content{
			Role:  roleModel,
			Parts: modelParts,
		})
		for _, p := range modelParts {
			if p.Text != "" {
				logger.Debug("model text", "provider", "google", "iter", iter, "len", len(p.Text), "snippet", truncate(p.Text, 400))
			}
		}
		for _, fc := range functionCalls {
			argsJSON, _ := json.Marshal(fc.Args)
			logger.Debug("model tool call", "provider", "google", "iter", iter, "name", fc.Name, "args", truncate(string(argsJSON), 400))
		}
		if len(functionCalls) == 0 {
			return
		}
		var responseParts []*genai.Part
		for _, fc := range functionCalls {
			tool, ok := toolByName[fc.Name]
			if !ok {
				responseParts = append(responseParts, &genai.Part{
					FunctionResponse: &genai.FunctionResponse{
						Name:     fc.Name,
						Response: map[string]any{"error": fmt.Sprintf("unknown tool %q", fc.Name)},
					},
				})
				continue
			}
			argsJSON, _ := json.Marshal(fc.Args)
			result, execErr := tool.Execute(ctx, json.RawMessage(argsJSON))
			if execErr != nil {
				s.ch <- fmt.Sprintf("error: tool %q: %v", fc.Name, execErr)
				return
			}
			content := toolResultText(result)
			logger.Debug("model tool result", "provider", "google", "name", fc.Name, "content", truncate(content, 400))
			responseParts = append(responseParts, &genai.Part{
				FunctionResponse: &genai.FunctionResponse{
					ID:   fc.ID,
					Name: fc.Name,
					Response: map[string]any{
						"content": content,
					},
				},
			})
		}
		s.contents = append(s.contents, &genai.Content{
			Role:  roleUser,
			Parts: responseParts,
		})
	}
}

// streamOnce runs one round-trip to the model. It streams text to Recv as it arrives
// and returns the full model content plus any function calls detected.
func (s *googleSession) streamOnce(ctx context.Context) ([]*genai.Part, []*genai.FunctionCall, error) {
	config := &genai.GenerateContentConfig{}
	if s.systemPrompt != "" {
		config.SystemInstruction = &genai.Content{
			Parts: []*genai.Part{{Text: s.systemPrompt}},
		}
	}
	if len(s.tools) > 0 {
		decls := make([]*genai.FunctionDeclaration, 0, len(s.tools))
		for _, t := range s.tools {
			var params map[string]any
			if err := json.Unmarshal(t.Parameters(), &params); err != nil {
				params = map[string]any{"type": "object"}
			}
			decls = append(decls, &genai.FunctionDeclaration{
				Name:                 t.Name(),
				Description:          t.Description(),
				ParametersJsonSchema: params,
			})
		}
		config.Tools = []*genai.Tool{{FunctionDeclarations: decls}}
	}
	stream := s.client.Models.GenerateContentStream(ctx, s.model, s.contents, config)
	var modelParts []*genai.Part
	var functionCalls []*genai.FunctionCall
	var filter thinkFilter
	for resp, err := range stream {
		if err != nil {
			return nil, nil, err
		}
		for _, candidate := range resp.Candidates {
			if candidate.Content == nil {
				continue
			}
			for _, part := range candidate.Content.Parts {
				modelParts = append(modelParts, part)
				if part.FunctionCall != nil {
					functionCalls = append(functionCalls, part.FunctionCall)
				}
				if part.Text != "" {
					filtered := filter.Process(part.Text)
					if filtered != "" {
						s.ch <- filtered
					}
				}
			}
		}
	}
	if flushed := filter.Flush(); flushed != "" {
		s.ch <- flushed
	}
	return modelParts, functionCalls, nil
}
