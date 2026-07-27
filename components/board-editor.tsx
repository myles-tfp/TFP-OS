"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { IconPencil, IconTrash, IconMegaphone } from "@/components/icons";
import {
  STATUS_META,
  phaseProgress,
  type BoardPhase,
  type BoardTask,
  type TaskStatus,
} from "@/lib/board";

/**
 * Monday-style board editor.
 * adminMode: full structure editing. Otherwise (franchisee) only task
 * status can be changed — RLS enforces the same rules server-side.
 */
export function BoardEditor({
  phases,
  locationId,
  adminMode,
}: {
  phases: BoardPhase[];
  locationId: string | null; // null = template
  adminMode: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  // all phases start collapsed so the whole journey is visible at a glance
  const [openPhases, setOpenPhases] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<
    { kind: "phase" | "task"; id: string; label: string } | null
  >(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => router.refresh();
  const fail = (msg: string) => setError(msg);

  const togglePhase = (id: string) => {
    setOpenPhases((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const addPhase = async () => {
    const name = window.prompt("Phase name:");
    if (!name?.trim()) return;
    const maxOrder = Math.max(0, ...phases.map((p) => p.sort_order));
    const { error } = await supabase.from("phases").insert({
      location_id: locationId,
      name: name.trim(),
      sort_order: maxOrder + 1,
    });
    if (error) fail(error.message);
    refresh();
  };

  const renamePhase = async (phase: BoardPhase) => {
    const name = window.prompt("Rename phase:", phase.name);
    if (!name?.trim() || name.trim() === phase.name) return;
    const { error } = await supabase
      .from("phases")
      .update({ name: name.trim() })
      .eq("id", phase.id);
    if (error) fail(error.message);
    refresh();
  };

  const toggleMarketing = async (phase: BoardPhase) => {
    const { error } = await supabase
      .from("phases")
      .update({ tag: phase.tag === "marketing" ? null : "marketing" })
      .eq("id", phase.id);
    if (error) fail(error.message);
    refresh();
  };

  const addTask = async (phase: BoardPhase) => {
    const title = window.prompt("Task:");
    if (!title?.trim()) return;
    const maxOrder = Math.max(0, ...phase.tasks.map((t) => t.sort_order));
    const { error } = await supabase.from("tasks").insert({
      phase_id: phase.id,
      title: title.trim(),
      sort_order: maxOrder + 1,
    });
    if (error) fail(error.message);
    refresh();
  };

  const updateTask = async (id: string, patch: Partial<BoardTask>) => {
    const { error } = await supabase.from("tasks").update(patch).eq("id", id);
    if (error) fail(error.message);
    refresh();
  };

  const renameTask = async (task: BoardTask) => {
    const title = window.prompt("Edit task:", task.title);
    if (!title?.trim() || title.trim() === task.title) return;
    await updateTask(task.id, { title: title.trim() });
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    const { error } = await supabase
      .from(removing.kind === "phase" ? "phases" : "tasks")
      .delete()
      .eq("id", removing.id);
    setBusy(false);
    setRemoving(null);
    if (error) fail(error.message);
    refresh();
  };

  return (
    <div className="board">
      {error && <div className="auth-error">{error}</div>}

      {phases.map((phase, idx) => {
        const pct = phaseProgress(phase.tasks);
        const open = openPhases.has(phase.id);
        const firstMarketing =
          phase.tag === "marketing" &&
          (idx === 0 || phases[idx - 1].tag !== "marketing");
        return (
          <section className="phase-wrap" key={phase.id}>
          {firstMarketing && (
            <div className="board-divider">6-Month Marketing Plan</div>
          )}
          <section className="phase">
            <header className="phase-head" onClick={() => togglePhase(phase.id)}>
              <span className={`chev${open ? " open" : ""}`}>▸</span>
              <h3>{phase.name}</h3>
              {phase.tag === "marketing" && (
                <span className="cat-pill" style={{ marginLeft: 0 }}>Marketing</span>
              )}
              <span className="phase-count">
                {phase.tasks.filter((t) => t.status === "done").length}/
                {phase.tasks.length}
              </span>
              <div className="phase-bar" title={`${pct}% done`}>
                <div className="phase-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              {adminMode && (
                <span className="post-actions" style={{ opacity: 1 }} onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="icon-btn" title="Rename" onClick={() => renamePhase(phase)}><IconPencil size={14} /></button>
                  <button
                    type="button"
                    className="icon-btn"
                    title={phase.tag === "marketing" ? "Remove from Marketing plan" : "Include in Marketing plan"}
                    onClick={() => toggleMarketing(phase)}
                  >
                    <IconMegaphone size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="Delete phase"
                    onClick={() => setRemoving({ kind: "phase", id: phase.id, label: phase.name })}
                  >
                    <IconTrash size={14} />
                  </button>
                </span>
              )}
            </header>

            {open && (
              <div className="phase-body">
                {phase.tasks.map((task) => (
                  <div className={`task-row${task.status === "done" ? " done" : ""}`} key={task.id}>
                    <input
                      type="checkbox"
                      checked={task.status === "done"}
                      onChange={(e) =>
                        updateTask(task.id, {
                          status: e.target.checked ? "done" : "not_started",
                        })
                      }
                      title="Mark done"
                    />
                    <span className="task-title">{task.title}</span>
                    {adminMode ? (
                      <select
                        className="task-owner"
                        value={task.owner}
                        onChange={(e) => updateTask(task.id, { owner: e.target.value as BoardTask["owner"] })}
                      >
                        <option value="franchisee">Franchisee</option>
                        <option value="hq">HQ</option>
                      </select>
                    ) : (
                      <span className="task-owner-label">{task.owner === "hq" ? "HQ" : "You"}</span>
                    )}
                    <select
                      className="task-status"
                      value={task.status}
                      style={{ color: STATUS_META[task.status].color, borderColor: `${STATUS_META[task.status].color}55` }}
                      onChange={(e) => updateTask(task.id, { status: e.target.value as TaskStatus })}
                    >
                      {(Object.keys(STATUS_META) as TaskStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_META[s].label}
                        </option>
                      ))}
                    </select>
                    {adminMode ? (
                      <input
                        type="date"
                        className="task-due"
                        defaultValue={task.due_date ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value || null;
                          if (v !== task.due_date) updateTask(task.id, { due_date: v });
                        }}
                      />
                    ) : (
                      task.due_date && (
                        <span className="task-due-label">
                          {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )
                    )}
                    {adminMode && (
                      <>
                        <button
                          type="button"
                          className="icon-btn"
                          title="Edit task text"
                          onClick={() => renameTask(task)}
                        >
                          <IconPencil size={13} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          title="Delete task"
                          onClick={() => setRemoving({ kind: "task", id: task.id, label: task.title })}
                        >
                          <IconTrash size={13} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {adminMode && (
                  <button type="button" className="add-item" onClick={() => addTask(phase)}>
                    + Add task
                  </button>
                )}
                {phase.tasks.length === 0 && !adminMode && (
                  <p className="panel-note">Nothing in this phase yet.</p>
                )}
              </div>
            )}
          </section>
          </section>
        );
      })}

      {adminMode && (
        <button type="button" className="btn ghost" style={{ marginTop: 14 }} onClick={addPhase}>
          + Add phase
        </button>
      )}

      <ConfirmDialog
        open={!!removing}
        title={removing?.kind === "phase" ? "Delete this phase?" : "Delete this task?"}
        message={
          removing?.kind === "phase"
            ? `"${removing?.label}" and every task inside it will be removed. This can't be undone.`
            : `"${removing?.label ?? ""}" will be removed. This can't be undone.`
        }
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
        busy={busy}
      />
    </div>
  );
}
