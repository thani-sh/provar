// hash: d1f0f67ae0a37d2d5f0510fbbcfe18acc9d396a0d7ff14ad947d742c8f68645d
import type { TestAPI } from "@libs/engine";

export const tasks = {
  ["task_l1o2g"]: async (api: TestAPI) => {
    await api.page.goto(api.var.baseUrl);
    
    await api.page.locator('button:has-text("Sign In"), button:has-text("Account")').filter({ visible: true }).first().click();
    
    await api.expect(api.page.locator('input[placeholder="Username"]')).toBeVisible();
    await api.expect(api.page.locator('input[placeholder="Password"]')).toBeVisible();
  },
  ["task_l3b4d"]: async (api: TestAPI) => {
    await api.page.locator('input[placeholder="Username"]').fill(api.var.user.username);
    await api.page.locator('input[placeholder="Password"]').fill('wrong_password');
    await api.page.locator('button:has-text("Sign In")').click();
    await api.expect(api.page.locator('body')).toContainText(/invalid|error|incorrect/i);
  },
  ["task_l5c6e"]: async (api: TestAPI) => {
    await api.page.locator('input[placeholder="Username"]').fill(api.var.user.username);
    await api.page.locator('input[placeholder="Password"]').fill(api.var.user.password);
    await api.page.locator('button:has-text("Sign In")').click();
    
    await api.expect(api.page.locator('#post-composer-textarea')).toBeVisible();
    await api.expect(api.page.locator('body')).toContainText("No thoughts in your feed");
  },
  ["task_l7d8f"]: async (api: TestAPI) => {
    await api.page.locator('button:has-text("Profile"), button:has-text("Account")').filter({ visible: true }).first().click();
    
    await api.page.locator('button:has-text("Logout"), button:has-text("Log out"), button:has-text("Sign Out")').filter({ visible: true }).first().click();
    
    await api.expect(api.page.locator('button:has-text("Sign In"), button:has-text("Account")').filter({ visible: true }).first()).toContainText('Sign In');
  },
};

export const paths = [
  ["task_l1o2g", "task_l3b4d", "task_l5c6e", "task_l7d8f"],
  ["task_l1o2g", "task_l5c6e", "task_l7d8f"],
];
