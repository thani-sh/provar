package models

import (
	"context"

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

func (c *googleClient) CreateSession(ctx context.Context, systemPrompt string) (Session, error) {
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
	return &googleSession{
		client:       client,
		model:        c.model,
		systemPrompt: systemPrompt,
		ch:           make(chan string, chanBuffer),
	}, nil
}

type googleSession struct {
	client       *genai.Client
	model        string
	systemPrompt string
	contents     []*genai.Content
	ch           chan string
}

func (s *googleSession) Send(ctx context.Context, attachments []Attachment) error {
	var parts []*genai.Part
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
		}
	}
	userContent := &genai.Content{
		Role:  roleUser,
		Parts: parts,
	}
	s.contents = append(s.contents, userContent)
	var config *genai.GenerateContentConfig
	if s.systemPrompt != "" {
		config = &genai.GenerateContentConfig{
			SystemInstruction: &genai.Content{
				Parts: []*genai.Part{
					{Text: s.systemPrompt},
				},
			},
		}
	}
	stream := s.client.Models.GenerateContentStream(ctx, s.model, s.contents, config)
	s.ch = make(chan string, chanBuffer)
	go func() {
		defer close(s.ch)
		var filter thinkFilter
		var fullContent string
		for resp, err := range stream {
			if err != nil {
				return
			}
			for _, candidate := range resp.Candidates {
				if candidate.Content != nil {
					for _, part := range candidate.Content.Parts {
						filtered := filter.Process(part.Text)
						if filtered != "" {
							s.ch <- filtered
							fullContent += filtered
						}
					}
				}
			}
		}
		flushed := filter.Flush()
		if flushed != "" {
			s.ch <- flushed
			fullContent += flushed
		}
		modelContent := &genai.Content{
			Role: roleModel,
			Parts: []*genai.Part{
				{Text: fullContent},
			},
		}
		s.contents = append(s.contents, modelContent)
	}()
	return nil
}

func (s *googleSession) Recv() <-chan string {
	return s.ch
}
