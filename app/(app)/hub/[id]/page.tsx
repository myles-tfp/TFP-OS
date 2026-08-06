import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee } from "@/lib/get-franchisee";
import { TeamTheme } from "@/components/team-theme";
import { HubAdmin, type HubMemberRow } from "@/components/hub-admin";

export default async function HubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const franchisee = await getFranchisee();
  const supabase = await createClient();

  const [{ data: hub }, { data: memberRows }] = await Promise.all([
    supabase.from("hubs").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("hub_members")
      .select("franchisee_id, role, franchisees(display_name, email)")
      .eq("hub_id", id)
      .order("added_at"),
  ]);

  // not a member (or hub doesn't exist) — RLS returns nothing either way
  if (!hub) redirect("/");

  const members: HubMemberRow[] = ((memberRows ?? []) as unknown as {
    franchisee_id: string;
    role: string;
    franchisees: { display_name: string | null; email: string } | null;
  }[]).map((m) => ({
    franchisee_id: m.franchisee_id,
    role: m.role,
    name: m.franchisees?.display_name || m.franchisees?.email || "Member",
  }));

  const me = members.find((m) => m.franchisee_id === franchisee.id);
  const amOwner = me?.role === "owner";

  // teammates at this location who aren't in the hub yet (for the add menu)
  const { data: locTeam } = amOwner
    ? await supabase
        .from("franchisees")
        .select("id, email, display_name")
        .eq("location_id", hub.location_id)
        .eq("status", "active")
    : { data: [] };
  const inHub = new Set(members.map((m) => m.franchisee_id));
  const candidates = ((locTeam ?? []) as {
    id: string;
    email: string;
    display_name: string | null;
  }[])
    .filter((t) => !inHub.has(t.id))
    .map((t) => ({ id: t.id, name: t.display_name || t.email }));

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <>
      <TeamTheme />
      <div className="page-head">
        <h1>{hub.name}</h1>
        <span className="date">{today}</span>
      </div>
      <p className="subtitle">
        Your team&apos;s private space — tasks, board, calendar, and{" "}
        <strong>#{hub.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}</strong>{" "}
        in chat. Only hub members can see any of it.
      </p>

      <div className="cols">
        <section className="panel">
          <div className="panel-head">
            <h2>Team</h2>
          </div>
          <HubAdmin
            hubId={hub.id}
            hubName={hub.name}
            members={members}
            candidates={candidates}
            meId={franchisee.id}
            amOwner={amOwner}
          />
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Coming next</h2>
          </div>
          <p className="panel-note">
            This hub&apos;s task board with progress cards, the community
            board, weekly progress, announcements, and the calendar all land
            here — being built in the next updates. Chat is live now: open the
            chat panel and look below the divider for your hub&apos;s channels.
          </p>
        </section>
      </div>
    </>
  );
}
