# Sample Provar project — Todo App

This is the **bundled sample project** that the Provar editor offers on the empty-state screen
and that the end-user guide's quickstart walks through. It exists so a brand-new user can go from
"just installed the app" to "ran my first passing test" against a real local web app, with no
configuration.

## What it contains

- `.provar/config.yml` — sample variables, including a `baseUrl` and a test user.
- `.provar/tests/auth/login-flow.test.yml` — a 5-step graph: open the login form, sign in,
  create a todo, mark it done, sign out.
- `.provar/screenshots/` — placeholder directory for visual baselines (empty by default; the
  editor populates it on first accepted run).

## How to use it

1. Open the Provar editor with no project loaded. The empty-state screen offers
   **Create a sample project** — pick a destination folder, and the editor copies this directory
   there, opens it, and prompts for an LLM API key.
2. After the project is open, the editor pre-selects `login-flow.test.yml`. Hit the Run button
   (▶) to compile and execute the test against the target app.
3. On the first run, every step has no baseline — the editor will record new snapshots and ask
   you to accept them. Subsequent runs compare against those baselines.

## Replacing the sample

This is a **sample**, not a template. Once you have a passing run, replace:

- `variables.baseUrl` in `.provar/config.yml` with your own app's URL.
- The test user credentials in the same file.
- The 5 steps in `login-flow.test.yml` with steps that match your real user journey.

The structure (`.provar/config.yml` + `.provar/tests/**/*.test.yml` + `.provar/screenshots/`) is
the same in every Provar project.

## Screenshot placeholder

Until the real editor screenshot is captured, the project is illustrated in the docs with
`docs/imgs/screenshot.png`. See `docs/PRODUCT.md` § 9 for the screenshot convention.
