export const TASK_STATUSES = ['Open', 'In Progress', 'Done', 'Cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_PRIORITIES = ['High', 'Medium', 'Low'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const ACTIVITY_KINDS = ['Note', 'Email', 'Status change', 'Interview', 'Assessment', 'Offer', 'Follow-up', 'Other'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface Task {
  id: string; title: string; status: TaskStatus; priority: TaskPriority;
  due_date: string | null; opportunity_id: string | null; notes: string | null;
  completed_at: string | null; created_at: string; updated_at: string;
}
export interface Contact { id: string; name: string; email: string | null; organization: string | null; title: string | null; opportunity_id: string | null; last_contacted_at: string | null; notes: string | null; created_at: string; updated_at: string; }
export interface Activity { id: string; opportunity_id: string | null; contact_id: string | null; kind: ActivityKind; body: string; occurred_at: string | null; created_at: string; }
export interface DecisionDetails { compensation?: string; location?: string; work_mode?: string; decision_deadline?: string; pros?: string; concerns?: string; outcome?: string; }

type SortableTask = Pick<Task, 'id' | 'title' | 'status' | 'priority' | 'due_date'>;
const priority = { High: 0, Medium: 1, Low: 2 } as const;
export function sortTasks<T extends SortableTask>(tasks: T[], today: string): T[] {
  return [...tasks].sort((a, b) => {
    const aLate = a.due_date && a.due_date < today ? 0 : 1;
    const bLate = b.due_date && b.due_date < today ? 0 : 1;
    if (aLate !== bLate) return aLate - bLate;
    const aDate = a.due_date ?? '9999-12-31'; const bDate = b.due_date ?? '9999-12-31';
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return priority[a.priority] - priority[b.priority];
  });
}
export function completeTask<T extends { status: TaskStatus; completed_at?: string | null }>(task: T, at: string): T & { status: 'Done'; completed_at: string } {
  return { ...task, status: 'Done', completed_at: at };
}
