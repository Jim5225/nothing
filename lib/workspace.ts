import { createClient } from "@/lib/supabase/server";

export async function getCurrentWorkspace() {
  const supabase = await createClient();

  // Completely bypassed user check to allow public access
  // Fetch the first available workspace
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (workspace) {
    return {
      workspace_id: workspace.id,
      role: "owner",
      workspaces: workspace,
    };
  }

  return null;
}

