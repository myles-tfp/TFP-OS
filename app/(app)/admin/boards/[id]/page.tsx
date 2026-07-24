import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee } from "@/lib/get-franchisee";
import { BoardEditor } from "@/components/board-editor";
import { BoardMeta } from "@/components/board-meta";
import type { BoardPhase } from "@/lib/board";
import type { Location } from "@/lib/types";

/** Admin board editor: /admin/boards/template or /admin/boards/<locationId> */
export default async function AdminBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await getFranchisee();
  if (me.role !== "admin") redirect("/");

  const { id } = await params;
  const isTemplate = id === "template";
  const supabase = await createClient();

  let location: Location | null = null;
  if (!isTemplate) {
    const { data } = await supabase
      .from("locations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!data) notFound();
    location = data as Location;
  }

  let query = supabase
    .from("phases")
    .select("id, location_id, name, tag, sort_order, tasks(id, phase_id, title, owner, status, due_date, sort_order)")
    .order("sort_order");
  query = isTemplate ? query.is("location_id", null) : query.eq("location_id", id);
  const { data: phases } = await query;

  const sorted = ((phases ?? []) as unknown as BoardPhase[]).map((p) => ({
    ...p,
    tasks: [...p.tasks].sort((a, b) => a.sort_order - b.sort_order),
  }));

  return (
    <>
      <div className="page-head">
        <h1>{isTemplate ? "Template board" : location?.name}</h1>
        <Link href="/admin" className="link" style={{ fontSize: 13, color: "var(--dillball)" }}>
          ← Back to admin
        </Link>
      </div>
      <p className="subtitle">
        {isTemplate
          ? "Every new location starts with a copy of this board. Changes here don't affect existing boards."
          : "This location's onboarding board — phases, tasks, owners, due dates."}
      </p>

      {location && <BoardMeta location={location} />}

      <section className="panel" style={{ maxWidth: 860 }}>
        <BoardEditor
          phases={sorted}
          locationId={isTemplate ? null : id}
          adminMode
        />
      </section>
    </>
  );
}
