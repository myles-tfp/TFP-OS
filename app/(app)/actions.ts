"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee } from "@/lib/get-franchisee";

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

export async function createPost(formData: FormData) {
  const franchisee = await getFranchisee();
  if (franchisee.role !== "admin") redirect("/");

  const supabase = await createClient();

  const body = String(formData.get("body") ?? "").trim();
  const channelId = String(formData.get("channel_id") ?? "");
  if (!body || !channelId) redirect("/admin?error=missing");

  const title = String(formData.get("title") ?? "").trim() || null;
  const mediaUrl = String(formData.get("media_url") ?? "").trim() || null;

  const { error } = await supabase.from("posts").insert({
    channel_id: channelId,
    title,
    body,
    media_url: mediaUrl,
    media_type: mediaUrl ? "link" : null,
    requires_action: formData.get("requires_action") === "on",
    created_by: franchisee.id,
  });

  if (error) redirect(`/admin?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/");
  redirect("/?posted=1");
}
