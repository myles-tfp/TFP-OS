import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Franchisee } from "@/lib/types";

/**
 * Returns the signed-in member's roster row with their location joined.
 * Not on the roster (or inactive) -> signed out. The roster is the
 * source of truth for access.
 */
export async function getFranchisee(): Promise<Franchisee> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: franchisee, error } = await supabase
    .from("franchisees")
    .select("*, locations(*)")
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

/** Display name for the member's club. */
export function locationName(f: Franchisee): string {
  return f.locations?.name || f.location_name || f.email;
}

/** Owners have all admin powers. */
export function isAdminRole(f: Pick<Franchisee, "role">): boolean {
  return f.role === "admin" || f.role === "owner";
}
