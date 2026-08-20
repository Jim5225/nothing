import { createClient } from "@/lib/supabase/server";

export async function getCurrentWorkspace() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: workspaceUser } = await supabase
    .from("workspace_users")
    .select(`
      workspace_id,
      role,
      workspaces (
        id,
        name,
        slug
      )
    `)
    .eq("user_id", user.id)
    .single();

  if (workspaceUser && workspaceUser.workspaces) {
    return {
      workspace_id: workspaceUser.workspace_id,
      role: workspaceUser.role,
      workspaces: Array.isArray(workspaceUser.workspaces) ? workspaceUser.workspaces[0] : workspaceUser.workspaces,
    };
  }

  return null;
}

