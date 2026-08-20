import { Suspense } from "react";
import { getEmailAccounts } from "./actions";
import { EmailClient } from "./email-client";

export const metadata = {
  title: "Email Settings | Veltrix",
};

export default async function EmailSettingsPage() {
  const accounts = await getEmailAccounts();

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Email Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect your sending mailboxes. Currently supporting Google Workspace (Gmail).
        </p>
      </div>

      <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading email settings...</div>}>
        <EmailClient initialAccounts={accounts || []} />
      </Suspense>
    </div>
  );
}

