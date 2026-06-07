import React from "react";
import { User } from "../types";

interface HeaderProps {
  user: User | null;
  page: "home" | "global" | "profile";
  profileUserId: string | null;
  setPage: (page: "home" | "global" | "profile") => void;
  setProfileUserId: (id: string | null) => void;
  setAuthMode: (mode: "login" | "register") => void;
  setAuthError: (error: string | null) => void;
  setIsLoggingIn: (loggingIn: boolean) => void;
}

export function Header({
  user,
  page,
  profileUserId,
  setPage,
  setProfileUserId,
  setAuthMode,
  setAuthError,
  setIsLoggingIn,
}: HeaderProps) {
  return (
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
  );
}
