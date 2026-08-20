import { getInboxReplies } from "./actions";
import { InboxClient } from "./inbox-client";

export const metadata = {
  title: "Inbox | Veltrix",
};

export default async function InboxPage() {
  const replies = await getInboxReplies();

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
          <p className="text-muted-foreground mt-1">Manage replies from your leads.</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <InboxClient initialReplies={replies || []} />
      </div>
    </div>
  );
}
