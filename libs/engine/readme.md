# Engine Package

The `engine` package compiles high-level test files into executable Lua scripts and executes those compiled scripts using an embedded Lua interpreter (`gopher-lua`) driving browser automation (`go-rod/rod`).

---

## File Formats

### 1. File: `login.test.yml`
The user writes the file as a YAML list of actions, each describing one user-intent step:
```yaml
- id: open_page
  name: Open Page
  info: Navigate to the login page of the application.
- id: fill_credentials
  name: Fill Credentials
  info: Enter the email and password in the login form.
- id: click_login
  name: Click Login
  info: Click the submit button to log in.
- id: verify_dashboard
  name: Verify Dashboard
  info: Verify that the dashboard is loaded successfully.
```

### 2. Compiled File: `login.test.lua`
The compiler outputs a Lua script mapping each action ID to concrete browser operations:
```lua
local actions = {}

function actions.open_page(page)
  page:navigate("{{BASE_URL}}/login")
end

function actions.fill_credentials(page)
  page:locator("input[name='email']"):fill("user@example.com")
  page:locator("input[name='password']"):fill("password123")
end

function actions.click_login(page)
  page:locator("button[type='submit']"):click()
end

function actions.verify_dashboard(page)
  page:locator(".dashboard-container"):waitFor()
end

return actions
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