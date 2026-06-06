export interface User {
  id: string;
  username: string;
  passwordHash: string; // stored as plain-text/hash for demo ease
  displayName: string;
  bio: string;
}

export interface Post {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  text: string;
  createdAt: number;
  likes: string[]; // array of user IDs
}

export interface Follow {
  followerId: string;
  followeeId: string;
}

class Store {
  users: User[] = [];
  posts: Post[] = [];
  follows: Follow[] = [];
  sessions: Map<string, string> = new Map();

  constructor() {
    // Seed a default test user so the app is never empty on startup.
    this.addUser("void_user", "testpass123", "Void User", "The default test account.");
  }

  // Auth
  getUser(username: string): User | undefined {
    return this.users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase(),
    );
  }

  getUserById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  addUser(
    username: string,
    passwordHash: string,
    displayName: string,
    bio: string = "",
  ): User {
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      username,
      passwordHash,
      displayName: displayName || username,
      bio,
    };
    this.users.push(newUser);
    return newUser;
  }

  updateUser(id: string, displayName?: string, bio?: string): User | undefined {
    const user = this.getUserById(id);
    if (user) {
      if (displayName !== undefined) {
        user.displayName = displayName || user.username;
      }
      if (bio !== undefined) {
        user.bio = bio;
      }
    }
    return user;
  }

  createSession(userId: string): string {
    const token =
      Math.random().toString(36).substring(2) +
      Math.random().toString(36).substring(2);
    this.sessions.set(token, userId);
    return token;
  }

  getUserIdByToken(token: string): string | undefined {
    return this.sessions.get(token);
  }

  deleteSession(token: string): void {
    this.sessions.delete(token);
  }

  getUsers(currentUserId?: string) {
    // Return all users with follow stats, except optionally the current user
    return this.users.map((u) => {
      const followers = this.follows.filter(
        (f) => f.followeeId === u.id,
      ).length;
      const following = this.follows.filter(
        (f) => f.followerId === u.id,
      ).length;
      const isFollowing = currentUserId
        ? this.follows.some(
            (f) => f.followerId === currentUserId && f.followeeId === u.id,
          )
        : false;

      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        bio: u.bio,
        followersCount: followers,
        followingCount: following,
        isFollowing,
      };
    });
  }

  // Posts
  getPosts(currentUserId?: string, followingOnly: boolean = false): Post[] {
    let filteredPosts = [...this.posts];

    if (followingOnly && currentUserId) {
      const followedIds = this.follows
        .filter((f) => f.followerId === currentUserId)
        .map((f) => f.followeeId);
      // also include current user's posts in follow feed
      followedIds.push(currentUserId);
      filteredPosts = filteredPosts.filter((p) =>
        followedIds.includes(p.userId),
      );
    }

    // Sort by creation time descending
    return filteredPosts.sort((a, b) => b.createdAt - a.createdAt);
  }

  addPost(userId: string, text: string): Post {
    const user = this.getUserById(userId);
    if (!user) throw new Error("User not found");

    if (text.length > 100) throw new Error("Post exceeds 100 characters");

    const newPost: Post = {
      id: Math.random().toString(36).substr(2, 9),
      userId,
      username: user.username,
      displayName: user.displayName,
      text,
      createdAt: Date.now(),
      likes: [],
    };
    this.posts.push(newPost);
    return newPost;
  }

  deletePost(postId: string, userId: string): boolean {
    const initialLength = this.posts.length;
    this.posts = this.posts.filter(
      (p) => !(p.id === postId && p.userId === userId),
    );
    return this.posts.length < initialLength;
  }

  likePost(postId: string, userId: string): Post | undefined {
    const post = this.posts.find((p) => p.id === postId);
    if (post) {
      if (post.likes.includes(userId)) {
        post.likes = post.likes.filter((id) => id !== userId);
      } else {
        post.likes.push(userId);
      }
    }
    return post;
  }

  // Follow
  followUser(followerId: string, followeeId: string): boolean {
    if (followerId === followeeId) return false;
    const exists = this.follows.some(
      (f) => f.followerId === followerId && f.followeeId === followeeId,
    );
    if (!exists) {
      this.follows.push({ followerId, followeeId });
      return true;
    }
    return false;
  }

  unfollowUser(followerId: string, followeeId: string): boolean {
    const initialLength = this.follows.length;
    this.follows = this.follows.filter(
      (f) => !(f.followerId === followerId && f.followeeId === followeeId),
    );
    return this.follows.length < initialLength;
  }
}

export const store = new Store();
