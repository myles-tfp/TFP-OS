import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee, isAdminRole } from "@/lib/get-franchisee";
import { createHub } from "@/app/(app)/actions";
import { TeamTheme } from "@/components/team-theme";

export default async function NewHubPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const franchisee = await getFranchisee();
  const canCreate =
    isAdminRole(franchisee) || franchisee.location_role === "manager";
  if (!canCreate || !franchisee.location_id) redirect("/");

  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: teammates } = await supabase
    .from("franchisees")
    .select("id, email, display_name")
    .eq("location_id", franchisee.location_id)
    .eq("status", "active")
    .neq("id", franchisee.id)
    .order("created_at");

  return (
    <>
      <TeamTheme />
      <div className="page-head">
        <h1>Create a Team Hub</h1>
      </div>
      <p className="subtitle">
        A private workspace for your team — its own tasks, board, calendar, and
        chat. Only the people you pick can see inside (HQ included: no invite,
        no access).
      </p>

      {error && (
        <div className="auth-error" style={{ maxWidth: 560 }}>
          Couldn&apos;t create:{" "}
          {error === "missing" ? "the hub needs a name." : error}
        </div>
      )}

      <section className="panel" style={{ maxWidth: 560 }}>
        <form action={createHub}>
          <div className="field">
            <label htmlFor="hub-name">Hub name</label>
            <input
              id="hub-name"
              name="name"
              type="text"
              required
              placeholder="Front Desk Crew"
            />
            <p className="panel-note" style={{ marginTop: 6 }}>
              A #channel with this name is created in chat automatically —
              rename the hub later and the channel renames with it.
            </p>
          </div>

          <div className="field">
            <label>Pick your team</label>
            {(teammates ?? []).length === 0 ? (
              <p className="panel-note">
                No other members at your location yet — you can add people
                later from the hub page as they join.
              </p>
            ) : (
              (teammates ?? []).map((t) => (
                <label className="check" key={t.id}>
                  <input type="checkbox" name="members" value={t.id} />
                  {t.display_name || t.email}
                </label>
              ))
            )}
          </div>

          <button type="submit" className="btn">
            Create hub
          </button>
        </form>
      </section>
    </>
  );
}
