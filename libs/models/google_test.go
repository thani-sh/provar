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
		Contents []struct {
			Role  string `json:"role"`
			Parts []struct {
				InlineData *struct {
					MIMEType string `json:"mimeType"`
					Data     string `json:"data"`
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
	inline := parts[0].InlineData
	if inline == nil {
		t.Fatal("expected inlineData to be set")
	}
	if inline.MIMEType != "image/png" || inline.Data != "ZmFrZS1pbWFnZS1ieXRlcw==" {
		t.Errorf("expected image/png and base64 data, got %+v", inline)
	}
}

func TestGoogleClient_SystemPrompt(t *testing.T) {
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
		_, _ = fmt.Fprint(w, "data: {\"candidates\": [{\"content\": {\"parts\": [{\"text\": \"Response\"}]}}]}\n\n")
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
	}))
	defer server.Close()
	client, err := NewClient(Google, mockKey, server.URL, "gemini-1.5-flash")
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
	defer cancel()
	sysPrompt := "Steer responses strictly"
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
		SystemInstruction struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"systemInstruction"`
	}
	if err := json.Unmarshal(receivedBody, &reqObj); err != nil {
		t.Fatalf("failed to unmarshal request: %v", err)
	}
	if len(reqObj.SystemInstruction.Parts) != 1 || reqObj.SystemInstruction.Parts[0].Text != sysPrompt {
		t.Errorf("expected systemInstruction to contain %q, got %+v", sysPrompt, reqObj.SystemInstruction)
	}
}
