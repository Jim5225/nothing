"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";

export async function getEmailAccounts() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();

  // Explicitly select only non-sensitive columns
  const { data, error } = await supabase
    .from("email_accounts")
    .select("id, email_address, provider, status, created_at, updated_at")
    .eq("workspace_id", workspace.workspace_id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data;
}

export async function disconnectEmailAccount(accountId: string) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) throw new Error("Unauthorized");

  const supabase = await createClient();

  const { error } = await supabase
    .from("email_accounts")
    .update({ status: "disconnected" })
    .eq("id", accountId)
    .eq("workspace_id", workspace.workspace_id);

  if (error) throw error;

  await logActivity("gmail_disconnected", { account_id: accountId });
  revalidatePath("/settings/email");
}
