// hash: 6bb390bed376384ee29c8ce953a2eabbb9d4962737b2a49dafacdcb5228168ae
import type { TestAPI } from "@libs/executor";

export const tasks = {
  ["task_init1"]: async (api: TestAPI) => {
    await api.page.goto(api.var.BASE_URL);
  },
  ["task_logi1"]: async (api: TestAPI) => {
    await api.page.locator('.input').fill('testuser');
    await api.page.locator('.btn-primary').click();
  },
  ["task_clis1"]: async (api: TestAPI) => {
    await api.page.getByPlaceholder(/list/i).fill('Shopping');
    await api.page.getByRole('button', { name: 'Add List' }).click();
  },
  ["task_atask"]: async (api: TestAPI) => {
    await api.page.locator('.add-task .input').fill('Buy Milk');
    await api.page.locator('.add-task .btn-primary').click();
  },
  ["task_compt"]: async (api: TestAPI) => {
    await api.page.locator('.add-task .btn-primary').click();
    await api.page.getByRole('checkbox').click();
  },
};

export const paths = [
  ["task_init1", "task_logi1", "task_clis1", "task_atask", "task_compt"],
];
