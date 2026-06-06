// hash: 138b9e9126eea90fe4a7b7bdc5acbaaddb54f3f03a05c7ec8df38b729b6995d5
import type { TestAPI } from "@libs/executor";

export const tasks = {
  ["task_init1"]: async (api: TestAPI) => {
    await api.page.goto(api.var.BASE_URL);
    await api.expect(api.page.locator('body')).toBeVisible();
  },
  ["task_logi1"]: async (api: TestAPI) => {
    await api.page.locator('.input').fill('multitasker');
    await api.page.locator('.btn-primary').click();
  },
  ["task_crep1"]: async (api: TestAPI) => {
    const listInput = api.page.locator('.sidebar-input');
    await listInput.fill('Personal');
    await api.page.locator('.sidebar-footer button').click();
    await api.expect(api.page.locator('.list-item').getByText('Personal').first()).toBeVisible();
  },
  ["task_amkl1"]: async (api: TestAPI) => {
    await api.page.locator('.add-task .input').fill('Buy groceries');
    await api.page.locator('.add-task .btn-primary').click();
    await api.expect(api.page.locator('.task-text').getByText('Buy groceries')).toBeVisible();
  },
  ["task_01bcy"]: async (api: TestAPI) => {
    const checkbox = api.page.locator('.task-row', { hasText: 'Buy groceries' }).locator('.task-checkbox');
    await checkbox.click();
    await api.expect(checkbox).toBeChecked();
  },
  ["task_crew1"]: async (api: TestAPI) => {
    const listInput = api.page.locator('.sidebar-input');
    await listInput.fill('Work');
    await api.page.locator('.sidebar-footer button').click();
    await api.expect(api.page.locator('.list-item').getByText('Work').first()).toBeVisible();
  },
  ["task_arpt1"]: async (api: TestAPI) => {
    await api.page.locator('.list-item').getByText('Work').first().click();
    await api.page.locator('.add-task .input').fill('Submit report');
    await api.page.locator('.add-task .btn-primary').click();
    await api.expect(api.page.locator('.task-text').getByText('Submit report')).toBeVisible();
  },
};

export const paths = [
  ["task_init1", "task_logi1", "task_crep1", "task_amkl1", "task_01bcy"],
  ["task_init1", "task_logi1", "task_crew1", "task_arpt1"],
];
