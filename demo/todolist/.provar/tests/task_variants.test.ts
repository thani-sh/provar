// date: 2026-05-23T10:13:03.880Z
// hash: 2090f141f57f907f2c67c78b05d9dd80ceee14d374e65db4846a3959e6b09360
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
    await api.page.fill('input[placeholder="Username"]', "multitasker");
    await api.page.click('button:has-text("Login / Register")');
  }
});

const action_action_crep1 = action({
  id: "action_crep1",
  title: "create personal list",
  execute: async (api: TestAPI) => {
    await api.page.fill('input[placeholder="New List..."]', "Personal");
    await api.page.click('button:has-text("Add List")');
  }
});

const action_action_amkl1 = action({
  id: "action_amkl1",
  title: "add personal task",
  execute: async (api: TestAPI) => {
    await api.page.fill('input[placeholder="What needs to be done?"]', "buy groceries");
    await api.page.click('button:has-text("Add Task")');
  }
});

const action_action_crew1 = action({
  id: "action_crew1",
  title: "create work list",
  execute: async (api: TestAPI) => {
    await api.page.fill('input[placeholder="New List..."]', "Work");
    await api.page.click('button:has-text("Add List")');
  }
});

const action_action_arpt1 = action({
  id: "action_arpt1",
  title: "add work task",
  execute: async (api: TestAPI) => {
    await api.page.fill('input[placeholder="What needs to be done?"]', "submit report");
    await api.page.click('button:has-text("Add Task")');
  }
});

export const tests = [
  test([action_action_init1, action_action_logi1, action_action_crep1, action_action_amkl1]),
  test([action_action_init1, action_action_logi1, action_action_crew1, action_action_arpt1]),
];
