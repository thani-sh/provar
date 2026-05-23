// date: 2026-05-23T18:30:38.022Z
// hash: c8234a6ccf2f714eb3ce36247ac9e08c87e84c1f4f5fe57258e8a28654f1bf98
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
    await api.page.getByPlaceholder('Username').fill('testuser');
    await api.page.getByRole('button', { name: 'Login / Register' }).click();
  }
});

const action_action_clis1 = action({
  id: "action_clis1",
  title: "create list",
  execute: async (api: TestAPI) => {
    await api.page.getByPlaceholder('New List...').fill('Shopping');
    await api.page.getByRole('button', { name: 'Add List' }).click();
  }
});

const action_action_atask = action({
  id: "action_atask",
  title: "add task",
  execute: async (api: TestAPI) => {
    await api.page.getByPlaceholder('What needs to be done?').fill('Buy Milk');
    await api.page.getByRole('button', { name: 'Add Task' }).click();
  }
});

const action_action_compt = action({
  id: "action_compt",
  title: "complete task",
  execute: async (api: TestAPI) => {
    const task = api.page.locator('.task-row', { hasText: 'Buy Milk' });
    await task.getByRole('checkbox').click();
    await expect(task.locator('.task-text')).toHaveClass(/completed/);
  }
});

export const tests = [
  test([action_action_init1, action_action_logi1, action_action_clis1, action_action_atask, action_action_compt]),
];
