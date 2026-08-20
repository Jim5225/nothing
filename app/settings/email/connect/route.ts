import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(request: Request) {
  const urlObj = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || urlObj.host;
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${proto}://${host}`;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${baseUrl}/settings/email?error=missing_credentials`
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${baseUrl}/settings/email/callback`
  );

  const scopes = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // Force to get refresh_token
    scope: scopes,
  });

  return NextResponse.redirect(url);
}

