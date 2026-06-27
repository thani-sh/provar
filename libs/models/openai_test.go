package models

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOpenAIClient_Streaming(t *testing.T) {
	var receivedMessages []map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		var req struct {
			Model    string                   `json:"model"`
			Messages []map[string]interface{} `json:"messages"`
			Stream   bool                     `json:"stream"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		receivedMessages = req.Messages
		w.Header().Set(headerContentType, contentTypeEvent)
		w.Header().Set(headerCacheControl, cacheControlNoCache)
		w.Header().Set(headerConnection, connectionKeepAlive)
		w.WriteHeader(http.StatusOK)
		mockChunks := []string{"Hello", " world", " from", " mock"}
		for _, chunk := range mockChunks {
			data := fmt.Sprintf(`{"choices":[{"delta":{"content":%q}}]}`, chunk)
			_, _ = fmt.Fprintf(w, "data: %s\n\n", data)
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		}
		_, _ = fmt.Fprint(w, "data: [DONE]\n\n")
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
	}))
	defer server.Close()
	client, err := NewClient(OpenAI, mockKey, server.URL, "gpt-4")
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()
	session, err := client.CreateSession(ctx, "")
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	err = session.Send(ctx, []Attachment{{Type: AttachmentTypeText, Text: msgHi}})
	if err != nil {
		t.Fatalf("failed to send first message: %v", err)
	}
	var turn1Resp string
	for chunk := range session.Recv() {
		turn1Resp += chunk
	}
	if turn1Resp != expectedResponse {
		t.Errorf("expected response %q, got %q", expectedResponse, turn1Resp)
	}
	if len(receivedMessages) != 1 {
		t.Errorf("expected 1 message in history, got %d", len(receivedMessages))
	} else {
		parts, ok := receivedMessages[0]["content"].([]interface{})
		if !ok || len(parts) != 1 {
			t.Errorf("expected content parts to be a slice of 1, got %+v", receivedMessages[0]["content"])
		} else {
			part, ok := parts[0].(map[string]interface{})
			if !ok || part["text"] != msgHi || part["type"] != "text" {
				t.Errorf("expected history part to be text %q, got %+v", msgHi, parts[0])
			}
		}
	}
	err = session.Send(ctx, []Attachment{{Type: AttachmentTypeText, Text: msgHowAreYou}})
	if err != nil {
		t.Fatalf("failed to send second message: %v", err)
	}
	var turn2Resp string
	for chunk := range session.Recv() {
		turn2Resp += chunk
	}
	if turn2Resp != expectedResponse {
		t.Errorf("expected response %q, got %q", expectedResponse, turn2Resp)
	}
	if len(receivedMessages) != 3 {
		t.Errorf("expected 3 messages in history, got %d", len(receivedMessages))
	} else {
		parts0, ok0 := receivedMessages[0]["content"].([]interface{})
		if !ok0 || len(parts0) != 1 {
			t.Errorf("expected message 0 content to have 1 part")
		} else {
			part, ok := parts0[0].(map[string]interface{})
			if !ok || part["text"] != msgHi {
				t.Errorf("expected message 0 content %q, got %+v", msgHi, parts0[0])
			}
		}
		if receivedMessages[1]["content"] != expectedResponse {
			t.Errorf("expected message 1 content %q, got %v", expectedResponse, receivedMessages[1]["content"])
		}
		parts2, ok2 := receivedMessages[2]["content"].([]interface{})
		if !ok2 || len(parts2) != 1 {
			t.Errorf("expected message 2 content to have 1 part")
		} else {
			part, ok := parts2[0].(map[string]interface{})
			if !ok || part["text"] != msgHowAreYou {
				t.Errorf("expected message 2 content %q, got %+v", msgHowAreYou, parts2[0])
			}
		}
	}
}

func TestOpenAIClient_ImageStreaming(t *testing.T) {
	var receivedMessages []map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		var req struct {
			Model    string                   `json:"model"`
			Messages []map[string]interface{} `json:"messages"`
			Stream   bool                     `json:"stream"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		receivedMessages = req.Messages
		w.Header().Set(headerContentType, contentTypeEvent)
		w.Header().Set(headerCacheControl, cacheControlNoCache)
		w.Header().Set(headerConnection, connectionKeepAlive)
		w.WriteHeader(http.StatusOK)
		mockChunks := []string{"Hello", " world", " from", " mock"}
		for _, chunk := range mockChunks {
			data := fmt.Sprintf(`{"choices":[{"delta":{"content":%q}}]}`, chunk)
			_, _ = fmt.Fprintf(w, "data: %s\n\n", data)
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		}
		_, _ = fmt.Fprint(w, "data: [DONE]\n\n")
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
	}))
	defer server.Close()
	client, err := NewClient(OpenAI, mockKey, server.URL, "gpt-4")
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()
	session, err := client.CreateSession(ctx, "")
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	err = session.Send(ctx, []Attachment{
		{
			Type: AttachmentTypeImage,
			Data: []byte("fake-image-bytes"),
			MIME: "image/png",
		},
	})
	if err != nil {
		t.Fatalf("failed to send image message: %v", err)
	}
	var turnResp string
	for chunk := range session.Recv() {
		turnResp += chunk
	}
	if turnResp != expectedResponse {
		t.Errorf("expected response %q, got %q", expectedResponse, turnResp)
	}
	if len(receivedMessages) != 1 {
		t.Errorf("expected 1 message in history, got %d", len(receivedMessages))
	} else {
		contentParts, ok := receivedMessages[0]["content"].([]interface{})
		if !ok || len(contentParts) != 1 {
			t.Errorf("expected content parts to be a slice of size 1, got %+v", receivedMessages[0]["content"])
		} else {
			part, ok := contentParts[0].(map[string]interface{})
			if !ok {
				t.Fatalf("expected content part to be a map, got %+v", contentParts[0])
			}
			if part["type"] != "image_url" {
				t.Errorf("expected part type to be 'image_url', got %q", part["type"])
			}
			imgURL, ok := part["image_url"].(map[string]interface{})
			if !ok {
				t.Fatalf("expected image_url to be a map, got %+v", part["image_url"])
			}
			expectedURL := "data:image/png;base64,ZmFrZS1pbWFnZS1ieXRlcw=="
			if imgURL["url"] != expectedURL {
				t.Errorf("expected image url %q, got %q", expectedURL, imgURL["url"])
			}
		}
	}
}

func TestOpenAIClient_SystemPrompt(t *testing.T) {
	var receivedMessages []map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		var req struct {
			Model    string                   `json:"model"`
			Messages []map[string]interface{} `json:"messages"`
			Stream   bool                     `json:"stream"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		receivedMessages = req.Messages
		w.Header().Set(headerContentType, contentTypeEvent)
		w.Header().Set(headerCacheControl, cacheControlNoCache)
		w.Header().Set(headerConnection, connectionKeepAlive)
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"Response\"}}]}\n\n")
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
		_, _ = fmt.Fprint(w, "data: [DONE]\n\n")
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
	}))
	defer server.Close()
	client, err := NewClient(OpenAI, mockKey, server.URL, "gpt-4")
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()
	sysPrompt := "You are a coding assistant"
	session, err := client.CreateSession(ctx, sysPrompt)
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	err = session.Send(ctx, []Attachment{{Type: AttachmentTypeText, Text: msgHi}})
	if err != nil {
		t.Fatalf("failed to send message: %v", err)
	}
	for range session.Recv() {
	}
	if len(receivedMessages) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(receivedMessages))
	}
	if receivedMessages[0]["role"] != "system" || receivedMessages[0]["content"] != sysPrompt {
		t.Errorf("expected system message to have role 'system' and content %q, got %+v", sysPrompt, receivedMessages[0])
	}
	if receivedMessages[1]["role"] != "user" {
		t.Errorf("expected second message to have role 'user', got %+v", receivedMessages[1])
	}
}
