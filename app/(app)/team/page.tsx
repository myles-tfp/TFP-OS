import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee, locationName } from "@/lib/get-franchisee";
import { TeamManager } from "@/components/team-manager";
import type { Franchisee } from "@/lib/types";

export default async function TeamPage() {
  const me = await getFranchisee();
  if (me.location_role !== "manager" && me.role !== "admin") redirect("/");
  if (!me.location_id) redirect("/");

  const supabase = await createClient();
  const { data: team } = await supabase
    .from("franchisees")
    .select("*")
    .eq("location_id", me.location_id)
    .order("created_at");

  return (
    <>
      <div className="page-head">
        <h1>Your team — {locationName(me)}</h1>
      </div>
      <p className="subtitle">
        Invite anyone who helps run your club — social, front desk, coaches.
        They can only see {locationName(me)}.
      </p>

      <section className="panel" style={{ maxWidth: 640 }}>
        <TeamManager team={(team ?? []) as Franchisee[]} me={me} />
      </section>
    </>
  );
}
