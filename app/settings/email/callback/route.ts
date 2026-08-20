import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

export async function GET(request: Request) {
  const urlObj = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || urlObj.host;
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${proto}://${host}`;

  const { searchParams } = urlObj;
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(`${baseUrl}/settings/email?error=oauth_rejected`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/settings/email?error=no_code`);
  }

  const supabase = await createClient();

  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    return NextResponse.redirect(`${baseUrl}/settings/email?error=no_workspace`);
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${baseUrl}/settings/email/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info (email address, display name)
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    if (!userInfo.data.email) {
      throw new Error("No email address returned from Google");
    }

    // Upsert the email account to database securely server-side
    // We do not send these tokens to the client ever
    const { error: dbError } = await supabase
      .from("email_accounts")
      .upsert({
        workspace_id: workspace.workspace_id,
        user_id: null,
        provider: "gmail",
        email_address: userInfo.data.email,
        display_name: userInfo.data.name || userInfo.data.email.split("@")[0],
        provider_account_id: userInfo.data.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token, // might be undefined if not first time
        token_expires_at: tokens.expiry_date,
        status: "connected",
        updated_at: new Date().toISOString()
      }, {
        onConflict: "workspace_id,email_address"
      });

    if (dbError) {
      console.error("[OAuth callback] dbError:", dbError);
      throw new Error(dbError.message);
    }

    // Log the activity
    await supabase.from("activity_logs").insert({
      workspace_id: workspace.workspace_id,
      user_id: null,
      action: "gmail_connected",
      details: { email_address: userInfo.data.email },
    });

    return NextResponse.redirect(`${baseUrl}/settings/email?success=true`);
  } catch (error) {
    console.error("OAuth callback error:", error);
    const msg = error instanceof Error ? error.message : "oauth_failed";
    return NextResponse.redirect(`${baseUrl}/settings/email?error=${encodeURIComponent(msg)}`);
  }
}
