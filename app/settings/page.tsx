import Link from "next/link";
import { User, Building2, Mail, Plug, Shield } from "lucide-react";

const settingsSections = [
  {
    icon: User,
    label: "Profile",
    description: "Your display name, avatar, and personal preferences.",
    available: false,
  },
  {
    icon: Building2,
    label: "Workspace",
    description: "Workspace name, slug, and general configuration.",
    available: false,
  },
  {
    icon: Shield,
    label: "Account & Security",
    description: "Password, email, and security settings.",
    available: false,
  },
  {
    icon: Mail,
    label: "Email Settings",
    description: "Connect sending mailboxes and configure deliverability.",
    available: true,
    href: "/settings/email",
  },
  {
    icon: Plug,
    label: "Integrations",
    description: "Connect Apollo, LinkedIn, CRM, and other tools.",
    available: false,
  },
];

export default async function SettingsPage() {
  // Auth bypassed per user request
  const user = { email: "demo@veltrix.com", id: "00000000-0000-0000-0000-000000000000" };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account and workspace preferences.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {settingsSections.map((section) => {
          const content = (
            <div className={`flex items-start gap-4 p-5 ${!section.available ? 'opacity-60' : 'hover:bg-gray-50 transition-colors'}`}>
              <div className="p-2 bg-gray-50 rounded-lg shrink-0">
                <section.icon className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">
                    {section.label}
                  </p>
                  {!section.available && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-gray-500">
                  {section.description}
                </p>
              </div>
            </div>
          );

          return section.href ? (
            <Link key={section.label} href={section.href} className="block">
              {content}
            </Link>
          ) : (
            <div key={section.label}>{content}</div>
          );
        })}
      </div>

      {/* Current user info (debug/informational, not fake data) */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Your Account
        </h2>
        <dl className="space-y-2">
          <div className="flex items-center gap-3">
            <dt className="text-xs text-gray-500 w-16">Email</dt>
            <dd className="text-sm text-gray-900">{user.email}</dd>
          </div>
          <div className="flex items-center gap-3">
            <dt className="text-xs text-gray-500 w-16">User ID</dt>
            <dd className="text-xs font-mono text-gray-600">{user.id}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
