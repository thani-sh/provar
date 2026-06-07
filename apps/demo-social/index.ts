import { routes } from "./src/server/routes";

const server = Bun.serve({
  port: 6001,
  routes,
  development: true,
});

console.log(`Social Server running at ${server.url}`);
