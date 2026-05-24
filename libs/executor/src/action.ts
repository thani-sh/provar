import type { Action, TestAPI, TestDefinition } from "./types";

export function action(options: {
  id: string;
  title: string;
  execute: (api: TestAPI) => Promise<void>;
}): Action {
  const fn = async (api: TestAPI) => {
    await options.execute(api);
  };
  fn.id = options.id;
  fn.title = options.title;
  return fn as Action;
}

export function test(actions: Action[]): TestDefinition {
  const name = actions.map((a) => a.title).join(" -> ");
  return { name, actions };
}
