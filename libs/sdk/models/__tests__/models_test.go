//go:build integration

package __tests__

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/thani-sh/provar/libs/sdk/models"
)

const (
	testPrompt        = "Say 'hello' in reverse back to me in lower case"
	expectedSubstring = "olleh"
)

func TestOpenAIClient_Integration(t *testing.T) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		t.Skip("skipping OpenAI integration test; OPENAI_API_KEY is not set")
	}
	model := os.Getenv("OPENAI_API_MODEL")
	if model == "" {
		model = "gpt-5.4-mini"
	}
	baseURL := os.Getenv("OPENAI_API_URL")
	client, err := models.NewClient(models.OpenAI, apiKey, baseURL, model)
	if err != nil {
		t.Fatalf("failed to create OpenAI client: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	session, err := client.CreateSession(ctx, "")
	if err != nil {
		t.Fatalf("failed to create OpenAI session: %v", err)
	}
	err = session.Send(ctx, []models.Attachment{{Type: models.AttachmentTypeText, Text: testPrompt}})
	if err != nil {
		t.Fatalf("failed to send message to OpenAI: %v", err)
	}
	var response string
	for chunk := range session.Recv() {
		response += chunk
	}
	println(response)
	if !strings.Contains(response, expectedSubstring) {
		t.Errorf("expected response to contain %q, but got %q", expectedSubstring, response)
	}
}

func TestGoogleClient_Integration(t *testing.T) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		t.Skip("skipping Google integration test; GEMINI_API_KEY is not set")
	}
	model := os.Getenv("GEMINI_API_MODEL")
	if model == "" {
		model = "gemini-3.1-flash-lite"
	}
	client, err := models.NewClient(models.Google, apiKey, "", model)
	if err != nil {
		t.Fatalf("failed to create Google client: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	session, err := client.CreateSession(ctx, "")
	if err != nil {
		t.Fatalf("failed to create Google session: %v", err)
	}
	err = session.Send(ctx, []models.Attachment{{Type: models.AttachmentTypeText, Text: testPrompt}})
	if err != nil {
		t.Fatalf("failed to send message to Google: %v", err)
	}
	var response string
	for chunk := range session.Recv() {
		response += chunk
	}
	println(response)
	if !strings.Contains(response, expectedSubstring) {
		t.Errorf("expected response to contain %q, but got %q", expectedSubstring, response)
	}
}

func TestAnthropicClient_Integration(t *testing.T) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		t.Skip("skipping Anthropic integration test; ANTHROPIC_API_KEY is not set")
	}
	model := os.Getenv("ANTHROPIC_API_MODEL")
	if model == "" {
		model = "claude-haiku-4-5"
	}
	baseURL := os.Getenv("ANTHROPIC_API_URL")
	client, err := models.NewClient(models.Anthropic, apiKey, baseURL, model)
	if err != nil {
		t.Fatalf("failed to create Anthropic client: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	session, err := client.CreateSession(ctx, "")
	if err != nil {
		t.Fatalf("failed to create Anthropic session: %v", err)
	}
	err = session.Send(ctx, []models.Attachment{{Type: models.AttachmentTypeText, Text: testPrompt}})
	if err != nil {
		t.Fatalf("failed to send message to Anthropic: %v", err)
	}
	var response string
	for chunk := range session.Recv() {
		response += chunk
	}
	println(response)
	if !strings.Contains(response, expectedSubstring) {
		t.Errorf("expected response to contain %q, but got %q", expectedSubstring, response)
	}
}
