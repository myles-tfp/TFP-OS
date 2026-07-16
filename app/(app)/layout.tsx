import { Sidebar, type Topic } from "@/components/sidebar";
import { RallyPanel } from "@/components/rally";
import { getFranchisee } from "@/lib/get-franchisee";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const franchisee = await getFranchisee();
  const supabase = await createClient();

  // Topic boards drive the sidebar nav — they're data, not code.
  const { data: topics } = await supabase
    .from("topics")
    .select("id, name, status")
    .order("sort_order");

  return (
    <div className="shell">
      <Sidebar franchisee={franchisee} topics={(topics ?? []) as Topic[]} />
      <main className="main">{children}</main>
      <RallyPanel />
    </div>
  );
}
