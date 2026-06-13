// hash: 22820ddf45c16f151332be5baaf41b03ad961c36fd2a855dce4a15ba9e17f654
import type { TestAPI } from "@libs/engine";

export const tasks = {
  ["task_a1b2c"]: async (api: TestAPI) => {
    await api.page.goto(api.var.baseUrl);
    
    const signInButton = api.page.getByRole('button', { name: 'Sign In' });
    await signInButton.click();
    
    const registerSwitch = api.page.getByRole('button', { name: 'Create an account' });
    await registerSwitch.click();
    
    const createAccountButton = api.page.getByRole('button', { name: 'Create Account' });
    await api.expect(createAccountButton).toBeVisible();
  },
  ["task_d3e4f"]: async (api: TestAPI) => {
    const usernameInput = api.page.getByPlaceholder('Username');
    const submitButton = api.page.getByRole('button', { name: 'Create Account' });
    
    await submitButton.click();
    
    const isValid = await usernameInput.evaluate(el => el.validity.valid);
    api.expect(isValid).toBe(false);
  },
  ["task_g5h6i"]: async (api: TestAPI) => {
    const uniqueUsername = `u_${Math.floor(Math.random() * 100000000)}`;
    const password = api.var.user.password;
    const displayName = `User_${Math.floor(Math.random() * 100000000)}`;
    
    await api.page.getByPlaceholder('Username').fill(uniqueUsername);
    await api.page.getByPlaceholder('Password').fill(password);
    await api.page.getByPlaceholder('Display Name (Optional)').fill(displayName);
    
    await api.page.getByRole('button', { name: 'Create Account' }).click();
    
    await api.expect(api.page.getByText('No thoughts in the void.')).toBeVisible();
  },
};

export const paths = [
  ["task_a1b2c", "task_d3e4f", "task_g5h6i"],
  ["task_a1b2c", "task_g5h6i"],
];
