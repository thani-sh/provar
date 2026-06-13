// hash: d1f0f67ae0a37d2d5f0510fbbcfe18acc9d396a0d7ff14ad947d742c8f68645d
import type { TestAPI } from "@libs/engine";

export const tasks = {
  ["task_l1o2g"]: async (api: TestAPI) => {
    await api.page.goto(api.var.baseUrl);
    await api.page.locator('[data-testid="login-button"], [data-testid="open-login"], #login-btn, #login, button:has-text("Log In"), button:has-text("Sign In"), a:has-text("Log In"), a:has-text("Sign In")').first().click();
    await api.expect(api.page.locator('[data-testid="login-form"], [data-testid="auth-overlay"], form, [data-testid="username"], #username, input[type="email"], input[type="text"]').first()).toBeVisible();
  },
  ["task_l3b4d"]: async (api: TestAPI) => {
    await api.page.locator('input[placeholder="Username"]').fill(api.var.user.username);
    await api.page.locator('input[placeholder="Password"]').fill('wrong_password_123');
    await api.page.locator('button[type="submit"]').click();
    await api.expect(api.page.locator('body')).toContainText(/invalid|incorrect|error|failed/i);
  },
  ["task_l5c6e"]: async (api: TestAPI) => {
    await api.page.locator('input[placeholder="Username"]').fill(api.var.user.username);
    await api.page.locator('input[placeholder="Password"]').fill(api.var.user.password);
    await api.page.locator('button[type="submit"]').click();
    await api.expect(api.page.locator('input[placeholder="Username"]')).toBeHidden();
  },
  ["task_l7d8f"]: async (api: TestAPI) => {
    await api.page.locator('button:has-text("Profile")').click();
    await api.page.locator('button:has-text("Logout"), button:has-text("Log out"), button:has-text("Log Out")').click();
    await api.expect(api.page.locator('body')).toContainText('Global');
  },
};

export const paths = [
  ["task_l1o2g", "task_l3b4d", "task_l5c6e", "task_l7d8f"],
  ["task_l1o2g", "task_l5c6e", "task_l7d8f"],
];
