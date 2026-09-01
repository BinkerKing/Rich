import type { Element } from "@ke/domain";
import type { GreatMeRepo } from "../repos/GreatMeRepo.js";
import type { ProjectModuleItem } from "../repos/ProjectManagementRepo.js";

type PlanTask = {
  id: string;
  title: string;
  done: boolean;
  date: string;
  badge: string;
  goalId: string;
  note: string;
  source?: "user" | "ai" | "ai-template" | "project";
  projectId?: string;
  projectName?: string;
  projectTaskId?: string;
};

type GreatMeState = { tasks?: PlanTask[]; [key: string]: unknown };

function dateFor(): string {
  // This feed is specifically for the tasks that need action now. Delivery due dates
  // remain in Project Management; scheduling them there must not hide them from today.
  return new Date().toISOString().slice(0, 10);
}

function isTodayDeliveryTask(item: ProjectModuleItem, today: string): boolean {
  if (item.content.kind !== "task" || item.content.status === "done") return false;
  // A task belongs in today's Plan Management feed only when it is actively being worked
  // or explicitly scheduled to start today. A future or unscheduled todo stays in its project plan.
  return item.content.status === "doing" || item.content.startDate === today;
}

/** Mirrors open project delivery tasks into Plan Management. Project Management remains the source of truth. */
export async function syncProjectPlanTasks(
  greatMe: GreatMeRepo,
  project: Pick<Element, "id" | "title">,
  deliveryItems: ProjectModuleItem[],
): Promise<void> {
  const raw = await greatMe.get();
  if (raw !== null && (typeof raw !== "object" || Array.isArray(raw))) return;
  const state = (raw ?? {}) as GreatMeState;
  const currentTasks = Array.isArray(state.tasks) ? state.tasks : [];

  const today = dateFor();
  const synced = deliveryItems.filter(item => isTodayDeliveryTask(item, today)).map<PlanTask>(item => ({
    // Module item IDs are globally unique UUIDs; keeping this under the 80-char task-id limit
    // preserves GreatMe's validated state even when the project ID is a UUID too.
    id: `project-task-${item.id}`,
    title: item.title,
    done: false,
    date: today,
    badge: "项目",
    goalId: "",
    note: "",
    source: "project",
    projectId: project.id,
    projectName: project.title,
    projectTaskId: item.id,
  }));
  const existing = currentTasks.filter(task => task.source === "project" && task.projectId === project.id);
  if (JSON.stringify(existing) === JSON.stringify(synced)) return;
  const retained = currentTasks.filter(task => task.source !== "project" || task.projectId !== project.id);
  const version = typeof state.version === "number" && Number.isInteger(state.version) && state.version >= 0
    ? state.version + 1
    : 1;
  await greatMe.put({ ...state, tasks: [...retained, ...synced], version });
}
