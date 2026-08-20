import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback route handler.
 *
 * Handles the PKCE code exchange after:
 *  - Email confirmation
 *  - OAuth sign-in (if added in future)
 *  - Magic link authentication (if added in future)
 *
 * The `code` query parameter is exchanged for a Supabase session.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `next` allows deep-linking after authentication
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Use the configured site URL in production to avoid open redirect
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Authentication failed — redirect with an error flag
  console.error("[auth/callback] Code exchange failed");
  return NextResponse.redirect(
    `${origin}/login?error=Authentication+failed.+Please+try+again.`
  );
}
