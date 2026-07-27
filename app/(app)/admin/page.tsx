import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFranchisee, isAdminRole } from "@/lib/get-franchisee";
import { createBoard } from "@/app/(app)/actions";
import { PostComposer } from "@/components/post-composer";
import { ResourceForm } from "@/components/resource-form";
import { RosterManager } from "@/components/roster-manager";
import type { Franchisee } from "@/lib/types";

const TABS = [
  ["post", "Post"],
  ["resource", "Resource"],
  ["board", "Board"],
  ["checklist", "Checklist"],
  ["roster", "Roster"],
] as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  const franchisee = await getFranchisee();
  if (!isAdminRole(franchisee)) redirect("/");

  const { tab: rawTab, error } = await searchParams;
  const tab = TABS.some(([t]) => t === rawTab) ? rawTab! : "post";
  const supabase = await createClient();

  const [{ data: topics }, { data: roster }, { data: locations }] =
    await Promise.all([
      supabase.from("topics").select("id, name, status").order("sort_order"),
      supabase
        .from("franchisees")
        .select("*, locations(name)")
        .order("created_at", { ascending: true }),
      supabase.from("locations").select("id, name").order("name"),
    ]);

  const liveTopics = (topics ?? []).filter((t) => t.status === "live");

  return (
    <>
      <div className="page-head">
        <h1>Admin</h1>
      </div>
      <p className="subtitle">
        Publish and manage — location status lives on your Home overview now.
      </p>

      <div className="home-tabs">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={key === "post" ? "/admin" : `/admin?tab=${key}`}
            className={`tab${tab === key ? " on" : ""}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {error && (
        <div className="auth-error" style={{ maxWidth: 640 }}>
          Couldn&apos;t save:{" "}
          {error === "missing" ? "required fields are missing." : error}
        </div>
      )}

      {tab === "post" && (
        <section className="panel" style={{ maxWidth: 640 }}>
          <div className="panel-head">
            <h2>New post</h2>
          </div>
          <p className="panel-note">
            Read tracking lives on each post now — the x/y chip on your Home
            announcements shows who&apos;s read it.
          </p>
          <PostComposer topics={liveTopics} />
        </section>
      )}

      {tab === "resource" && (
        <section className="panel" style={{ maxWidth: 640 }}>
          <div className="panel-head">
            <h2>New resource</h2>
          </div>
          <p className="panel-note">
            Link something from Drive or Canva, or upload a file directly.
          </p>
          <ResourceForm topics={liveTopics} />
        </section>
      )}

      {tab === "board" && (
        <section className="panel" style={{ maxWidth: 520 }}>
          <div className="panel-head">
            <h2>New board</h2>
          </div>
          <p className="panel-note">
            Boards appear in everyone&apos;s sidebar and hold a how-to
            description plus resources for one topic.
          </p>
          <form action={createBoard}>
            <div className="field">
              <label htmlFor="b-name">Name</label>
              <input id="b-name" name="name" type="text" required placeholder="Training" />
            </div>
            <label className="check" style={{ marginBottom: 14 }}>
              <input type="checkbox" name="coming_soon" />
              Grayed out for now (&quot;coming soon&quot;)
            </label>
            <button type="submit" className="btn ghost">
              Add board
            </button>
          </form>
        </section>
      )}

      {tab === "checklist" && (
        <section className="panel" style={{ maxWidth: 520 }}>
          <div className="panel-head">
            <h2>Checklist Template</h2>
          </div>
          <p className="panel-note">
            Every new location starts with a copy of this checklist — the
            official phases plus the 6-month marketing plan. Editing it only
            affects future locations. Individual location checklists live on
            your Home → Location Checklists tab.
          </p>
          <Link href="/admin/boards/template" className="btn" style={{ textDecoration: "none", display: "inline-block" }}>
            Edit Checklist Template
          </Link>
        </section>
      )}

      {tab === "roster" && (
        <section className="panel" style={{ maxWidth: 760 }}>
          <div className="panel-head">
            <h2>Franchisee roster</h2>
          </div>
          <p className="panel-note">
            The roster is the login allowlist. Pick &quot;New location&quot; to
            create a checklist + manager together, or pick an existing
            checklist to attach a manager to it (the kickoff flow). The
            location dropdown on each row moves a member to another location.
          </p>
          <RosterManager
            roster={(roster ?? []) as Franchisee[]}
            meId={franchisee.id}
            locations={locations ?? []}
          />
        </section>
      )}
    </>
  );
}
