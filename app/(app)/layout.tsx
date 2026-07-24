import { Sidebar, type Topic } from "@/components/sidebar";
import { RallyPanel, RallyBubble } from "@/components/rally";
import { ChatPanel } from "@/components/chat";
import { NotificationBell, type Notification } from "@/components/notification-bell";
import { getFranchisee } from "@/lib/get-franchisee";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const franchisee = await getFranchisee();
  const supabase = await createClient();
  const isAdmin = franchisee.role === "admin";

  const [{ data: topics }, { data: notifications }, { data: chatUnread }] =
    await Promise.all([
      supabase.from("topics").select("id, name, status").order("sort_order"),
      supabase
        .from("notifications")
        .select("id, kind, title, body, link, created_at")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase.rpc("unread_chat_count"),
    ]);

  const seenAt = franchisee.notifications_seen_at
    ? new Date(franchisee.notifications_seen_at).getTime()
    : 0;
  const unseen = (notifications ?? []).filter(
    (n) => new Date(n.created_at).getTime() > seenAt
  ).length;

  return (
    <div className="shell">
      <Sidebar
        franchisee={franchisee}
        topics={(topics ?? []) as Topic[]}
        chatUnread={chatUnread ?? 0}
      />
      <main className="main">{children}</main>
      <NotificationBell
        items={(notifications ?? []) as Notification[]}
        unseen={unseen}
      />
      <ChatPanel
        meId={franchisee.id}
        isAdmin={isAdmin}
        canManage={franchisee.location_role === "manager"}
        myLocationId={franchisee.location_id}
      />
      <RallyBubble />
      <RallyPanel />
    </div>
  );
}
