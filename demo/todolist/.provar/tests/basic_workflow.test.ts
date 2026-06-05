// hash: 38ce31a2996e2828ea23eb921427e095097f26481182967f28e7344ffb4cae34
import type { TestAPI } from "@libs/executor";

export const tasks = {
  ["task_init1"]: async (api: TestAPI) => {
    await api.page.goto(api.var.BASE_URL);
    await api.expect(api.page.locator('.card-header')).toContainText('Login to Todo Demo');
  },
  ["task_logi1"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder('Username').fill('testuser');
    await api.page.getByRole('button', { name: 'Login / Register' }).click();
    await api.expect(api.page.locator('body')).toContainText('Logged in as testuser');
  },
  ["task_clis1"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder('New List...').fill('Shopping');
    await api.page.getByRole('button', { name: 'Add List' }).click();
    await api.expect(api.page.locator('.list-item.active')).toHaveText('Shopping');
  },
  ["task_atask"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder('What needs to be done?').fill('Buy Milk');
    await api.page.getByRole('button', { name: 'Add Task' }).click();
    await api.expect(api.page.locator('.task-text')).toContainText('Buy Milk');
  },
  ["task_compt"]: async (api: TestAPI) => {
    await api.page.locator('.task-row').filter({ hasText: 'Buy Milk' }).getByRole('checkbox').click();
    await api.expect(api.page.locator('.task-row').filter({ hasText: 'Buy Milk' }).locator('.task-text')).toHaveClass(/completed/);
  },
};

export const paths = [
  ["task_init1", "task_logi1", "task_clis1", "task_atask", "task_compt"],
];
