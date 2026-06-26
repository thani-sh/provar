package models

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAnthropicClient_Streaming(t *testing.T) {
	var receivedBody []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/messages" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		var err error
		receivedBody, err = io.ReadAll(r.Body)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.Header().Set(headerContentType, contentTypeEvent)
		w.Header().Set(headerCacheControl, cacheControlNoCache)
		w.Header().Set(headerConnection, connectionKeepAlive)
		w.WriteHeader(http.StatusOK)
		mockChunks := []string{"Hello", " world", " from", " mock"}
		for _, chunk := range mockChunks {
			_, _ = fmt.Fprint(w, "event: content_block_delta\n")
			_, _ = fmt.Fprintf(w, "data: {\"type\": \"content_block_delta\", \"index\": 0, \"delta\": {\"type\": \"text_delta\", \"text\": %q}}\n\n", chunk)
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		}
	}))
	defer server.Close()
	client, err := NewClient(Anthropic, mockKey, server.URL, "claude-3-5-sonnet")
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
	var reqObj struct {
		Messages []struct {
			Role    string `json:"role"`
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text,omitempty"`
			} `json:"content"`
		} `json:"messages"`
	}
	if err := json.Unmarshal(receivedBody, &reqObj); err != nil {
		t.Fatalf("failed to unmarshal request body: %v", err)
	}
	if len(reqObj.Messages) != 1 {
		t.Fatalf("expected 1 message, got %d", len(reqObj.Messages))
	}
	content := reqObj.Messages[0].Content
	if len(content) != 1 {
		t.Fatalf("expected 1 content block, got %d", len(content))
	}
	if content[0].Type != "text" || content[0].Text != msgHi {
		t.Errorf("expected text content %q, got %+v", msgHi, content[0])
	}
}

func TestAnthropicClient_ImageStreaming(t *testing.T) {
	var receivedBody []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/messages" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		var err error
		receivedBody, err = io.ReadAll(r.Body)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.Header().Set(headerContentType, contentTypeEvent)
		w.Header().Set(headerCacheControl, cacheControlNoCache)
		w.Header().Set(headerConnection, connectionKeepAlive)
		w.WriteHeader(http.StatusOK)
		mockChunks := []string{"Hello", " world", " from", " mock"}
		for _, chunk := range mockChunks {
			_, _ = fmt.Fprint(w, "event: content_block_delta\n")
			_, _ = fmt.Fprintf(w, "data: {\"type\": \"content_block_delta\", \"index\": 0, \"delta\": {\"type\": \"text_delta\", \"text\": %q}}\n\n", chunk)
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		}
	}))
	defer server.Close()
	client, err := NewClient(Anthropic, mockKey, server.URL, "claude-3-5-sonnet")
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
		t.Fatalf("failed to send: %v", err)
	}
	var turnResp string
	for chunk := range session.Recv() {
		turnResp += chunk
	}
	if turnResp != expectedResponse {
		t.Errorf("expected response %q, got %q", expectedResponse, turnResp)
	}
	var reqObj struct {
		Messages []struct {
			Role    string `json:"role"`
			Content []struct {
				Type   string `json:"type"`
				Source *struct {
					Type      string `json:"type"`
					MediaType string `json:"media_type"`
					Data      string `json:"data"`
				} `json:"source,omitempty"`
			} `json:"content"`
		} `json:"messages"`
	}
	if err := json.Unmarshal(receivedBody, &reqObj); err != nil {
		t.Fatalf("failed to unmarshal request body: %v", err)
	}
	if len(reqObj.Messages) != 1 {
		t.Fatalf("expected 1 message, got %d", len(reqObj.Messages))
	}
	content := reqObj.Messages[0].Content
	if len(content) != 1 {
		t.Fatalf("expected 1 content block, got %d", len(content))
	}
	if content[0].Type != "image" {
		t.Errorf("expected content block 0 to be type 'image', got %+v", content[0])
	}
	src := content[0].Source
	if src == nil {
		t.Fatal("expected content block 0 to have source")
	}
	if src.Type != "base64" || src.MediaType != "image/png" || src.Data != "ZmFrZS1pbWFnZS1ieXRlcw==" {
		t.Errorf("expected source fields type 'base64', mediaType 'image/png' and base64 data, got %+v", src)
	}
}

func TestAnthropicClient_SystemPrompt(t *testing.T) {
	var receivedBody []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/messages" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		var err error
		receivedBody, err = io.ReadAll(r.Body)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.Header().Set(headerContentType, contentTypeEvent)
		w.Header().Set(headerCacheControl, cacheControlNoCache)
		w.Header().Set(headerConnection, connectionKeepAlive)
		w.WriteHeader(http.StatusOK)
		_, _ = fmt.Fprint(w, "event: content_block_delta\ndata: {\"type\": \"content_block_delta\", \"index\": 0, \"delta\": {\"type\": \"text_delta\", \"text\": \"Response\"}}\n\n")
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
	}))
	defer server.Close()
	client, err := NewClient(Anthropic, mockKey, server.URL, "claude-3-5-sonnet")
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()
	sysPrompt := "Act as a helpful helper"
	session, err := client.CreateSession(ctx, sysPrompt)
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	err = session.Send(ctx, []Attachment{{Type: AttachmentTypeText, Text: msgHi}})
	if err != nil {
		t.Fatalf("failed to send: %v", err)
	}
	for range session.Recv() {
	}
	var reqObj struct {
		System []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"system"`
	}
	if err := json.Unmarshal(receivedBody, &reqObj); err != nil {
		t.Fatalf("failed to unmarshal request: %v", err)
	}
	if len(reqObj.System) != 1 || reqObj.System[0].Text != sysPrompt || reqObj.System[0].Type != "text" {
		t.Errorf("expected system block to contain %q, got %+v", sysPrompt, reqObj.System)
	}
}
