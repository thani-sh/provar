import React, { useState } from "react";

interface AuthFormProps {
  authMode: "login" | "register";
  setAuthMode: (mode: "login" | "register") => void;
  authError: string | null;
  setAuthError: (error: string | null) => void;
  onAuth: (
    e: React.FormEvent,
    username: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
}

export function AuthForm({
  authMode,
  setAuthMode,
  authError,
  setAuthError,
  onAuth,
}: AuthFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    onAuth(e, username, password, displayName);
  };

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
          onSubmit={handleSubmit}
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
