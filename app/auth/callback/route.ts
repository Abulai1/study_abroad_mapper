import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// The sign-in email links here. We swap the one-time code for a session cookie.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Supabase sends these instead of a code when the link itself was rejected (e.g. already used).
  let reason = searchParams.get("error_description") ?? searchParams.get("error");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
    reason = error.message;
  }

  console.error("Sign-in link failed:", reason ?? "no code in link");
  const params = new URLSearchParams({ error: "link" });
  if (reason) params.set("reason", reason);
  return NextResponse.redirect(`${origin}/login?${params}`);
}
