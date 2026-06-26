package models

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const (
	headerContentType   = "Content-Type"
	contentTypeEvent    = "text/event-stream"
	headerCacheControl  = "Cache-Control"
	cacheControlNoCache = "no-cache"
	headerConnection    = "Connection"
	connectionKeepAlive = "keep-alive"
	mockKey             = "mock-key"
	testTimeout         = 2 * time.Second
	msgHi               = "Hi"
	msgHowAreYou        = "How are you?"
	expectedResponse    = "Hello world from mock"
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
	session, err := client.CreateSession(ctx)
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
	session, err := client.CreateSession(ctx)
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

func TestGoogleClient_Streaming(t *testing.T) {
	var receivedBody []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1beta/models/gemini-1.5-flash:streamGenerateContent" {
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
			data := fmt.Sprintf(`{"candidates": [{"content": {"parts": [{"text": %q}]}}]}`, chunk)
			_, _ = fmt.Fprintf(w, "data: %s\n\n", data)
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		}
	}))
	defer server.Close()
	client, err := NewClient(Google, mockKey, server.URL, "gemini-1.5-flash")
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()
	session, err := client.CreateSession(ctx)
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
		Contents []struct {
			Role  string `json:"role"`
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"contents"`
	}
	if err := json.Unmarshal(receivedBody, &reqObj); err != nil {
		t.Fatalf("failed to unmarshal request body: %v", err)
	}
	if len(reqObj.Contents) != 1 {
		t.Fatalf("expected 1 content block, got %d", len(reqObj.Contents))
	}
	if reqObj.Contents[0].Parts[0].Text != msgHi {
		t.Errorf("expected sent text to be %q, got %q", msgHi, reqObj.Contents[0].Parts[0].Text)
	}
}

func TestGoogleClient_ImageStreaming(t *testing.T) {
	var receivedBody []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1beta/models/gemini-1.5-flash:streamGenerateContent" {
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
			data := fmt.Sprintf(`{"candidates": [{"content": {"parts": [{"text": %q}]}}]}`, chunk)
			_, _ = fmt.Fprintf(w, "data: %s\n\n", data)
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		}
	}))
	defer server.Close()
	client, err := NewClient(Google, mockKey, server.URL, "gemini-1.5-flash")
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()
	session, err := client.CreateSession(ctx)
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
	var respText string
	for chunk := range session.Recv() {
		respText += chunk
	}
	if respText != expectedResponse {
		t.Errorf("expected response %q, got %q", expectedResponse, respText)
	}
	var reqObj struct {
		Contents []struct {
			Role  string `json:"role"`
			Parts []struct {
				InlineData *struct {
					Data     string `json:"data"`
					MimeType string `json:"mimeType"`
				} `json:"inlineData"`
			} `json:"parts"`
		} `json:"contents"`
	}
	if err := json.Unmarshal(receivedBody, &reqObj); err != nil {
		t.Fatalf("failed to unmarshal request body: %v", err)
	}
	if len(reqObj.Contents) != 1 {
		t.Fatalf("expected 1 content block, got %d", len(reqObj.Contents))
	}
	parts := reqObj.Contents[0].Parts
	if len(parts) != 1 {
		t.Fatalf("expected 1 part, got %d", len(parts))
	}
	if parts[0].InlineData == nil {
		t.Fatal("expected part 0 to have inline data")
	}
	if parts[0].InlineData.MimeType != "image/png" {
		t.Errorf("expected mimeType 'image/png', got %q", parts[0].InlineData.MimeType)
	}
	if parts[0].InlineData.Data != "ZmFrZS1pbWFnZS1ieXRlcw==" {
		t.Errorf("expected base64 data 'ZmFrZS1pbWFnZS1ieXRlcw==', got %q", parts[0].InlineData.Data)
	}
}

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
	session, err := client.CreateSession(ctx)
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
	session, err := client.CreateSession(ctx)
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
	var respText string
	for chunk := range session.Recv() {
		respText += chunk
	}
	if respText != expectedResponse {
		t.Errorf("expected response %q, got %q", expectedResponse, respText)
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

func TestThinkFilter(t *testing.T) {
	tests := []struct {
		name     string
		chunks   []string
		expected string
	}{
		{
			name:     "no thinking tags",
			chunks:   []string{"hello", " world"},
			expected: "hello world",
		},
		{
			name:     "thinking tags in single chunk",
			chunks:   []string{"hello <think>thinking process</think> world"},
			expected: "hello  world",
		},
		{
			name:     "thinking tags split across chunks",
			chunks:   []string{"hello <th", "ink>thinking</thi", "nk> world"},
			expected: "hello  world",
		},
		{
			name:     "unclosed thinking tag",
			chunks:   []string{"hello <think>thinking"},
			expected: "hello ",
		},
		{
			name:     "multiple thinking tags",
			chunks:   []string{"a <think>b</think> c <think>d</think> e"},
			expected: "a  c  e",
		},
	}
	for _, tc := range tests {
		var filter thinkFilter
		var res string
		for _, chunk := range tc.chunks {
			res += filter.Process(chunk)
		}
		res += filter.Flush()
		if res != tc.expected {
			t.Errorf("%s: expected %q, got %q", tc.name, tc.expected, res)
		}
	}
}
