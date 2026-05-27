// hash: 234181c2ff0a429fecfdd2dfc139359b669444dc800f4cc59ccb0a0a5ef3af67
import type { TestAPI } from "@libs/executor";

export const tasks = {
  ["action_init1"]: async (api: TestAPI) => {
    await api.page.goto('http://localhost:6001');
    await api.expect(api.page.locator('body')).toContainText('Login to Todo Demo');
  },
  ["action_logi1"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder('Username').fill('multitasker');
    await api.page.getByRole('button', { name: 'Login / Register' }).click();
    await api.expect(api.page.locator('body')).toContainText('Logged in as multitasker');
  },
  ["action_crep1"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder('New List...').fill('Personal');
    await api.page.getByRole('button', { name: 'Add List' }).click();
    await api.expect(api.page.locator('.list-item.active')).toContainText('Personal');
  },
  ["action_amkl1"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder('What needs to be done?').fill('Buy groceries');
    await api.page.getByRole('button', { name: 'Add Task' }).click();
    await api.expect(api.page.locator('.task-list')).toContainText('Buy groceries');
  },
  ["action_01bcy"]: async (api: TestAPI) => {
    await api.page.getByRole('checkbox').check();
    await api.expect(api.page.getByRole('checkbox')).toBeChecked();
  },
  ["action_crew1"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder('New List...').fill('Work');
    await api.page.getByRole('button', { name: 'Add List' }).click();
    await api.expect(api.page.locator('.list-item.active')).toContainText('Work');
  },
  ["action_arpt1"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder('What needs to be done?').fill('Submit report');
    await api.page.getByRole('button', { name: 'Add Task' }).click();
    await api.expect(api.page.locator('.task-list')).toContainText('Submit report');
  },
};

export const paths = [
  ["action_init1", "action_logi1", "action_crep1", "action_amkl1", "action_01bcy"],
  ["action_init1", "action_logi1", "action_crew1", "action_arpt1"],
];
