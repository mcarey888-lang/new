import React, { useState, useEffect } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

const SESSION_KEY = "summit_admin_auth";
const CORRECT_KEY = import.meta.env.VITE_ADMIN_KEY ?? "summitadmin2025";

interface AdminGuardProps {
  children: React.ReactNode;
  title?: string;
}

/**
 * Gates access to admin pages behind a password prompt.
 * The entered key is held in sessionStorage so re-opening the same tab
 * doesn't require re-entry, but closing the browser clears it.
 *
 * Set VITE_ADMIN_KEY in environment variables to change the password.
 */
export function AdminGuard({ children, title = "Admin Area" }: AdminGuardProps) {
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === CORRECT_KEY) {
      setAuthed(true);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === CORRECT_KEY) {
      sessionStorage.setItem(SESSION_KEY, CORRECT_KEY);
      setAuthed(true);
      setError("");
    } else {
      setError("Incorrect access key.");
      setInput("");
    }
  }

  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
            <Lock className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg">{title}</h1>
            <p className="text-gray-500 text-sm">Enter access key to continue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={input}
              onChange={e => { setInput(e.target.value); setError(""); }}
              placeholder="Access key"
              autoFocus
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-3 pr-12 placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
