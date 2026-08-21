import { EmailSendingProvider, SendEmailOptions } from "./types";
import { google } from "googleapis";
import { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export class GmailProvider implements EmailSendingProvider {
  private accountId: string;
  private supabase: SupabaseClient | null;

  constructor(accountId: string, supabaseClient?: SupabaseClient) {
    this.accountId = accountId;
    this.supabase = supabaseClient || null;
  }

  /**
   * Helper to get Supabase client (uses provided service client or server session client)
   */
  private async getSupabaseClient(): Promise<SupabaseClient> {
    if (this.supabase) {
      return this.supabase;
    }
    return (await createServerClient()) as unknown as SupabaseClient;
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
    const supabase = await this.getSupabaseClient();
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
    const supabase = await this.getSupabaseClient();
    const { data: account } = await supabase
      .from("email_accounts")
      .select("access_token, refresh_token, token_expires_at")
      .eq("id", this.accountId)
      .single();

    if (!account || !account.refresh_token) {
      return false;
    }

    // Check if token is still valid (with 5-min safety buffer)
    const now = Date.now();
    if (account.token_expires_at && new Date(account.token_expires_at).getTime() > now + 5 * 60 * 1000) {
      return true;
    }

    try {
      const oauth2Client = this.getOAuth2Client(account.access_token, account.refresh_token);
      const { credentials } = await oauth2Client.refreshAccessToken();

      await supabase
        .from("email_accounts")
        .update({
          access_token: credentials.access_token,
          refresh_token: credentials.refresh_token || account.refresh_token,
          token_expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
          status: "connected",
        })
        .eq("id", this.accountId);

      return true;
    } catch (error) {
      console.error("[GmailProvider] Failed to refresh Gmail token:", error);
      await supabase
        .from("email_accounts")
        .update({ status: "expired" })
        .eq("id", this.accountId);
      return false;
    }
  }

  async sendEmail(options: SendEmailOptions) {
    const isAuthed = await this.refreshAuthentication();
    if (!isAuthed) {
      return { 
        success: false, 
        error: "Authentication expired or invalid grant",
        isPermanentError: true,
      };
    }

    const supabase = await this.getSupabaseClient();
    const { data: account } = await supabase
      .from("email_accounts")
      .select("access_token, refresh_token, email_address, display_name")
      .eq("id", this.accountId)
      .single();

    if (!account) return { success: false, error: "Account not found", isPermanentError: true };

    try {
      const oauth2Client = this.getOAuth2Client(account.access_token, account.refresh_token);
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      const subject = Buffer.from(options.subject).toString("base64");
      const utf8Subject = `=?utf-8?B?${subject}?=`;
      
      const senderDisplayName = options.fromName || account.display_name || "";
      const fromHeader = senderDisplayName
        ? `From: =?utf-8?B?${Buffer.from(senderDisplayName).toString("base64")}?= <${account.email_address}>`
        : `From: ${account.email_address}`;

      // Convert body to clean HTML email structure with proper typography
      let htmlBody = options.body;
      if (!htmlBody.includes("<html") && !htmlBody.includes("<div") && !htmlBody.includes("<p>")) {
        let formatted = htmlBody.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        formatted = formatted.replace(
          /(https?:\/\/[^\s<]+)/g,
          '<a href="$1" style="color: #2563eb; text-decoration: underline;" target="_blank">$1</a>'
        );
        const paragraphs = formatted.split(/\n\s*\n/);
        htmlBody = paragraphs
          .map((p) => `<p style="margin: 0 0 16px 0; line-height: 1.6; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px;">${p.replace(/\n/g, "<br />")}</p>`)
          .join("");
      }

      const messageParts = [
        fromHeader,
        `To: ${options.to}`,
        `Subject: ${utf8Subject}`,
        "Content-Type: text/html; charset=utf-8",
        "MIME-Version: 1.0",
        `Date: ${new Date().toUTCString()}`,
      ];

      if (options.inReplyToMessageId) {
        messageParts.push(`In-Reply-To: ${options.inReplyToMessageId}`);
      }
      if (options.references) {
        messageParts.push(`References: ${options.references}`);
      }

      messageParts.push("");
      messageParts.push(htmlBody);

      // MIME standard requires CRLF
      const message = messageParts.join("\r\n");
      const encodedMessage = Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const requestBody: Record<string, string> = { raw: encodedMessage };
      if (options.threadId) {
        requestBody.threadId = options.threadId;
      }

      const res = await gmail.users.messages.send({
        userId: "me",
        requestBody,
      });

      return { 
        success: true, 
        messageId: res.data.id || undefined,
        threadId: res.data.threadId || undefined,
      };
    } catch (error: unknown) {
      console.error("[GmailProvider] Send error:", error);
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      const isRateLimit = errMsg.includes("429") || errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("quota");
      const isPermanent = errMsg.toLowerCase().includes("invalid_grant") || errMsg.toLowerCase().includes("unregistered");

      return { 
        success: false, 
        error: errMsg,
        isRateLimit,
        isPermanentError: isPermanent,
      };
    }
  }

  async fetchRecentInboxMessages(maxResults = 20) {
    const isAuthed = await this.refreshAuthentication();
    if (!isAuthed) throw new Error("Authentication expired or invalid");

    const supabase = await this.getSupabaseClient();
    const { data: account } = await supabase
      .from("email_accounts")
      .select("access_token, refresh_token")
      .eq("id", this.accountId)
      .single();

    if (!account) throw new Error("Account not found");

    const oauth2Client = this.getOAuth2Client(account.access_token, account.refresh_token);
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

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
