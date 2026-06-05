// hash: 731917a53c71f7b7fed1520b670d6fc716295167349f620c1d47d0c1ee00e9ab
import type { TestAPI } from "@libs/executor";

export const tasks = {
  ["task_init1"]: async (api: TestAPI) => {
    await api.page.goto(api.var.BASE_URL.replace("localhost", "127.0.0.1"));
    await api.expect(api.page.locator(".card-header")).toContainText("Login to Todo Demo");
  },
  ["task_logi1"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder("Username").fill("multitasker");
    await api.page.getByRole("button", { name: "Login / Register" }).click();
    await api.expect(api.page.locator("body")).toContainText("Logged in as multitasker");
  },
  ["task_crep1"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder("New List...").fill("Personal");
    await api.page.getByRole("button", { name: "Add List" }).click();
    await api.expect(api.page.locator(".list-item.active")).toHaveText("Personal");
  },
  ["task_amkl1"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder("What needs to be done?").fill("Buy groceries");
    await api.page.getByRole("button", { name: "Add Task" }).click();
    await api.expect(api.page.locator(".task-text")).toContainText("Buy groceries");
  },
  ["task_01bcy"]: async (api: TestAPI) => {
    await api.page.locator(".task-row").filter({ hasText: "Buy groceries" }).getByRole("checkbox").click();
    await api.expect(api.page.locator(".task-row").filter({ hasText: "Buy groceries" }).locator(".task-text.completed")).toBeVisible();
  },
  ["task_crew1"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder("New List...").fill("Work");
    await api.page.getByRole("button", { name: "Add List" }).click();
    await api.expect(api.page.locator(".list-item.active")).toHaveText("Work");
  },
  ["task_arpt1"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder("What needs to be done?").fill("Submit report");
    await api.page.getByRole("button", { name: "Add Task" }).click();
    await api.expect(api.page.locator(".task-text")).toContainText("Submit report");
  },
};

export const paths = [
  ["task_init1", "task_logi1", "task_crep1", "task_amkl1", "task_01bcy"],
  ["task_init1", "task_logi1", "task_crew1", "task_arpt1"],
];
