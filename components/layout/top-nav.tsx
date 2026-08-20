import { Search } from "lucide-react";
import { UserMenu } from "@/components/layout/user-menu";
import type { User } from "@supabase/supabase-js";

interface TopNavProps {
  user: User;
  workspaceName?: string;
}

export function TopNav({ user, workspaceName }: TopNavProps) {
  return (
    <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200 shrink-0">
      {/* Left: workspace indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center">
            <span className="text-xs font-bold text-blue-700">
              {(workspaceName ?? "W")[0].toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-700">
            {workspaceName ?? "My Workspace"}
          </span>
        </div>
      </div>

      {/* Center: search placeholder */}
      <div className="hidden md:flex items-center gap-2 w-72 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 cursor-not-allowed">
        <Search className="w-4 h-4 shrink-0" />
        <span>Search… (coming soon)</span>
      </div>

      {/* Right: user menu */}
      <div className="flex items-center gap-3">
        <UserMenu user={user} />
      </div>
    </header>
  );
}
