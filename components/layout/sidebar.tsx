"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Inbox,
  BarChart2,
  GitPullRequestArrow,
  Settings,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Leads",
    href: "/dashboard/leads",
    icon: Users,
  },
  {
    label: "Campaigns",
    href: "/dashboard/campaigns",
    icon: Megaphone,
  },
  {
    label: "Inbox",
    href: "/dashboard/inbox",
    icon: Inbox,
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart2,
  },
  {
    label: "Pipeline",
    href: "/dashboard/pipeline",
    icon: GitPullRequestArrow,
  },
];

const bottomNavigation = [
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    exact: false,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-gray-900 text-white shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-700/60 shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-blue-600">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-sm tracking-tight">Veltrix</span>
      </div>

      {/* Primary navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom navigation */}
      <div className="px-3 pb-4 space-y-0.5 border-t border-gray-700/60 pt-4">
        {bottomNavigation.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
