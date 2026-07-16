import { Sidebar } from "@/components/sidebar";
import { getFranchisee } from "@/lib/get-franchisee";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const franchisee = await getFranchisee();
  const supabase = await createClient();

  // Resource categories drive the sidebar nav — they're data, not code.
  const { data: categories } = await supabase
    .from("resource_categories")
    .select("id, name")
    .order("sort_order");

  return (
    <div className="shell">
      <Sidebar franchisee={franchisee} categories={categories ?? []} />
      <main className="main">{children}</main>
    </div>
  );
}
