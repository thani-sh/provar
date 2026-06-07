import React from "react";

interface PostComposerProps {
  postText: string;
  setPostText: (text: string) => void;
  postError: string | null;
  handleCreatePost: () => void;
}

export function PostComposer({
  postText,
  setPostText,
  postError,
  handleCreatePost,
}: PostComposerProps) {
  return (
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
  );
}
