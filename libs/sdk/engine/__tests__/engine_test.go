//go:build integration

package __tests__

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/thani-sh/provar/libs/sdk/domain"
	"github.com/thani-sh/provar/libs/sdk/engine"
)

func TestRunner_Integration(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		fmt.Fprint(w, `
<!DOCTYPE html>
<html>
<body>
	<h1>Provar Mock Page</h1>
	<input type="text" name="email" id="email" />
	<button id="btn" onclick="document.body.innerHTML = '<h1>Logged In</h1>'">Login</button>
</body>
</html>
		`)
	}))
	defer server.Close()
	scenario := []domain.Action{
		{ID: "open_page", Name: "Open Page", Info: "Navigate to base URL"},
		{ID: "enter_email", Name: "Enter Email", Info: "Fill in the email input"},
		{ID: "click_login", Name: "Click Login", Info: "Click the login button"},
		{ID: "verify_success", Name: "Verify Success", Info: "Verify logged in header is visible"},
	}
	luaCode := `
local steps = {}

function steps.open_page(page)
	page:navigate("{{BASE_URL}}")
end

function steps.enter_email(page)
	page:locator("input[name='email']"):fill("test@provar.com")
end

function steps.click_login(page)
	page:locator("button#btn"):click()
end

function steps.verify_success(page)
	page:locator("h1"):waitFor()
end

return steps
`
	runner := engine.NewRunner()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	opts := engine.RunOptions{
		Headless: true,
		Vars: map[string]string{
			"BASE_URL": server.URL,
		},
	}
	job, err := runner.Run(ctx, scenario, luaCode, opts)
	if err != nil {
		t.Fatalf("failed to start runner: %v", err)
	}
	events := job.Subscribe()
	var (
		runStarted                bool
		runFinished               bool
		tasksStarted              = make(map[string]bool)
		tasksFinished             = make(map[string]bool)
		visualComparisonTriggered = make(map[string]bool)
	)
	for {
		select {
		case ev, ok := <-events:
			if !ok {
				t.Fatal("events channel closed unexpectedly")
			}
			switch ev.Type {
			case "run-started":
				runStarted = true
			case "task-started":
				data := ev.Data.(map[string]string)
				tasksStarted[data["taskId"]] = true
			case "task-finished":
				data := ev.Data.(map[string]string)
				tasksFinished[data["taskId"]] = true
			case "visual-comparison-triggered":
				data := ev.Data.(map[string]any)
				taskId := data["taskId"].(string)
				screenshot := data["screenshotBase64"].(string)
				if screenshot == "" {
					t.Errorf("expected screenshot data for task %s, got empty string", taskId)
				}
				visualComparisonTriggered[taskId] = true
			case "run-finished":
				runFinished = true
				if str, ok := ev.Data.(string); ok {
					t.Fatalf("run finished with error: %s", str)
				}
				data, ok := ev.Data.(map[string]any)
				if !ok {
					t.Fatalf("unexpected type for run-finished Data: %T (%+v)", ev.Data, ev.Data)
				}
				status := data["status"].(string)
				if status != string(domain.JobCompleted) {
					t.Errorf("expected job status %q, got %q", domain.JobCompleted, status)
				}
				return
			case "task-failed":
				if str, ok := ev.Data.(string); ok {
					t.Fatalf("task failed with error: %s", str)
				}
				data, ok := ev.Data.(map[string]string)
				if !ok {
					t.Fatalf("unexpected type for task-failed Data: %T (%+v)", ev.Data, ev.Data)
				}
				t.Fatalf("task %s failed: %s", data["taskId"], data["error"])
			}
		case <-ctx.Done():
			t.Fatal("timed out waiting for execution to finish")
		}
	}
	if !runStarted {
		t.Error("expected run-started event")
	}
	if !runFinished {
		t.Error("expected run-finished event")
	}
	for _, action := range scenario {
		if !tasksStarted[action.ID] {
			t.Errorf("expected task-started event for %s", action.ID)
		}
		if !tasksFinished[action.ID] {
			t.Errorf("expected task-finished event for %s", action.ID)
		}
		if !visualComparisonTriggered[action.ID] {
			t.Errorf("expected visual-comparison-triggered event for %s", action.ID)
		}
	}
}
