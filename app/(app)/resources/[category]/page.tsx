import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee } from "@/lib/get-franchisee";
import { ResourceRow, type Resource } from "@/components/resource-row";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  await getFranchisee();
  const { category } = await params;
  const supabase = await createClient();

  const { data: cat } = await supabase
    .from("resource_categories")
    .select("id, name")
    .eq("id", category)
    .maybeSingle();

  if (!cat) notFound();

  const { data: resources } = await supabase
    .from("resources")
    .select("id, title, type, url, updated_at, resource_categories(name)")
    .eq("category_id", cat.id)
    .order("updated_at", { ascending: false });

  return (
    <>
      <div className="page-head">
        <h1>{cat.name}</h1>
      </div>
      <p className="subtitle">
        Everything in {cat.name} — always the current version.
      </p>

      <section className="panel" style={{ maxWidth: 760 }}>
        {(resources ?? []).length === 0 ? (
          <p className="panel-note">
            Nothing in this category yet — HQ adds resources from the Admin
            page.
          </p>
        ) : (
          (resources ?? []).map((r) => (
            <ResourceRow
              key={r.id}
              resource={r as unknown as Resource}
              showCategory={false}
            />
          ))
        )}
      </section>
    </>
  );
}
