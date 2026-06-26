package models

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const (
	testPath            = "/chat/completions"
	headerContentType   = "Content-Type"
	contentTypeEvent    = "text/event-stream"
	headerCacheControl  = "Cache-Control"
	cacheControlNoCache = "no-cache"
	headerConnection    = "Connection"
	connectionKeepAlive = "keep-alive"
	mockKey             = "mock-key"
	mockModel           = "gpt-5.4-mini"
	testTimeout         = 2 * time.Second
	msgHi               = "Hi"
	msgHowAreYou        = "How are you?"
	expectedResponse    = "Hello world from mock"
	doneEvent           = "data: [DONE]\n\n"
	eventTemplate       = "data: %s\n\n"
)

var (
	mockChunks = []string{"Hello", " world", " from", " mock"}
)

func TestOpenAIClient_Streaming(t *testing.T) {
	var receivedMessages []map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != testPath {
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
		for _, chunk := range mockChunks {
			data := fmt.Sprintf(`{"choices":[{"delta":{"content":%q}}]}`, chunk)
			_, _ = fmt.Fprintf(w, eventTemplate, data)
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		}
		_, _ = fmt.Fprint(w, doneEvent)
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
	}))
	defer server.Close()
	client, err := NewClient(OpenAI, mockKey, server.URL, mockModel)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()
	session, err := client.CreateSession(ctx)
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	err = session.Send(ctx, msgHi)
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
	} else if receivedMessages[0]["content"] != msgHi {
		t.Errorf("expected history message %q, got %q", msgHi, receivedMessages[0]["content"])
	}
	err = session.Send(ctx, msgHowAreYou)
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
		if receivedMessages[0]["content"] != msgHi {
			t.Errorf("expected message 0 content %q, got %v", msgHi, receivedMessages[0]["content"])
		}
		if receivedMessages[1]["content"] != expectedResponse {
			t.Errorf("expected message 1 content %q, got %v", expectedResponse, receivedMessages[1]["content"])
		}
		if receivedMessages[2]["content"] != msgHowAreYou {
			t.Errorf("expected message 2 content %q, got %v", msgHowAreYou, receivedMessages[2]["content"])
		}
	}
}
