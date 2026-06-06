import React, { useState, useEffect } from "react";

interface User {
  id: string;
  username: string;
  displayName: string;
  bio: string;
}

interface UserWithFollows extends User {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

interface Post {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  text: string;
  createdAt: number;
  likes: string[];
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
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
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
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
            // Invalid token, clear and log out
            localStorage.removeItem("void_auth_token");
            setUser(null);
            setPage("global");
          }
        } catch (err) {
          // Connection error or verify failed - log out to be safe
          localStorage.removeItem("void_auth_token");
          setUser(null);
          setPage("global");
        }
      }
    };
    checkToken();
  }, []);

  // Handle Authentication
  const handleAuth = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAuthError(null);

    if (!username || !password) {
      setAuthError("Username and password are required");
      return;
    }

    const url = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body =
      authMode === "login"
        ? { username, password }
        : { username, password, displayName };

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
      // Clear fields
      setPassword("");
      setDisplayName("");
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
    setUsername("");
    setPassword("");
    setPosts([]);
    setUsers([]);
    setPage("global");
    setProfileUserId(null);
    setIsEditing(false);
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
  const handleSaveProfile = async () => {
    if (!user) return;
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
        return;
      }

      setUser(data);
      setIsEditing(false);
      fetchUsers();
      fetchPosts();
    } catch (err) {
      setProfileError("Connection error. Failed to save profile.");
    }
  };

  // Trigger fetches on user, page, or profile change
  useEffect(() => {
    setIsEditing(false);
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

      // Prepend to posts state
      setPosts([data, ...posts]);
      setPostText("");
      setPostError(null);

      // Reset composer textarea height
      const textarea = document.getElementById("post-composer-textarea");
      if (textarea) {
        textarea.style.height = "";
      }

      // Refresh user counts and posts
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

  // Auth screen layout (Minimalist Editorial Style)
  if (isLoggingIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-margin-base py-stack-lg bg-background">
        <div className="w-full max-w-[400px] flex flex-col gap-stack-md">
          <div className="text-center md:text-left flex flex-col gap-unit">
            <h1 className="font-headline-lg text-headline-lg tracking-tighter text-primary font-bold">
              Void
            </h1>
            <p className="font-body-md text-body-md text-secondary opacity-50">
              {authMode === "login"
                ? "Return to the silence."
                : "Enter the essential void."}
            </p>
          </div>

          <form
            onSubmit={handleAuth}
            className="flex flex-col gap-stack-sm mt-4"
          >
            <div className="flex flex-col gap-1">
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 py-2 outline-none font-body-md text-primary placeholder:text-secondary placeholder:opacity-50 transition-colors"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 py-2 outline-none font-body-md text-primary placeholder:text-secondary placeholder:opacity-50 transition-colors"
                required
              />
            </div>

            {authMode === "register" && (
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  placeholder="Display Name (Optional)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 py-2 outline-none font-body-md text-primary placeholder:text-secondary placeholder:opacity-50 transition-colors"
                />
              </div>
            )}

            {authError && (
              <div className="text-error font-label-sm text-label-sm mt-2">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-primary text-on-primary py-3 rounded-full font-label-md text-label-md hover:bg-tertiary-container hover:text-on-tertiary-container transition-all duration-300 mt-6 cursor-pointer flex items-center justify-center"
            >
              {authMode === "login" ? "Sign In" : "Create Account"}
            </button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "login" ? "register" : "login");
                  setAuthError(null);
                }}
                className="font-label-sm text-label-sm text-secondary hover:text-primary transition-colors underline decoration-outline-variant cursor-pointer"
              >
                {authMode === "login"
                  ? "Create an account"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Render Post Item
  const renderPostItem = (post: Post) => {
    const isLiked = user ? post.likes.includes(user.id) : false;
    const isOwner = user ? post.userId === user.id : false;
    const timeString = new Date(post.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <article key={post.id} className="post-container group cursor-default">
        <div className="flex flex-col gap-stack-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                onClick={() => {
                  setProfileUserId(post.userId);
                  setPage("profile");
                }}
                className="font-label-md text-label-md text-primary hover:underline cursor-pointer font-semibold"
              >
                @{post.username}
              </span>
              <span className="text-secondary text-sm opacity-50">
                · {timeString}
              </span>
            </div>
          </div>

          <p className="font-body-md text-body-md text-primary leading-relaxed whitespace-pre-line">
            {post.text}
          </p>

          <div className="post-actions flex gap-4 mt-2 opacity-30 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={() => handleToggleLike(post.id)}
              className={`flex items-center gap-1 transition-colors cursor-pointer ${
                isLiked ? "text-error" : "text-secondary hover:text-primary"
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: `'FILL' ${isLiked ? 1 : 0}` }}
              >
                favorite
              </span>
              {post.likes.length > 0 && (
                <span className="text-xs font-label-sm">
                  {post.likes.length}
                </span>
              )}
            </button>

            <button className="flex items-center gap-1 text-secondary hover:text-primary transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-[20px]">
                chat_bubble
              </span>
            </button>

            <button className="flex items-center gap-1 text-secondary hover:text-primary transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-[20px]">
                share
              </span>
            </button>

            {isOwner && (
              <button
                onClick={() => handleDeletePost(post.id)}
                className="ml-auto text-secondary hover:text-error transition-colors text-xs font-label-sm cursor-pointer"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  // Render Profile View
  const renderProfileView = () => {
    const profileUser = profileUserId
      ? users.find((u) => u.id === profileUserId)
      : users.find((u) => u.id === user?.id);

    if (!profileUser) {
      return (
        <div className="text-center py-stack-lg text-secondary opacity-50 italic">
          User not found.
        </div>
      );
    }

    const isOwnProfile = user ? profileUser.id === user.id : false;
    const profilePosts = posts.filter((p) => p.userId === profileUser.id);

    return (
      <div className="flex flex-col gap-stack-lg">
        {isEditing && isOwnProfile ? (
          <header className="pt-8 pb-stack-sm flex flex-col items-start w-full">
            <h2 className="font-label-md text-label-md text-secondary uppercase tracking-widest mb-6">
              Edit Profile
            </h2>
            <div className="flex flex-col gap-4 w-full">
              <div className="flex flex-col gap-1 w-full">
                <label className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 py-1 outline-none font-body-lg text-primary transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1 w-full mt-2">
                <label className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Bio
                </label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 py-1 outline-none font-body-md text-primary transition-colors resize-none h-16"
                  placeholder="Tell us about yourself..."
                />
              </div>
              {profileError && (
                <p className="text-error text-xs font-label-sm mt-1">
                  {profileError}
                </p>
              )}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveProfile}
                  className="font-label-md text-label-md text-on-primary bg-primary px-4 py-2 rounded-full hover:bg-tertiary-container transition-all duration-300 cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="font-label-md text-label-md text-secondary px-4 py-2 border border-outline-variant rounded-full hover:text-primary transition-all duration-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </header>
        ) : (
          <header className="pt-8 pb-stack-sm flex flex-col items-start">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-primary tracking-tighter font-semibold">
              {profileUser.displayName}
            </h1>
            <p className="font-label-sm text-label-sm text-secondary opacity-50 mt-1">
              @{profileUser.username}
            </p>

            {profileUser.bio && (
              <p className="font-body-lg text-body-lg text-secondary mt-stack-sm max-w-[80%] leading-relaxed">
                {profileUser.bio}
              </p>
            )}

            <div className="flex gap-4 mt-4 text-secondary font-label-sm text-label-sm">
              <span>
                <strong className="text-primary font-medium">
                  {profileUser.followingCount}
                </strong>{" "}
                following
              </span>
              <span>
                <strong className="text-primary font-medium">
                  {profileUser.followersCount}
                </strong>{" "}
                followers
              </span>
            </div>

            <div className="flex gap-3 mt-stack-md">
              {!isOwnProfile ? (
                <button
                  onClick={() => handleToggleFollow(profileUser)}
                  className="font-label-md text-label-md text-outline px-4 py-2 border border-outline-variant rounded-full hover:border-primary hover:text-primary hover:bg-surface-variant transition-all duration-300 ease-in-out cursor-pointer"
                >
                  {profileUser.isFollowing ? "Unfollow" : "Follow"}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditDisplayName(user?.displayName || "");
                      setEditBio(user?.bio || "");
                      setIsEditing(true);
                    }}
                    className="font-label-md text-label-md text-outline px-4 py-2 border border-outline-variant rounded-full hover:border-primary hover:text-primary hover:bg-surface-variant transition-all duration-300 ease-in-out cursor-pointer"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="font-label-md text-label-md text-error px-4 py-2 border border-error-container rounded-full hover:border-error hover:bg-error-container/20 transition-all duration-300 ease-in-out cursor-pointer"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </header>
        )}

        <section className="flex flex-col gap-stack-lg mt-stack-md border-t border-surface-variant pt-stack-md">
          <h2 className="font-label-md text-label-md text-secondary uppercase tracking-widest mb-2">
            Thoughts
          </h2>
          {profilePosts.length === 0 ? (
            <div className="text-center py-stack-lg text-secondary opacity-50 italic font-body-md">
              No thoughts shared yet.
            </div>
          ) : (
            profilePosts.map(renderPostItem)
          )}
        </section>
      </div>
    );
  };

  return (
    <div className="bg-background text-primary font-body-md min-h-screen flex flex-col selection:bg-surface-variant selection:text-primary">
      {/* TopNavBar (Web) */}
      <header className="hidden md:flex justify-between items-center max-w-[640px] mx-auto px-margin-base py-stack-sm w-full top-0 sticky bg-background border-b border-transparent z-40">
        <div
          className="font-headline-lg text-headline-lg tracking-tighter text-primary font-bold cursor-pointer"
          onClick={() => {
            setPage(user ? "home" : "global");
            setProfileUserId(null);
          }}
        >
          Void
        </div>
        <nav className="flex gap-stack-sm items-center">
          {user ? (
            <>
              <button
                onClick={() => {
                  setPage("home");
                  setProfileUserId(null);
                }}
                className={`font-body-md text-body-md cursor-pointer pb-1 transition-all duration-300 ${
                  page === "home"
                    ? "text-primary border-b-2 border-primary"
                    : "text-secondary opacity-50 hover:opacity-100"
                }`}
              >
                Home
              </button>
              <button
                onClick={() => {
                  setPage("global");
                  setProfileUserId(null);
                }}
                className={`font-body-md text-body-md cursor-pointer pb-1 transition-all duration-300 ${
                  page === "global"
                    ? "text-primary border-b-2 border-primary"
                    : "text-secondary opacity-50 hover:opacity-100"
                }`}
              >
                Global
              </button>
              <button
                onClick={() => {
                  setPage("profile");
                  setProfileUserId(null);
                }}
                className={`font-body-md text-body-md cursor-pointer pb-1 transition-all duration-300 ${
                  page === "profile" && !profileUserId
                    ? "text-primary border-b-2 border-primary"
                    : "text-secondary opacity-50 hover:opacity-100"
                }`}
              >
                Profile
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setAuthMode("login");
                setAuthError(null);
                setIsLoggingIn(true);
              }}
              className="font-body-md text-body-md text-secondary opacity-50 hover:opacity-100 transition-opacity duration-300 cursor-pointer"
            >
              Sign In
            </button>
          )}
        </nav>
        {user && (
          <button
            aria-label="Add Post"
            className="text-primary hover:opacity-70 transition-opacity duration-300 cursor-pointer"
            onClick={() => {
              setPage("home");
              setProfileUserId(null);
              setTimeout(() => {
                const textarea = document.getElementById(
                  "post-composer-textarea",
                );
                if (textarea) textarea.focus();
              }, 100);
            }}
          >
            <span className="material-symbols-outlined text-[24px]">
              add_circle
            </span>
          </button>
        )}
      </header>

      {/* Main Content Canvas */}
      <main className="flex-1 w-full max-w-[640px] mx-auto px-5 md:px-margin-base py-stack-sm md:py-stack-md flex flex-col pb-32">
        {page === "home" && user && (
          <>
            {/* Compose Area */}
            <section className="flex flex-col gap-stack-sm mb-stack-lg">
              <div className="relative w-full">
                <textarea
                  id="post-composer-textarea"
                  className="w-full bg-transparent border-0 border-b border-transparent focus:border-primary focus:ring-0 resize-none outline-none font-body-lg text-body-lg text-primary placeholder:text-secondary placeholder:opacity-50 overflow-hidden min-h-[60px]"
                  placeholder="Speak into the void..."
                  value={postText}
                  onChange={(e) => {
                    setPostText(e.target.value);
                    e.target.style.height = "";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                  maxLength={120}
                />
              </div>
              <div
                className={`flex justify-between items-center h-8 transition-opacity duration-300 ${
                  postText.trim().length > 0
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                <span
                  className={`font-label-sm text-label-sm ${
                    postText.length > 100
                      ? "text-error font-semibold"
                      : "text-secondary opacity-50"
                  }`}
                >
                  {postText.length} / 100
                </span>
                <button
                  onClick={handleCreatePost}
                  disabled={postText.length > 100 || !postText.trim()}
                  className="bg-primary text-on-primary px-6 rounded-full font-label-md text-label-md hover:bg-tertiary-container hover:text-on-tertiary-container disabled:opacity-30 disabled:pointer-events-none transition-colors duration-300 flex items-center justify-center h-full cursor-pointer"
                >
                  Post
                </button>
              </div>
              {postError && (
                <div className="text-error font-label-sm text-label-sm mt-1">
                  {postError}
                </div>
              )}
            </section>

            {/* Timeline Feed */}
            <section className="flex flex-col gap-stack-lg">
              {posts.length === 0 ? (
                <div className="text-center py-stack-lg text-secondary opacity-50 italic font-body-md">
                  No thoughts in your feed. Follow someone or write your own.
                </div>
              ) : (
                posts.map(renderPostItem)
              )}
            </section>
          </>
        )}

        {(page === "global" || (!user && page === "home")) && (
          <section className="flex flex-col gap-stack-lg">
            {posts.length === 0 ? (
              <div className="text-center py-stack-lg text-secondary opacity-50 italic font-body-md">
                The void is empty. Be the first to speak.
              </div>
            ) : (
              posts.map(renderPostItem)
            )}
          </section>
        )}

        {page === "profile" && renderProfileView()}
      </main>

      {/* BottomNavBar (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-gutter py-stack-sm bg-background/90 backdrop-blur-md border-t border-surface-variant">
        <button
          onClick={() => {
            setPage("global");
            setProfileUserId(null);
          }}
          className={`flex flex-col items-center justify-center transition-all duration-300 font-label-sm text-label-sm gap-1 cursor-pointer ${
            page === "global" || (!user && page !== "profile")
              ? "text-primary scale-110"
              : "text-secondary opacity-40 hover:opacity-100"
          }`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={{
              fontVariationSettings: `'FILL' ${page === "global" || (!user && page !== "profile") ? 1 : 0}`,
            }}
          >
            auto_awesome
          </span>
          <span>Feed</span>
        </button>

        <button
          onClick={() => {
            if (user) {
              setPage("home");
              setProfileUserId(null);
              setTimeout(() => {
                const textarea = document.getElementById(
                  "post-composer-textarea",
                );
                if (textarea) textarea.focus();
              }, 100);
            } else {
              setAuthMode("login");
              setAuthError(null);
              setIsLoggingIn(true);
            }
          }}
          className={`flex flex-col items-center justify-center transition-all duration-300 font-label-sm text-label-sm gap-1 cursor-pointer ${
            user && page === "home"
              ? "text-primary scale-110"
              : "text-secondary opacity-40 hover:opacity-100"
          }`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={{
              fontVariationSettings: `'FILL' ${user && page === "home" ? 1 : 0}`,
            }}
          >
            edit_note
          </span>
          <span>Write</span>
        </button>

        <button
          onClick={() => {
            if (user) {
              setPage("profile");
              setProfileUserId(null);
            } else {
              setAuthMode("login");
              setAuthError(null);
              setIsLoggingIn(true);
            }
          }}
          className={`flex flex-col items-center justify-center transition-all duration-300 font-label-sm text-label-sm gap-1 cursor-pointer ${
            page === "profile" && (!profileUserId || profileUserId === user?.id)
              ? "text-primary scale-110"
              : "text-secondary opacity-40 hover:opacity-100"
          }`}
        >
          <span
            className="material-symbols-outlined text-[24px]"
            style={{
              fontVariationSettings: `'FILL' ${page === "profile" && (!profileUserId || profileUserId === user?.id) ? 1 : 0}`,
            }}
          >
            person
          </span>
          <span>Account</span>
        </button>
      </nav>
    </div>
  );
}
