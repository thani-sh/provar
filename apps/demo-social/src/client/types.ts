export interface User {
  id: string;
  username: string;
  displayName: string;
  bio: string;
}

export interface UserWithFollows extends User {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

export interface Post {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  text: string;
  createdAt: number;
  likes: string[];
}
