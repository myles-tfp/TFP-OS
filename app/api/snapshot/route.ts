import { createClient as createSupabase } from "@supabase/supabase-js";

/**
 * Daily founders snapshot — invoked by Vercel Cron (see vercel.json).
 * The DB function is idempotent (one row per location per day), so
 * extra invocations are harmless.
 */
export async function GET() {
  const supabase = createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { error } = await supabase.rpc("snapshot_founders");
  if (error) {
    console.error("snapshot_founders failed:", error.message);
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}
