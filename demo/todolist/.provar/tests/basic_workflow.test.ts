// hash: 38d6efe7cf03b92edf2cf8e4a61f69a974270891ba2f25ee3d9e8b92586eeee6
import type { TestAPI } from "@libs/executor";

export const tasks = {
  ["action_init1"]: async (api: TestAPI) => {
    await api.page.goto(api.var.BASE_URL);
    await api.expect(api.page.locator('body')).toContainText("Login to Todo Demo");
  },
  ["action_logi1"]: async (api: TestAPI) => {
    await api.page.fill('input[placeholder="Username"]', "testuser");
    await api.page.click('button:has-text("Login / Register")');
    await api.expect(api.page.locator('body')).toContainText("Logged in as testuser");
  },
  ["action_clis1"]: async (api: TestAPI) => {
    await api.page.fill('input[placeholder="New List..."]', "Shopping");
    await api.page.click('button:has-text("Add List")');
    await api.expect(api.page.locator('h2')).toContainText("Shopping");
  },
  ["action_atask"]: async (api: TestAPI) => {
    await api.page.fill('input[placeholder="What needs to be done?"]', "Buy Milk");
    await api.page.click('button:has-text("Add Task")');
    await api.expect(api.page.locator('.task-text')).toContainText("Buy Milk");
  },
  ["action_compt"]: async (api: TestAPI) => {
    await api.page.click('.task-row:has-text("Buy Milk") .task-checkbox');
    await api.expect(api.page.locator('.task-row:has-text("Buy Milk") .task-checkbox')).toBeChecked();
  },
};

export const paths = [
  ["action_init1", "action_logi1", "action_clis1", "action_atask", "action_compt"],
];
