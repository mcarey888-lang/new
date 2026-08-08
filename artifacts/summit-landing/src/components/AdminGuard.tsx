import React, { useState, useEffect, useCallback } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

/**
 * Admin access guard — server-side verified.
 *
 * On mount, checks whether a stored admin token is still valid by calling
 * GET /api/admin/me. If the token is valid the admin UI renders immediately.
 *
 * When no token is stored (or it has expired / been revoked) the user sees a
 * password prompt. The entered password is sent to POST /api/admin/login on
 * the server; the client never compares the password itself. On success the
 * returned token is stored in sessionStorage for the tab's lifetime.
 *
 * The VITE_ADMIN_KEY env var and any hardcoded fallback have been removed.
 * No secret is compiled into this bundle.
 */

const TOKEN_KEY = "summit_admin_token";
const API_BASE  = import.meta.env.VITE_API_BASE ?? "/api";

function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getAdminToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function adminFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  return fetch(input, {
    ...init,
    headers: {
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

interface AdminGuardProps {
  children: React.ReactNode;
  title?: string;
}

export function AdminGuard({ children, title = "Admin Area" }: AdminGuardProps) {
  const [status, setStatus] = useState<"loading" | "authed" | "denied">("loading");
  const [input, setInput]   = useState("");
  const [error, setError]   = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // On mount: validate any existing token with the server
  useEffect(() => {
    const token = getStoredToken();
    if (!token) { setStatus("denied"); return; }

    fetch(`${API_BASE}/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.ok) setStatus("authed");
        else {
          sessionStorage.removeItem(TOKEN_KEY);
          setStatus("denied");
        }
      })
      .catch(() => {
        sessionStorage.removeItem(TOKEN_KEY);
        setStatus("denied");
      });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const r = await fetch(`${API_BASE}/admin/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password: input }),
      });

      if (r.ok) {
        const { token } = await r.json() as { token: string };
        sessionStorage.setItem(TOKEN_KEY, token);
        setStatus("authed");
        setInput("");
      } else {
        setError("Incorrect access key.");
        setInput("");
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [input]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-sm">Verifying access…</div>
      </div>
    );
  }

  if (status === "authed") return <>{children}</>;

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
              disabled={submitting}
              className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-3 pr-12 placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !input}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Verifying…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
