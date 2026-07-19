import { Sidebar, type Topic } from "@/components/sidebar";
import { RallyPanel } from "@/components/rally";
import { NotificationBell, type Notification } from "@/components/notification-bell";
import { getFranchisee } from "@/lib/get-franchisee";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const franchisee = await getFranchisee();
  const supabase = await createClient();

  const [{ data: topics }, { data: notifications }] = await Promise.all([
    supabase.from("topics").select("id, name, status").order("sort_order"),
    supabase
      .from("notifications")
      .select("id, kind, title, body, link, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const seenAt = franchisee.notifications_seen_at
    ? new Date(franchisee.notifications_seen_at).getTime()
    : 0;
  const unseen = (notifications ?? []).filter(
    (n) => new Date(n.created_at).getTime() > seenAt
  ).length;

  return (
    <div className="shell">
      <Sidebar franchisee={franchisee} topics={(topics ?? []) as Topic[]} />
      <main className="main">{children}</main>
      <NotificationBell
        items={(notifications ?? []) as Notification[]}
        unseen={unseen}
      />
      <RallyPanel />
    </div>
  );
}
