import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspace } from "@/lib/workspace";

export async function logActivity(action: string, details: Record<string, unknown> = {}) {
  try {
    const workspace = await getCurrentWorkspace();
    if (!workspace) return;

    const supabase = await createClient();
    
    // Auth bypassed, user is null for activity logs
    const userId = null;

    await supabase.from("activity_logs").insert({
      workspace_id: workspace.workspace_id,
      user_id: userId,
      action,
      details,
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}
