"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

// Supabase error codes → messages people can act on.
const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Wrong email or password.",
  user_already_exists: "There's already an account with this email. Sign in instead.",
  weak_password: "Password must be at least 8 characters.",
  over_request_rate_limit: "Too many attempts. Wait a minute and try again.",
  email_not_confirmed: "This account's email hasn't been confirmed yet.",
};

// Email + password form, used on /login and in the welcome pop-up.
export default function SignInForm({
  autoFocus = false,
  initialMode = "signin",
}: {
  autoFocus?: boolean;
  initialMode?: Mode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // /auth/callback sends people back to /login with ?error=link if an emailed link didn't work.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "link") {
      const reason = params.get("reason");
      setError(`That sign-in link didn't work${reason ? ` (${reason})` : ""}. Sign in with your password instead.`);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    if (error) {
      setError((error.code && ERROR_MESSAGES[error.code]) || error.message);
      setBusy(false);
      return;
    }
    // The session is now in a cookie; reload the map so the server sees who's signed in.
    router.push("/");
    router.refresh();
  }

  function switchMode() {
    setMode(mode === "signin" ? "signup" : "signin");
    setError("");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        required
        autoFocus={autoFocus}
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@university.edu"
        aria-label="Email address"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />
      <input
        type="password"
        required
        minLength={8}
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={mode === "signin" ? "Password" : "Password (8+ characters)"}
        aria-label="Password"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-center text-sm text-slate-600">
        {mode === "signin" ? "New here? " : "Have an account? "}
        <button type="button" onClick={switchMode} className="font-medium text-indigo-600 hover:text-indigo-700">
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </form>
  );
}
