import React from "react";
import { User, Post } from "../types";

interface PostCardProps {
  post: Post;
  user: User | null;
  setProfileUserId: (id: string | null) => void;
  setPage: (page: "home" | "global" | "profile") => void;
  handleToggleLike: (postId: string) => void;
  handleDeletePost: (postId: string) => void;
}

export function PostCard({
  post,
  user,
  setProfileUserId,
  setPage,
  handleToggleLike,
  handleDeletePost,
}: PostCardProps) {
  const isLiked = user ? post.likes.includes(user.id) : false;
  const isOwner = user ? post.userId === user.id : false;
  const timeString = new Date(post.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <article className="post-container group cursor-default">
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
            <span className="text-secondary text-sm opacity-50 font-label-sm">
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
              <span className="text-xs font-label-sm">{post.likes.length}</span>
            )}
          </button>

          <button className="flex items-center gap-1 text-secondary hover:text-primary transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">
              chat_bubble
            </span>
          </button>

          <button className="flex items-center gap-1 text-secondary hover:text-primary transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">share</span>
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
}
