import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";

import type { User } from "@supabase/supabase-js";
import { getCurrentWorkspace } from "@/lib/workspace";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Server-side auth guard bypassed per user request
  const user = {
    id: "123",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "",
    email: "demo@veltrix.com",
  } as unknown as User;

  const workspace = await getCurrentWorkspace();
  const workspaceName = workspace?.workspaces?.name ?? undefined;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopNav user={user} workspaceName={workspaceName} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
