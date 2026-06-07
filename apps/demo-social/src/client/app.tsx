import React, { useState, useEffect } from "react";
import { User, UserWithFollows, Post } from "./types";
import { Header } from "./components/Header";
import { AuthForm } from "./components/AuthForm";
import { PostComposer } from "./components/PostComposer";
import { PostCard } from "./components/PostCard";
import { ProfileView } from "./components/ProfileView";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState<string | null>(null);

  // App States
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<UserWithFollows[]>([]);
  const [page, setPage] = useState<"home" | "global" | "profile">("global");
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  // Post composer
  const [postText, setPostText] = useState("");
  const [postError, setPostError] = useState<string | null>(null);

  // Profile editing
  const [profileError, setProfileError] = useState<string | null>(null);

  // Startup verification of token
  useEffect(() => {
    const checkToken = async () => {
      const token = localStorage.getItem("void_auth_token");
      if (token) {
        try {
          const res = await fetch("/api/auth/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          const data = await res.json();
          if (res.ok) {
            setUser(data);
            setPage("home");
          } else {
            localStorage.removeItem("void_auth_token");
            setUser(null);
            setPage("global");
          }
        } catch (err) {
          localStorage.removeItem("void_auth_token");
          setUser(null);
          setPage("global");
        }
      }
    };
    checkToken();
  }, []);

  // Handle Authentication
  const handleAuth = async (
    e: React.FormEvent,
    usernameVal: string,
    passwordVal: string,
    displayNameVal?: string,
  ) => {
    e.preventDefault();
    setAuthError(null);

    if (!usernameVal || !passwordVal) {
      setAuthError("Username and password are required");
      return;
    }

    const url = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body =
      authMode === "login"
        ? { username: usernameVal, password: passwordVal }
        : {
            username: usernameVal,
            password: passwordVal,
            displayName: displayNameVal,
          };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || "Authentication failed");
        return;
      }

      setUser(data);
      if (data.token) {
        localStorage.setItem("void_auth_token", data.token);
      }
      setAuthError(null);
      setIsLoggingIn(false);
      setPage("home");
      setProfileUserId(null);
    } catch (err) {
      setAuthError("Connection error. Is the server running?");
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem("void_auth_token");
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
      } catch (err) {
        console.error("Logout request failed:", err);
      }
    }
    localStorage.removeItem("void_auth_token");
    setUser(null);
    setPosts([]);
    setUsers([]);
    setPage("global");
    setProfileUserId(null);
  };

  const fetchPostsAnonymous = async () => {
    try {
      const res = await fetch(`/api/posts?feedType=all`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (err) {
      console.error("Error fetching posts anonymously:", err);
    }
  };

  // Fetch Data
  const fetchPosts = async () => {
    if (!user) {
      fetchPostsAnonymous();
      return;
    }
    try {
      const fetchType = page === "home" ? "following" : "all";
      const res = await fetch(
        `/api/posts?userId=${user.id}&feedType=${fetchType}`,
      );
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (err) {
      console.error("Error fetching posts:", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const url = user ? `/api/users?userId=${user.id}` : `/api/users`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  // Profile Save
  const handleSaveProfile = async (
    editDisplayName: string,
    editBio: string,
  ): Promise<boolean> => {
    if (!user) return false;
    setProfileError(null);
    try {
      const res = await fetch("/api/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          displayName: editDisplayName,
          bio: editBio,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error || "Failed to update profile");
        return false;
      }

      setUser(data);
      fetchUsers();
      fetchPosts();
      return true;
    } catch (err) {
      setProfileError("Connection error. Failed to save profile.");
      return false;
    }
  };

  // Trigger fetches on user, page, or profile change
  useEffect(() => {
    setProfileError(null);
    fetchPosts();
    fetchUsers();
  }, [user, page, profileUserId]);

  // Social Interactions
  const handleCreatePost = async () => {
    if (!user || !postText.trim()) return;
    setPostError(null);

    if (postText.length > 100) {
      setPostError("Post must not exceed 100 characters");
      return;
    }

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, text: postText }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPostError(data.error || "Failed to submit post");
        return;
      }

      setPosts([data, ...posts]);
      setPostText("");
      setPostError(null);

      // Reset composer textarea height
      const textarea = document.getElementById("post-composer-textarea");
      if (textarea) {
        textarea.style.height = "";
      }

      fetchUsers();
      fetchPosts();
    } catch (err) {
      setPostError("Failed to submit post due to a connection error.");
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/posts/${postId}?userId=${user.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPosts(posts.filter((p) => p.id !== postId));
        fetchUsers();
      }
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  const handleToggleLike = async (postId: string) => {
    if (!user) {
      setIsLoggingIn(true);
      return;
    }
    try {
      const res = await fetch("/api/posts/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, userId: user.id }),
      });

      if (res.ok) {
        const updatedPost = await res.json();
        setPosts(posts.map((p) => (p.id === postId ? updatedPost : p)));
      }
    } catch (err) {
      console.error("Error liking post:", err);
    }
  };

  const handleToggleFollow = async (targetUser: UserWithFollows) => {
    if (!user) {
      setIsLoggingIn(true);
      return;
    }
    const url = targetUser.isFollowing
      ? "/api/users/unfollow"
      : "/api/users/follow";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followerId: user.id,
          followeeId: targetUser.id,
        }),
      });

      if (res.ok) {
        setUsers(
          users.map((u) => {
            if (u.id === targetUser.id) {
              const diff = targetUser.isFollowing ? -1 : 1;
              return {
                ...u,
                isFollowing: !u.isFollowing,
                followersCount: u.followersCount + diff,
              };
            }
            return u;
          }),
        );
        fetchPosts();
      }
    } catch (err) {
      console.error("Error following/unfollowing user:", err);
    }
  };

  if (isLoggingIn) {
    return (
      <AuthForm
        authMode={authMode}
        setAuthMode={setAuthMode}
        authError={authError}
        setAuthError={setAuthError}
        onAuth={handleAuth}
      />
    );
  }

  return (
    <div className="bg-background text-primary font-body-md min-h-screen flex flex-col selection:bg-surface-variant selection:text-primary">
      <Header
        user={user}
        page={page}
        profileUserId={profileUserId}
        setPage={setPage}
        setProfileUserId={setProfileUserId}
        setAuthMode={setAuthMode}
        setAuthError={setAuthError}
        setIsLoggingIn={setIsLoggingIn}
      />

      {/* Main Content Canvas */}
      <main className="flex-1 w-full max-w-[640px] mx-auto px-5 md:px-margin-base py-stack-sm md:py-stack-md flex flex-col pb-32">
        {page === "home" && user && (
          <PostComposer
            postText={postText}
            setPostText={setPostText}
            postError={postError}
            handleCreatePost={handleCreatePost}
          />
        )}

        {page === "profile" ? (
          <ProfileView
            user={user}
            profileUserId={profileUserId}
            users={users}
            posts={posts}
            profileError={profileError}
            setProfileUserId={setProfileUserId}
            setPage={setPage}
            handleToggleFollow={handleToggleFollow}
            handleToggleLike={handleToggleLike}
            handleDeletePost={handleDeletePost}
            handleLogout={handleLogout}
            handleSaveProfile={handleSaveProfile}
          />
        ) : (
          <div className="flex flex-col gap-stack-lg">
            {posts.length === 0 ? (
              <div className="text-center py-stack-lg text-secondary opacity-50 italic font-body-md">
                No thoughts in the void.
              </div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  user={user}
                  setProfileUserId={setProfileUserId}
                  setPage={setPage}
                  handleToggleLike={handleToggleLike}
                  handleDeletePost={handleDeletePost}
                />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
