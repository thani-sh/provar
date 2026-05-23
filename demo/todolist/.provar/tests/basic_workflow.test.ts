// date: 2026-05-23T17:56:06.713Z
// hash: 88f116ef7e4bf281721650c2c6a21cda315eb5bed601a6852a7a68d6afc1b05d
import { test, action, expect, TestAPI } from "@libs/executor";

export const metadata = {
  name: "basic_workflow",
  info: "Simple login and task creation workflow"
};

const action_action_init1 = action({
  id: "action_init1",
  title: "open app",
  execute: async (api: TestAPI) => {
    await api.page.goto(api.var.BASE_URL);
  }
});

const action_action_logi1 = action({
  id: "action_logi1",
  title: "login",
  execute: async (api: TestAPI) => {
    await api.page.fill('input[placeholder="Username"]', "testuser");
    await api.page.click('button:has-text("Login / Register")');
  }
});

const action_action_clis1 = action({
  id: "action_clis1",
  title: "create list",
  execute: async (api: TestAPI) => {
    await api.page.fill('input[placeholder="New List..."]', "shopping");
    await api.page.click('button:has-text("Add List")');
  }
});

const action_action_atask = action({
  id: "action_atask",
  title: "add task",
  execute: async (api: TestAPI) => {
    await api.page.fill('input[placeholder="What needs to be done?"]', "buy milk");
    await api.page.click('button:has-text("Add Task")');
  }
});

const action_action_compt = action({
  id: "action_compt",
  title: "complete task",
  execute: async (api: TestAPI) => {
    await api.page.click('input[type="checkbox"]');
    const label = api.page.locator('span:has-text("Buy Milk")');
    await expect(label).toHaveClass(/completed/);
  }
});

export const tests = [
  test([action_action_init1, action_action_logi1, action_action_clis1, action_action_atask, action_action_compt]),
];
