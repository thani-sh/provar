// date: 2026-05-23T18:17:28.198Z
// hash: 72008784e58281593278ad28ec169a3f58b81f5dd73806b825d6d20fba813be6
import { test, action, expect, TestAPI } from "@libs/executor";

export const metadata = {
  name: "task_variants",
  info: "Branching between Personal and Work tasks"
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
    await api.page.getByPlaceholder('Username').fill('multitasker');
    await api.page.getByRole('button', { name: 'Login / Register' }).click();
  }
});

const action_action_crep1 = action({
  id: "action_crep1",
  title: "create personal list",
  execute: async (api: TestAPI) => {
    await api.page.getByPlaceholder('New List...').fill('Personal');
    await api.page.getByRole('button', { name: 'Add List' }).click();
  }
});

const action_action_amkl1 = action({
  id: "action_amkl1",
  title: "add personal task",
  execute: async (api: TestAPI) => {
    await api.page.getByPlaceholder('What needs to be done?').fill('Buy groceries');
    await api.page.getByRole('button', { name: 'Add Task' }).click();
  }
});

const action_action_01bcy = action({
  id: "action_01bcy",
  title: "Mark it as done",
  execute: async (api: TestAPI) => {
    await api.page.locator('.task-card', { hasText: 'Buy groceries' }).getByRole('checkbox').check();
  }
});

const action_action_crew1 = action({
  id: "action_crew1",
  title: "create work list",
  execute: async (api: TestAPI) => {
    await api.page.getByPlaceholder('New List...').fill('Work');
    await api.page.getByRole('button', { name: 'Add List' }).click();
  }
});

const action_action_arpt1 = action({
  id: "action_arpt1",
  title: "add work task",
  execute: async (api: TestAPI) => {
    await api.page.getByPlaceholder('What needs to be done?').fill('Submit report');
    await api.page.getByRole('button', { name: 'Add Task' }).click();
  }
});

export const tests = [
  test([action_action_init1, action_action_logi1, action_action_crep1, action_action_amkl1, action_action_01bcy]),
  test([action_action_init1, action_action_logi1, action_action_crew1, action_action_arpt1]),
];
