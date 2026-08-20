import { EmailSendingProvider, SendEmailOptions } from "./types";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";

export class GmailProvider implements EmailSendingProvider {
  private accountId: string;

  constructor(accountId: string) {
    this.accountId = accountId;
  }

  private getOAuth2Client(accessToken: string, refreshToken: string) {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://veltrix-roan.vercel.app";

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${baseUrl}/settings/email/callback`
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    return oauth2Client;
  }

  async getAccount() {
    const supabase = await createClient();
    const { data: account, error } = await supabase
      .from("email_accounts")
      .select("email_address, status")
      .eq("id", this.accountId)
      .single();

    if (error || !account) {
      throw new Error("Account not found");
    }

    return {
      email: account.email_address,
      status: account.status,
    };
  }

  async refreshAuthentication(): Promise<boolean> {
    const supabase = await createClient();
    const { data: account } = await supabase
      .from("email_accounts")
      .select("access_token, refresh_token, token_expires_at")
      .eq("id", this.accountId)
      .single();

    if (!account || !account.refresh_token) {
      return false;
    }

    // Check if token is actually expired (buffer of 5 mins)
    const now = Date.now();
    if (account.token_expires_at && account.token_expires_at > now + 5 * 60 * 1000) {
      return true; // Still valid
    }

    try {
      const oauth2Client = this.getOAuth2Client(account.access_token, account.refresh_token);
      const { credentials } = await oauth2Client.refreshAccessToken();

      // Update in DB
      await supabase
        .from("email_accounts")
        .update({
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || account.refresh_token, // Sometimes refresh_token is not returned
          token_expires_at: credentials.expiry_date,
          status: "connected",
        })
        .eq("id", this.accountId);

      return true;
    } catch (error) {
      console.error("Failed to refresh Gmail token:", error);
      // Mark as expired
      await supabase
        .from("email_accounts")
        .update({ status: "expired" })
        .eq("id", this.accountId);
      return false;
    }
  }

  async sendEmail(options: SendEmailOptions) {
    // Ensure token is fresh
    const isAuthed = await this.refreshAuthentication();
    if (!isAuthed) {
      return { success: false, error: "Authentication expired or invalid" };
    }

    const supabase = await createClient();
    const { data: account } = await supabase
      .from("email_accounts")
      .select("access_token, refresh_token, email_address")
      .eq("id", this.accountId)
      .single();

    if (!account) return { success: false, error: "Account not found" };

    try {
      const oauth2Client = this.getOAuth2Client(account.access_token, account.refresh_token);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      // Construct MIME message
      const subject = Buffer.from(options.subject).toString("base64");
      const utf8Subject = `=?utf-8?B?${subject}?=`;
      
      const messageParts = [
        `From: ${account.email_address}`,
        `To: ${options.to}`,
        `Subject: ${utf8Subject}`,
        "Content-Type: text/html; charset=utf-8",
        "MIME-Version: 1.0",
        "",
        options.body,
      ];
      const message = messageParts.join("\n");
      const encodedMessage = Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedMessage,
        },
      });

      return { success: true, messageId: res.data.id || undefined };
    } catch (error: unknown) {
      console.error("Gmail send error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async fetchRecentInboxMessages(maxResults = 20) {
    const isAuthed = await this.refreshAuthentication();
    if (!isAuthed) throw new Error("Authentication expired or invalid");

    const supabase = await createClient();
    const { data: account } = await supabase
      .from("email_accounts")
      .select("access_token, refresh_token")
      .eq("id", this.accountId)
      .single();

    if (!account) throw new Error("Account not found");

    const oauth2Client = this.getOAuth2Client(account.access_token, account.refresh_token);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Fetch recent messages in inbox
    const res = await gmail.users.messages.list({
      userId: "me",
      q: "in:inbox",
      maxResults,
    });

    const messages = res.data.messages || [];
    const fullMessages = [];

    for (const msg of messages) {
      if (!msg.id) continue;
      try {
        const msgRes = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "full",
        });
        fullMessages.push(msgRes.data);
      } catch (e) {
        console.error("Failed to fetch message", msg.id, e);
      }
    }

    return fullMessages;
  }
}
