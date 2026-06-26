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
	apiKey string
	model  string
}

// NewGoogleClient creates a Client configured for Google Gemini.
func NewGoogleClient(apiKey string, model string) Client {
	return &googleClient{
		apiKey: apiKey,
		model:  model,
	}
}

func (c *googleClient) CreateSession(ctx context.Context) (Session, error) {
	if c.model == "" {
		return nil, errModelRequired
	}
	if c.apiKey == "" {
		return nil, errAPIKeyRequired
	}
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  c.apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, err
	}
	return &googleSession{
		client: client,
		model:  c.model,
		ch:     make(chan string, chanBuffer),
	}, nil
}

type googleSession struct {
	client   *genai.Client
	model    string
	contents []*genai.Content
	ch       chan string
}

func (s *googleSession) Send(ctx context.Context, message string) error {
	userContent := &genai.Content{
		Role: roleUser,
		Parts: []*genai.Part{
			{Text: message},
		},
	}
	s.contents = append(s.contents, userContent)
	stream := s.client.Models.GenerateContentStream(ctx, s.model, s.contents, nil)
	s.ch = make(chan string, chanBuffer)
	go func() {
		defer close(s.ch)
		var fullContent string
		for resp, err := range stream {
			if err != nil {
				return
			}
			for _, candidate := range resp.Candidates {
				if candidate.Content != nil {
					for _, part := range candidate.Content.Parts {
						s.ch <- part.Text
						fullContent += part.Text
					}
				}
			}
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
