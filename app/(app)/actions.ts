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
