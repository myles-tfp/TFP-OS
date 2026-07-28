import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * PlayByPoint webhook receiver.
 * Counts founders memberships per location in real time:
 *  - membership_created on a plan whose name contains "found" → +1
 *  - membership_cancelled → -1
 * Each membership is tracked individually (keyed by PlayByPoint's
 * membership id), so webhook retries can never double-count.
 * Updating locations.founding_members fires the snapshot trigger,
 * which feeds the founders timeline automatically.
 */
export async function POST(req: Request) {
  // ---- auth: PlayByPoint sends "Authorization: Bearer <token>" ----
  const token = process.env.PBP_WEBHOOK_TOKEN;
  const auth = req.headers.get("authorization") ?? "";
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.event !== "string") {
    return NextResponse.json({ ok: false, error: "bad payload" }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 500 });
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  });

  const data = body.data ?? {};
  const facility = data.facility ?? {};

  // ---- log every event (idempotent by webhook_id) ----
  if (typeof body.webhook_id === "string") {
    await db.from("pbp_events").upsert(
      {
        webhook_id: body.webhook_id,
        event: body.event,
        facility: facility.name ?? null,
        payload: body,
      },
      { onConflict: "webhook_id", ignoreDuplicates: true }
    );
  }

  // Test deliveries from the PlayByPoint admin UI: acknowledge, don't count
  if (req.headers.get("x-webhook-test") === "true") {
    return NextResponse.json({ ok: true, test: true });
  }

  const membershipId: string | undefined = data.membership?.id;
  if (!membershipId) return NextResponse.json({ ok: true, skipped: true });

  // ---- match the facility to a TFP OS location ----
  const { data: locs } = await db
    .from("locations")
    .select("id, name, pbp_facility");
  const fid = String(facility.id ?? "").trim().toLowerCase();
  const fraw = String(facility.raw_id ?? "").trim().toLowerCase();
  const fname = String(facility.name ?? "").trim().toLowerCase();
  const loc =
    (locs ?? []).find((l) => {
      const k = (l.pbp_facility ?? "").trim().toLowerCase();
      return k !== "" && (k === fid || k === fname || k === fraw);
    }) ?? (locs ?? []).find((l) => l.name.trim().toLowerCase() === fname);
  if (!loc) return NextResponse.json({ ok: true, unmatched: true });

  // ---- apply the event ----
  if (body.event === "membership_created") {
    const planName: string =
      data.plan?.name ?? data.membership_plan?.name ?? "";
    const priceName: string = data.plan?.membership_plan_price_name ?? "";
    // founders plans only — plan or price name contains "found"
    if (!/found/i.test(`${planName} ${priceName}`)) {
      return NextResponse.json({ ok: true, skipped: "not a founders plan" });
    }
    await db.from("pbp_members").upsert(
      {
        membership_id: membershipId,
        location_id: loc.id,
        user_email: data.user?.email ?? null,
        user_name:
          [data.user?.first_name, data.user?.last_name]
            .filter(Boolean)
            .join(" ") || null,
        plan_name: planName || priceName || null,
        status: "active",
        cancelled_at: null,
      },
      { onConflict: "membership_id" }
    );
  } else if (body.event === "membership_cancelled") {
    // only affects memberships we're already tracking — no-op otherwise
    await db
      .from("pbp_members")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("membership_id", membershipId);
  } else {
    return NextResponse.json({ ok: true, ignored: body.event });
  }

  // ---- recount active founders and update the location ----
  const { count } = await db
    .from("pbp_members")
    .select("*", { count: "exact", head: true })
    .eq("location_id", loc.id)
    .eq("status", "active");
  await db
    .from("locations")
    .update({ founding_members: count ?? 0 })
    .eq("id", loc.id);

  return NextResponse.json({ ok: true, location: loc.name, founders: count ?? 0 });
}
