import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Franchisee } from "@/lib/types";

/**
 * Returns the signed-in user's franchisee profile (the allowlist row).
 * If the user is signed in but not on the allowlist, they are signed out
 * and sent back to login — the allowlist is the source of truth for access.
 */
export async function getFranchisee(): Promise<Franchisee> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: franchisee, error } = await supabase
    .from("franchisees")
    .select("*")
    .ilike("email", user.email ?? "")
    .eq("status", "active")
    .maybeSingle();

  if (!franchisee) {
    await supabase.auth.signOut();
    if (error) console.error("franchisees lookup failed:", error);
    redirect("/login?error=not_authorized");
  }

  return franchisee as Franchisee;
}
