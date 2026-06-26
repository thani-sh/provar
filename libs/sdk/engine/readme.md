# Engine Package

The `engine` package compiles high-level test specifications into executable Lua scripts and executes those compiled scripts using an embedded Lua interpreter (`gopher-lua`) driving browser automation (`go-rod/rod`).

---

## File Formats

### 1. Test Spec: `login.test.md`
The user writes the test spec as a clean Markdown list detailing the logical steps of the test flow:
```markdown
# Login Flow
Verifies that users can log in and redirect to the dashboard.

- **open_page**: Navigate to the login page of the application.
- **fill_credentials**: Enter the email and password in the login form.
- **click_login**: Click the submit button to log in.
- **verify_dashboard**: Verify that the dashboard is loaded successfully.
```

### 2. Compiled File: `login.test.lua`
The compiler outputs a separate Lua script mapping each list step ID to concrete browser actions:
```lua
local steps = {}

function steps.open_page(page)
  page:navigate("{{BASE_URL}}/login")
end

function steps.fill_credentials(page)
  page:locator("input[name='email']"):fill("user@example.com")
  page:locator("input[name='password']"):fill("password123")
end

function steps.click_login(page)
  page:locator("button[type='submit']"):click()
end

function steps.verify_dashboard(page)
  page:locator(".dashboard-container"):waitFor()
end

return steps
```

---

## Architecture & Boundaries

The package is split into two logical layers:
1. **Orchestrator (`engine`)**: Handles logical compilation via models/LLM, and execution state/pause/stop/event streams using standard Go types.
2. **Browser Execution Engine (`engine/browser`)**: Fully encapsulates all browser automation (`rod`) and script interpretation (`gopher-lua`). It exposes a pure Go boundary to the orchestrator, preventing any leak of internal scripting or driver types.

### Exposing APIs to Lua
The `browser` package registers the following metatable methods inside the Lua state:
- **`Page`**
  - `page:navigate(url)`: Navigates to the given URL and waits for load completion.
  - `page:locator(selector)`: Returns a new `Locator` instance for the selector.
- **`Locator`**
  - `locator:fill(value)`: Inputs the value into the field.
  - `locator:click()`: Clicks the element using left mouse click.
  - `locator:waitFor()`: Blocks until the element becomes visible.
