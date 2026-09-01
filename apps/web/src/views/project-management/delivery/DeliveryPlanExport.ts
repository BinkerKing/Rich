import * as XLSX from "xlsx";
import { buildGanttTimelineRange, ganttTimelineDates, type DeliveryItemKind, type DeliveryItemLike, type DeliveryItemStatus } from "./DeliveryPlanModel.js";

export type DeliveryExportRow = DeliveryItemLike & {
  wbsCode: string;
  depth: number;
  phaseIndex: number;
  progress: number;
};

const statusLabels: Record<DeliveryItemStatus, string> = {
  todo: "待开始",
  doing: "进行中",
  blocked: "已阻塞",
  done: "已完成",
};

const kindLabels: Record<DeliveryItemKind, string> = {
  phase: "阶段",
  group: "分组",
  task: "任务",
  milestone: "里程碑",
  risk: "风险点",
};

export const deliveryExportHeaders = ["WBS / 事项", "类型 / 所属", "状态", "自动进度", "进度偏移", "计划开始时间", "实际开始时间", "实际结束时间", "周期（工作日）", "计划结束时间", "实际人天", "前置依赖", "负责人"] as const;
export type NativeGanttExport = { today: string; dates: string[]; rows: Array<Pick<DeliveryExportRow, "wbsCode" | "title" | "owner" | "progress" | "depth" | "phaseIndex" | "parentId" | "kind" | "status" | "startDate" | "actualStartDate" | "dueDate" | "baselineDueDate">> };

function kindOf(row: DeliveryExportRow): DeliveryItemKind { return row.kind || "task"; }

export function buildDeliveryExportRows(rows: DeliveryExportRow[]): string[][] {
  const byId = new Map(rows.map(row => [row.id, row]));
  return [
    [...deliveryExportHeaders],
    ...rows.map(row => {
      const parent = row.parentId ? byId.get(row.parentId) : undefined;
      const dependencies = (row.dependencyIds || []).map(id => byId.get(id)).filter((value): value is DeliveryExportRow => Boolean(value));
      const kind = kindOf(row);
      return [
        `${row.wbsCode ? `${row.wbsCode} ` : ""}${row.title}`,
        `${kindLabels[kind]}${parent ? ` / ${parent.title}` : ""}`,
        statusLabels[row.status],
        row.status === "done" ? "完成" : `${row.progress}%`,
        `${row.progressOffsetDays || 0} 天`,
        row.startDate || "—",
        row.actualStartDate || "—",
        row.dueDate || "—",
        `${Math.max(1, row.periodDays || 1)} 天`,
        row.baselineDueDate || "—",
        `${row.actualPersonDays || 0} 人天`,
        dependencies.length ? dependencies.map(item => `${item.wbsCode ? `${item.wbsCode} ` : ""}${item.title}`).join("、") : "—",
        row.owner || "—",
      ];
    }),
  ];
}

export function buildNativeGanttExport(rows: DeliveryExportRow[], today: string, calendarMode: "calendar" | "working", holidays: readonly string[]): NativeGanttExport {
  const { startAt, endAt } = buildGanttTimelineRange(rows, today);
  const start = new Date(startAt).toISOString().slice(0, 10);
  const end = new Date(endAt).toISOString().slice(0, 10);
  return { today, dates: ganttTimelineDates(start, end, calendarMode, holidays), rows: rows.map(row => ({ wbsCode: row.wbsCode, title: row.title, owner: row.owner, progress: row.progress, depth: row.depth, phaseIndex: row.phaseIndex, parentId: row.parentId, kind: kindOf(row), status: row.status, startDate: row.startDate, actualStartDate: row.actualStartDate, dueDate: row.dueDate, baselineDueDate: row.baselineDueDate })) };
}

export function buildGanttExportTimeline(rows: DeliveryExportRow[], today: string) {
  const { startAt, endAt } = buildGanttTimelineRange(rows, today);
  const start = new Date(startAt).toISOString().slice(0, 10);
  const end = new Date(endAt).toISOString().slice(0, 10);
  const dates = ganttTimelineDates(start, end, "calendar");
  return { dates, todayIndex: dates.indexOf(today) };
}

function dateInRange(date: string, start?: string, end?: string) {
  return Boolean(start && end && date >= start && date <= end);
}

export function buildGanttExportRows(rows: DeliveryExportRow[], today: string): string[][] {
  const { dates } = buildGanttExportTimeline(rows, today);
  return [
    ["WBS / 任务名称", "负责人", "状态", ...dates.map(date => `${date === today ? "今天 " : ""}${date.slice(5).replace("-", "/")}`)],
    ...rows.map(row => {
      const kind = kindOf(row);
      const end = row.baselineDueDate || row.dueDate || row.startDate;
      const title = kind === "milestone" ? `⚑ ${row.title}` : kind === "risk" ? `⚠ ${row.title}` : `${row.wbsCode ? `${row.wbsCode} ` : ""}${row.title}`;
      const status = kind === "milestone" ? "节点" : kind === "risk" ? "风险" : `${statusLabels[row.status]} ${row.progress}%`;
      const cells = dates.map(date => {
        if (kind === "milestone") return date === end ? "⚑" : "";
        if (kind === "risk") return dateInRange(date, row.startDate || end, end) ? "⚠" : "";
        return dateInRange(date, row.startDate || end, end) ? "■" : "";
      });
      return [title, row.owner || "—", status, ...cells];
    }),
  ];
}

function worksheet(rows: string[][], widths: number[]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = widths.map(wch => ({ wch }));
  if (rows.length > 1 && rows[0]) sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: rows[0].length - 1, r: rows.length - 1 } }) };
  return sheet;
}

export function buildDeliveryExportWorkbook(rows: DeliveryExportRow[], today: string): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const gantt = worksheet(buildGanttExportRows(rows, today), [34, 14, 15, ...buildGanttExportTimeline(rows, today).dates.map(() => 8)]);
  const table = worksheet(buildDeliveryExportRows(rows), [34, 20, 12, 12, 12, 13, 13, 13, 14, 13, 12, 28, 14]);
  XLSX.utils.book_append_sheet(workbook, gantt, "甘特图");
  XLSX.utils.book_append_sheet(workbook, table, "Excel 列表");
  return workbook;
}

export function downloadDeliveryExportWorkbook(rows: DeliveryExportRow[], today: string) {
  XLSX.writeFile(buildDeliveryExportWorkbook(rows, today), `交付计划_${today}.xlsx`, { compression: true });
}
