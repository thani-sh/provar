import vm from 'node:vm';

// Helper to get the body of a function.
function getFunctionBody(fn: Function): string {
  const fnStr = fn.toString();
  const bodyMatch = fnStr.match(/^[^{]*{([\s\S]*)}$/);
  return bodyMatch ? bodyMatch[1]!.trim() : "";
}

// 1. Define your function
async function calculateTotal(price: number, tax: number): Promise<number> {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return price * (1 + tax);
}

// 2. Get the source code and wrap in an IIAFE
const source = getFunctionBody(calculateTotal);
const wrapped = `(async () => { ${source} })()`;
const globals = { setTimeout }

// 3. Run the code in the sandbox and get the promise
const context = vm.createContext({ ...globals, price: 100, tax: 0.12 });
const result = vm.runInContext(wrapped, context)

console.log("--- Function Source Code ---");
console.log(source + `\n`);

console.log("--- Function Result ---");
console.log(result, await result);
