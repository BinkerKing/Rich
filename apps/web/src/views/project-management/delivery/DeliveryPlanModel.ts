export type DeliveryItemStatus = "todo" | "doing" | "blocked" | "done";
export type DeliveryItemKind = "phase" | "group" | "task" | "milestone" | "risk";

/** 国务院办公厅公布的 2026 年放假日期；调休补班日不在此列表中。 */
export const china2026HolidayDates = [
  "2026-01-01", "2026-01-02", "2026-01-03",
  "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23",
  "2026-04-04", "2026-04-05", "2026-04-06",
  "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
  "2026-06-19", "2026-06-20", "2026-06-21",
  "2026-09-25", "2026-09-26", "2026-09-27",
  "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07",
] as const;

export interface DeliveryItemLike {
  id: string;
  title: string;
  startDate?: string;
  actualStartDate?: string;
  dueDate?: string;
  status: DeliveryItemStatus;
  owner?: string;
  progress?: number;
  progressOffsetDays?: number;
  parentId?: string;
  kind?: DeliveryItemKind;
  sortOrder?: number;
  baselineDueDate?: string;
  periodDays?: number;
  actualPersonDays?: number;
  dependencyIds?: string[];
}

export function plannedDueDate(item: Pick<DeliveryItemLike, "baselineDueDate" | "dueDate">): string | undefined {
  return item.baselineDueDate || item.dueDate;
}

function parseDate(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isWorkingDay(date: Date, holidays: ReadonlySet<string>): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6 && !holidays.has(dateString(date));
}

function holidaySet(holidays: readonly string[] = []) {
  return new Set(holidays.filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value)));
}

export function addWorkingDays(startDate: string, days: number, holidays: readonly string[] = []): string {
  const date = parseDate(startDate);
  if (!date) return "";
  const excluded = holidaySet(holidays);
  let remaining = Math.max(0, Math.floor(days) || 0);
  while (remaining > 0 && !isWorkingDay(date, excluded)) date.setUTCDate(date.getUTCDate() + 1);
  if (remaining > 0) remaining -= 1;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (isWorkingDay(date, excluded)) remaining -= 1;
  }
  return dateString(date);
}

/** The right edge of a Gantt bar is the start of the following natural day. */
export function ganttEndBoundary(endDate: string): string {
  const date = parseDate(endDate);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + 1);
  return dateString(date);
}

export type GanttCalendarMode = "calendar" | "working";

export function ganttTimelineDates(startDate: string, endDate: string, mode: GanttCalendarMode, holidays: readonly string[] = []): string[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || end < start) return [];
  const excluded = holidaySet(holidays);
  const dates: string[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (mode === "calendar" || isWorkingDay(cursor, excluded)) dates.push(dateString(cursor));
  }
  return dates;
}

export function workingDaysBetween(startDate?: string, endDate?: string, holidays: readonly string[] = []): number {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || end < start) return 0;
  const excluded = holidaySet(holidays);
  let days = 0;
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (isWorkingDay(cursor, excluded)) days += 1;
  }
  return days;
}

export function actualStartDateFor(item: Pick<DeliveryItemLike, "startDate" | "actualStartDate" | "status">, today: string): string | undefined {
  if (!item.startDate) return item.actualStartDate;
  if (item.status === "todo" && item.startDate <= today) return today;
  return item.actualStartDate || item.startDate;
}

export function syncDeliverySchedule(
  current: Pick<DeliveryItemLike, "startDate" | "baselineDueDate" | "periodDays">,
  patch: Pick<Partial<DeliveryItemLike>, "startDate" | "baselineDueDate" | "periodDays">,
  holidays: readonly string[] = [],
): Pick<Partial<DeliveryItemLike>, "baselineDueDate" | "periodDays"> & typeof patch {
  const next = { ...current, ...patch };
  if ("baselineDueDate" in patch) {
    return { ...patch, periodDays: Math.max(1, workingDaysBetween(next.startDate, next.baselineDueDate, holidays)) };
  }
  if ("periodDays" in patch || "startDate" in patch) {
    const periodDays = Math.max(1, Math.floor(next.periodDays ?? 0));
    return next.startDate ? { ...patch, periodDays, baselineDueDate: addWorkingDays(next.startDate, periodDays, holidays) } : { ...patch, periodDays };
  }
  return patch;
}

export function childTaskScheduleDefaults(_parentStartDate?: string, today?: string, holidays: readonly string[] = []): Pick<DeliveryItemLike, "startDate" | "actualStartDate" | "dueDate" | "baselineDueDate" | "periodDays" | "actualPersonDays"> {
  const startDate = today || "";
  return { startDate, actualStartDate: "", dueDate: "", baselineDueDate: addWorkingDays(startDate, 2, holidays), periodDays: 2, actualPersonDays: 0 };
}

export type GanttRow<T extends DeliveryItemLike = DeliveryItemLike> = T & {
  progress: number;
  isAtRisk: boolean;
  depth: number;
  hasChildren: boolean;
  kind: DeliveryItemKind;
  wbsCode: string;
  phaseIndex: number;
};

function day(value?: string): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ms) ? undefined : ms;
}

export function buildGanttTimelineRange(items: DeliveryItemLike[], today: string) {
  const todayAt = day(today) ?? Date.now();
  const starts = items.flatMap(item => {
    const value = day(item.startDate || item.baselineDueDate || item.dueDate);
    return value === undefined ? [] : [value];
  });
  const ends = items.flatMap(item => {
    const value = day(item.dueDate || item.baselineDueDate || item.startDate);
    return value === undefined ? [] : [value];
  });
  return {
    startAt: starts.length ? Math.min(...starts) : todayAt,
    endAt: Math.max(todayAt, ...(ends.length ? ends : [todayAt])),
  };
}

function calculatedProgress(item: DeliveryItemLike, todayAt: number): number {
  if (item.status === "done") return 100;
  const startAt = day(item.startDate);
  const endAt = day(item.baselineDueDate || item.dueDate);
  if (startAt === undefined || endAt === undefined || endAt <= startAt) return 0;
  const offset = Number.isFinite(item.progressOffsetDays) ? (item.progressOffsetDays ?? 0) * 86_400_000 : 0;
  return Math.max(0, Math.min(100, Math.round(((todayAt - startAt + offset) / (endAt - startAt)) * 100)));
}

export function buildGanttRows<T extends DeliveryItemLike>(items: T[], today: string): GanttRow<T>[] {
  const todayAt = day(today) ?? 0;
  const byParent = new Map<string | undefined, T[]>();
  const knownIds = new Set(items.map(item => item.id));
  const sort = (left: T, right: T) => (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER)
    || (left.startDate ?? "").localeCompare(right.startDate ?? "")
    || left.title.localeCompare(right.title, "zh-CN");
  for (const item of items) {
    const parentId = item.parentId && knownIds.has(item.parentId) ? item.parentId : undefined;
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), item]);
  }
  const rows: GanttRow<T>[] = [];
  const visit = (item: T, depth: number, wbsCode: string, phaseIndex: number) => {
    const children = (byParent.get(item.id) ?? []).sort(sort);
    const scheduleChildren = children.filter(child => {
      const childKind = child.kind ?? "task";
      return childKind !== "risk" && childKind !== "milestone";
    });
    const detailChildren = children.filter(child => {
      const childKind = child.kind ?? "task";
      return childKind === "risk" || childKind === "milestone";
    });
    const kind = item.kind ?? "task";
    rows.push({
      ...item,
      kind,
      progress: calculatedProgress(item, todayAt),
      isAtRisk: item.status !== "done" && item.status !== "blocked" && (day(item.dueDate) ?? Number.MAX_SAFE_INTEGER) < todayAt,
      depth,
      hasChildren: scheduleChildren.length > 0,
      wbsCode: kind === "risk" || kind === "milestone" ? "" : wbsCode,
      phaseIndex,
    });
    scheduleChildren.forEach((child, index) => visit(child, depth + 1, `${wbsCode}.${index + 1}`, phaseIndex));
    detailChildren.forEach(child => visit(child, depth + 1, "", phaseIndex));
  };
  (byParent.get(undefined) ?? []).sort(sort).forEach((item, index) => visit(item, 0, String(index + 1), index));
  return rows;
}

export function buildDeliveryDashboard(items: DeliveryItemLike[], today: string) {
  const rows = buildGanttRows(items, today);
  const todayAt = day(today) ?? 0;
  const threeDays = todayAt + 3 * 86_400_000;
  return {
    total: rows.length,
    completed: rows.filter(row => row.status === "done").length,
    blocked: rows.filter(row => row.status === "blocked").length,
    atRisk: rows.filter(row => row.isAtRisk).length,
    dueSoon: rows.filter(row => row.status !== "done" && row.status !== "blocked" && (day(row.dueDate) ?? Infinity) >= todayAt && (day(row.dueDate) ?? Infinity) <= threeDays).length,
    progress: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.progress, 0) / rows.length) : 0,
    rows,
  };
}
