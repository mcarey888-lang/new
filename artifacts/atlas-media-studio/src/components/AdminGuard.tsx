import React, { useState, useEffect, useCallback } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { getAdminToken, setAdminToken, clearAdminToken } from "@/lib/adminToken";

const API_BASE = "/api";

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const [status, setStatus]       = useState<"loading" | "authed" | "denied">("loading");
  const [input, setInput]         = useState("");
  const [error, setError]         = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) { setStatus("denied"); return; }

    fetch(`${API_BASE}/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.ok) setStatus("authed");
        else { clearAdminToken(); setStatus("denied"); }
      })
      .catch(() => { clearAdminToken(); setStatus("denied"); });
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
        setAdminToken(token);
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Verifying access…</p>
      </div>
    );
  }

  if (status === "authed") return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-lg">Atlas Media Studio</h1>
            <p className="text-muted-foreground text-sm">Admin access required</p>
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
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !input}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Verifying…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
