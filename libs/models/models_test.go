package models

import (
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
