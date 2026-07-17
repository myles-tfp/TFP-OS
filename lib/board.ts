export type TaskStatus = "not_started" | "working" | "stuck" | "done";
export type TaskOwner = "hq" | "franchisee";

export interface BoardTask {
  id: string;
  phase_id: string;
  title: string;
  owner: TaskOwner;
  status: TaskStatus;
  due_date: string | null;
  sort_order: number;
}

export interface BoardPhase {
  id: string;
  franchisee_id: string | null;
  name: string;
  tag: string | null;
  sort_order: number;
  tasks: BoardTask[];
}

export const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  not_started: { label: "Haven't started", color: "#74777B" },
  working: { label: "Working on it", color: "#F15A29" },
  stuck: { label: "Stuck", color: "#EF4045" },
  done: { label: "Done", color: "#BEE515" },
};

export function phaseProgress(tasks: BoardTask[]): number {
  if (tasks.length === 0) return 0;
  return Math.round(
    (tasks.filter((t) => t.status === "done").length / tasks.length) * 100
  );
}

/** First phase (by order) that still has unfinished tasks. */
export function currentPhase(phases: BoardPhase[]): BoardPhase | null {
  const withTasks = phases.filter((p) => p.tasks.length > 0);
  return (
    withTasks.find((p) => p.tasks.some((t) => t.status !== "done")) ??
    withTasks[withTasks.length - 1] ??
    null
  );
}
