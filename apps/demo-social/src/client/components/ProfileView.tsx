import React, { useState } from "react";
import { User, UserWithFollows, Post } from "../types";
import { PostCard } from "./PostCard";

interface ProfileViewProps {
  user: User | null;
  profileUserId: string | null;
  users: UserWithFollows[];
  posts: Post[];
  profileError: string | null;
  setProfileUserId: (id: string | null) => void;
  setPage: (page: "home" | "global" | "profile") => void;
  handleToggleFollow: (targetUser: UserWithFollows) => void;
  handleToggleLike: (postId: string) => void;
  handleDeletePost: (postId: string) => void;
  handleLogout: () => void;
  handleSaveProfile: (displayName: string, bio: string) => Promise<boolean>;
}

export function ProfileView({
  user,
  profileUserId,
  users,
  posts,
  profileError,
  setProfileUserId,
  setPage,
  handleToggleFollow,
  handleToggleLike,
  handleDeletePost,
  handleLogout,
  handleSaveProfile,
}: ProfileViewProps) {
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

  // Profile editing local states
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");

  const handleEditClick = () => {
    setEditDisplayName(profileUser.displayName);
    setEditBio(profileUser.bio);
    setIsEditing(true);
  };

  const handleSaveClick = async () => {
    const success = await handleSaveProfile(editDisplayName, editBio);
    if (success) {
      setIsEditing(false);
    }
  };

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
                onClick={handleSaveClick}
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
                  onClick={handleEditClick}
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
          profilePosts.map((post) => (
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
      </section>
    </div>
  );
}
