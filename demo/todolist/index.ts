import index from "./src/client/index.html";
import { store } from "./src/server/store";

const server = Bun.serve({
  port: 6001,
  routes: {
    "/": index,
    
    // API Routes
    "/api/auth/login": {
      async POST(req) {
        const { username } = await req.json() as { username: string };
        let user = store.getUser(username);
        if (!user) {
          user = store.addUser(username);
        }
        return Response.json(user);
      }
    },

    "/api/lists": {
      async GET(req) {
        const url = new URL(req.url);
        const userId = url.searchParams.get("userId");
        if (!userId) return new Response("Missing userId", { status: 400 });
        return Response.json(store.getLists(userId));
      },
      async POST(req) {
        const { userId, name } = await req.json() as { userId: string, name: string };
        return Response.json(store.addList(userId, name));
      }
    },

    "/api/lists/:id": {
      async DELETE(req) {
        const id = req.params.id;
        store.deleteList(id);
        return Response.json({ success: true });
      }
    },

    "/api/items": {
      async GET(req) {
        const url = new URL(req.url);
        const listId = url.searchParams.get("listId");
        if (!listId) return new Response("Missing listId", { status: 400 });
        return Response.json(store.getItems(listId));
      },
      async POST(req) {
        const { listId, text } = await req.json() as { listId: string, text: string };
        return Response.json(store.addItem(listId, text));
      }
    },

    "/api/items/:id": {
      async PATCH(req) {
        const id = req.params.id;
        const updates = await req.json() as any;
        return Response.json(store.updateItem(id, updates));
      },
      async DELETE(req) {
        const id = req.params.id;
        store.deleteItem(id);
        return Response.json({ success: true });
      }
    }
  },
  development: true,
});

console.log(`Server running at ${server.url}`);
