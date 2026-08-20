import { createClient } from "@supabase/supabase-js";
import { GmailProvider } from "./gmail-provider";

export async function processReplySync() {
  // Use Service Role Key to bypass RLS and sync replies for all workspaces
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: accounts, error: accountsError } = await supabase
    .from("email_accounts")
    .select("*")
    .eq("status", "connected");

  if (accountsError || !accounts) {
    console.error("Failed to fetch email accounts", accountsError);
    return { error: accountsError?.message };
  }

  let totalProcessed = 0;
  let newReplies = 0;

  for (const account of accounts) {
    try {
      const provider = new GmailProvider(account.id, supabase);
      const messages = await provider.fetchRecentInboxMessages(15);

      for (const msg of messages) {
        if (!msg.id) continue;
        
        // 1. Check if already processed
        const { data: existing } = await supabase
          .from("replies")
          .select("id")
          .eq("provider_message_id", msg.id)
          .single();

        if (existing) continue; // Already synced this message
        totalProcessed++;

        // 2. Parse headers
        const headers = msg.payload?.headers || [];
        const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
        
        const fromHeader = getHeader("From");
        const toHeader = getHeader("To");
        const subject = getHeader("Subject");
        const threadId = msg.threadId || "";
        
        // Extract plain email address from format "Name <email@domain.com>" or "email@domain.com"
        const extractEmail = (str: string) => {
          const match = str.match(/<([^>]+)>/);
          return (match ? match[1] : str).trim().toLowerCase();
        };

        const fromEmail = extractEmail(fromHeader);

        // Extract body (plain text preferred)
        let body = "";
        if (msg.payload?.parts) {
          const textPart = msg.payload.parts.find(p => p.mimeType === "text/plain");
          if (textPart && textPart.body?.data) {
            body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
          } else if (msg.payload.parts[0]?.body?.data) {
             body = Buffer.from(msg.payload.parts[0].body.data, "base64").toString("utf-8");
          }
        } else if (msg.payload?.body?.data) {
          body = Buffer.from(msg.payload.body.data, "base64").toString("utf-8");
        }

        // 3. Match against Leads
        // We look for a lead with this email in the same workspace
        const { data: lead } = await supabase
          .from("leads")
          .select("id, workspace_id, status")
          .eq("workspace_id", account.workspace_id)
          .eq("normalized_email", fromEmail)
          .single();

        if (!lead) continue; // Not a reply from a known lead

        // 4. Find Active Campaign Recipient
        // Order by created_at DESC to get the most recent outreach
        const { data: recipient } = await supabase
          .from("campaign_recipients")
          .select("id, campaign_id, status")
          .eq("lead_id", lead.id)
          .eq("workspace_id", account.workspace_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!recipient) continue;

        // 5. Insert Reply
        const { error: replyError } = await supabase
          .from("replies")
          .insert({
            workspace_id: account.workspace_id,
            lead_id: lead.id,
            campaign_id: recipient.campaign_id,
            campaign_recipient_id: recipient.id,
            provider_message_id: msg.id,
            thread_id: threadId,
            from_email: fromHeader, // Store full format for UI
            to_email: toHeader,
            subject: subject,
            body: body,
            received_at: new Date(parseInt(msg.internalDate || Date.now().toString())).toISOString(),
          });

        if (replyError) {
          console.error("Failed to insert reply", replyError);
          continue;
        }

        newReplies++;

        // 6. Update Recipient Status -> 'replied' and stop further outreach
        if (recipient.status !== "replied") {
          await supabase
            .from("campaign_recipients")
            .update({ 
              status: "replied", 
              replied_at: new Date().toISOString() 
            })
            .eq("id", recipient.id);

          // If there's an email job still queued, it won't send because processEmailQueue 
          // explicitly checks that recipient.status must be 'queued' or 'sending'.

          // 7. Update Lead Status to 'replied' if it's not already something further
          if (lead.status !== "interested" && lead.status !== "meeting" && lead.status !== "won") {
            await supabase
              .from("leads")
              .update({ status: "replied" })
              .eq("id", lead.id)
              .eq("workspace_id", account.workspace_id);
          }

          // 8. Log Activity
          await supabase.from("activity_logs").insert({
            workspace_id: account.workspace_id,
            action: "reply_detected",
            details: {
              campaign_id: recipient.campaign_id,
              lead_id: lead.id,
              from: fromEmail
            }
          });
        }
      }
    } catch (err) {
      console.error(`Error syncing replies for account ${account.id}:`, err);
    }
  }

  return { totalProcessed, newReplies };
}
