"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee, isAdminRole } from "@/lib/get-franchisee";

export async function toggleReaction(postId: string, emoji: string) {
  const franchisee = await getFranchisee();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("post_id", postId)
    .eq("franchisee_id", franchisee.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await supabase.from("reactions").delete().eq("id", existing.id);
  } else {
    await supabase.from("reactions").insert({
      post_id: postId,
      franchisee_id: franchisee.id,
      emoji,
    });
  }

  revalidatePath("/");
}

export async function createBoard(formData: FormData) {
  const franchisee = await getFranchisee();
  if (!isAdminRole(franchisee)) redirect("/");

  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/admin?error=missing");

  const { data: last } = await supabase
    .from("topics")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("topics").insert({
    name,
    sort_order: (last?.sort_order ?? 0) + 1,
    status: formData.get("coming_soon") === "on" ? "coming_soon" : "live",
  });

  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/", "layout");
  redirect("/admin");
}

export async function createHub(formData: FormData) {
  const franchisee = await getFranchisee();
  const canCreate =
    isAdminRole(franchisee) || franchisee.location_role === "manager";
  if (!canCreate || !franchisee.location_id) redirect("/");

  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/hub/new?error=missing");

  const { data: hub, error } = await supabase
    .from("hubs")
    .insert({
      name,
      location_id: franchisee.location_id,
      created_by: franchisee.id,
    })
    .select("id")
    .single();
  if (error || !hub) {
    redirect(`/hub/new?error=${encodeURIComponent(error?.message ?? "failed")}`);
  }

  // hand-picked teammates (creator is added as owner by the DB trigger)
  const members = formData
    .getAll("members")
    .map(String)
    .filter((id) => id && id !== franchisee.id);
  if (members.length > 0) {
    await supabase
      .from("hub_members")
      .insert(members.map((id) => ({ hub_id: hub.id, franchisee_id: id })));
  }

  revalidatePath("/", "layout");
  redirect(`/hub/${hub.id}`);
}

export async function addHubMember(hubId: string, franchiseeId: string) {
  const supabase = await createClient();
  await supabase
    .from("hub_members")
    .insert({ hub_id: hubId, franchisee_id: franchiseeId });
  revalidatePath(`/hub/${hubId}`);
}

export async function removeHubMember(hubId: string, franchiseeId: string) {
  const supabase = await createClient();
  await supabase
    .from("hub_members")
    .delete()
    .eq("hub_id", hubId)
    .eq("franchisee_id", franchiseeId);
  revalidatePath(`/hub/${hubId}`);
}
