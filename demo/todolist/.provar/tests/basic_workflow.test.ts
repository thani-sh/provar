// hash: 108bafa1ca286f53a9988f509b245db0c7cdf044d4d99fc8542c0e691e9cb686
import type { TestAPI } from "@libs/executor";

export const tasks = {
  ["action_init1"]: async (api: TestAPI) => {
    await api.page.goto('http://localhost:6001');
    await api.expect(api.page).toHaveTitle('Provar Todo Demo');
  },
  ["action_logi1"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder('Username').fill('testuser');
    await api.page.getByRole('button', { name: /Login/i }).click();
    await api.expect(api.page.locator('header')).toContainText('testuser');
  },
  ["action_clis1"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder('New List...').fill('Shopping');
    await api.page.getByRole('button', { name: 'Add List' }).click();
    await api.expect(api.page.locator('.list-nav')).toContainText('Shopping');
  },
  ["action_atask"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder('What needs to be done?').fill('Buy Milk');
    await api.page.getByRole('button', { name: 'Add Task' }).click();
    await api.expect(api.page.locator('.task-list')).toContainText('Buy Milk');
  },
  ["action_compt"]: async (api: TestAPI) => {
    await api.page.locator('.task-card', { hasText: 'Buy Milk' }).getByRole('checkbox').click();
    await api.expect(api.page.locator('.task-card', { hasText: 'Buy Milk' }).getByRole('checkbox')).toBeChecked();
  },
};

export const paths = [
  ["action_init1", "action_logi1", "action_clis1", "action_atask", "action_compt"],
];
