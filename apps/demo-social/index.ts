import index from "./src/client/index.html";
import { store } from "./src/server/store";

const server = Bun.serve({
  port: 6001,
  routes: {
    "/": index,

    // API Routes
    "/api/auth/register": {
      async POST(req: Request) {
        try {
          const { username, password, displayName, bio } =
            (await req.json()) as {
              username?: string;
              password?: string;
              displayName?: string;
              bio?: string;
            };

          if (!username || !password) {
            return new Response(
              JSON.stringify({ error: "Username and password are required" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          // Validation
          if (username.length < 3 || username.length > 20) {
            return new Response(
              JSON.stringify({
                error: "Username must be between 3 and 20 characters",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return new Response(
              JSON.stringify({
                error:
                  "Username can only contain alphanumeric characters and underscores",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          if (password.length < 6) {
            return new Response(
              JSON.stringify({
                error: "Password must be at least 6 characters long",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const existingUser = store.getUser(username);
          if (existingUser) {
            return new Response(
              JSON.stringify({ error: "Username already taken" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const user = store.addUser(
            username,
            password,
            displayName || username,
            bio || "",
          );
          const token = store.createSession(user.id);
          return Response.json({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            bio: user.bio,
            token,
          });
        } catch (err) {
          return new Response(
            JSON.stringify({ error: "Invalid request payload" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
    },

    "/api/auth/login": {
      async POST(req: Request) {
        try {
          const { username, password } = (await req.json()) as {
            username?: string;
            password?: string;
          };

          if (!username || !password) {
            return new Response(
              JSON.stringify({ error: "Username and password are required" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const user = store.getUser(username);
          if (!user || user.passwordHash !== password) {
            return new Response(
              JSON.stringify({ error: "Invalid username or password" }),
              {
                status: 401,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const token = store.createSession(user.id);
          return Response.json({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            bio: user.bio,
            token,
          });
        } catch (err) {
          return new Response(
            JSON.stringify({ error: "Invalid request payload" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
    },

    "/api/auth/verify": {
      async POST(req: Request) {
        try {
          const { token } = (await req.json()) as { token?: string };
          if (!token) {
            return new Response(
              JSON.stringify({ error: "Token is required" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }
          const userId = store.getUserIdByToken(token);
          if (!userId) {
            return new Response(
              JSON.stringify({ error: "Invalid session token" }),
              { status: 401, headers: { "Content-Type": "application/json" } },
            );
          }
          const user = store.getUserById(userId);
          if (!user) {
            return new Response(JSON.stringify({ error: "User not found" }), {
              status: 404,
              headers: { "Content-Type": "application/json" },
            });
          }
          return Response.json({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            bio: user.bio,
          });
        } catch (err) {
          return new Response(
            JSON.stringify({ error: "Invalid request payload" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },

    "/api/auth/logout": {
      async POST(req: Request) {
        try {
          const { token } = (await req.json()) as { token?: string };
          if (token) {
            store.deleteSession(token);
          }
          return Response.json({ success: true });
        } catch (err) {
          return new Response("Invalid request payload", { status: 400 });
        }
      },
    },

    "/api/users": {
      async GET(req: Request) {
        const url = new URL(req.url);
        const currentUserId = url.searchParams.get("userId") || undefined;
        return Response.json(store.getUsers(currentUserId));
      },
    },

    "/api/users/follow": {
      async POST(req: Request) {
        const { followerId, followeeId } = (await req.json()) as {
          followerId: string;
          followeeId: string;
        };

        if (!followerId || !followeeId) {
          return new Response("Missing followerId or followeeId", {
            status: 400,
          });
        }

        const success = store.followUser(followerId, followeeId);
        return Response.json({ success });
      },
    },

    "/api/users/unfollow": {
      async POST(req: Request) {
        const { followerId, followeeId } = (await req.json()) as {
          followerId: string;
          followeeId: string;
        };

        if (!followerId || !followeeId) {
          return new Response("Missing followerId or followeeId", {
            status: 400,
          });
        }

        const success = store.unfollowUser(followerId, followeeId);
        return Response.json({ success });
      },
    },

    "/api/users/update": {
      async POST(req: Request) {
        try {
          const { userId, displayName, bio } = (await req.json()) as {
            userId: string;
            displayName?: string;
            bio?: string;
          };

          if (!userId) {
            return new Response("Missing userId", { status: 400 });
          }

          const user = store.updateUser(userId, displayName, bio);
          if (!user) {
            return new Response("User not found", { status: 404 });
          }

          return Response.json({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            bio: user.bio,
          });
        } catch (err) {
          return new Response("Invalid request payload", { status: 400 });
        }
      },
    },

    "/api/posts": {
      async GET(req: Request) {
        const url = new URL(req.url);
        const currentUserId = url.searchParams.get("userId") || undefined;
        const feedType = url.searchParams.get("feedType") || "all";
        const followingOnly = feedType === "following";

        return Response.json(store.getPosts(currentUserId, followingOnly));
      },
      async POST(req: Request) {
        try {
          const { userId, text } = (await req.json()) as {
            userId: string;
            text: string;
          };

          if (!userId || !text) {
            return new Response(
              JSON.stringify({ error: "userId and text are required" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          if (text.length > 100) {
            return new Response(
              JSON.stringify({ error: "Post exceeds 100 characters limit" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const post = store.addPost(userId, text);
          return Response.json(post);
        } catch (err: any) {
          return new Response(
            JSON.stringify({ error: err.message || "Failed to create post" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
      },
    },

    "/api/posts/like": {
      async POST(req: Request) {
        const { postId, userId } = (await req.json()) as {
          postId: string;
          userId: string;
        };

        if (!postId || !userId) {
          return new Response("Missing postId or userId", { status: 400 });
        }

        const post = store.likePost(postId, userId);
        if (!post) {
          return new Response("Post not found", { status: 404 });
        }

        return Response.json(post);
      },
    },

    "/api/posts/:id": {
      async DELETE(req: Request & { params: { id: string } }) {
        const id = req.params.id;
        const url = new URL(req.url);
        const userId = url.searchParams.get("userId");

        if (!userId) {
          return new Response("Missing userId", { status: 400 });
        }

        const success = store.deletePost(id, userId);
        return Response.json({ success });
      },
    },
  },
  development: true,
});

console.log(`Social Server running at ${server.url}`);
