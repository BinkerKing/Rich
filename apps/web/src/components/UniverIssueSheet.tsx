import { useEffect, useRef, type ReactNode } from "react";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverSheetsCoreZhCN from "@univerjs/preset-sheets-core/locales/zh-CN";
import "@univerjs/preset-sheets-core/lib/index.css";
import "./UniverIssueSheet.css";

export type UniverIssueRow = {
  id: string;
  title: string;
  description: string;
  owner: string;
  status: string;
  externalRef: string;
  updatedAt: string;
};

type EditableIssueField = "title" | "description" | "owner" | "status" | "externalRef";

type UniverIssueSheetProps = {
  tableId: string;
  tableName: string;
  issues: UniverIssueRow[];
  onIssueChange: (issueId: string, patch: Partial<Pick<UniverIssueRow, EditableIssueField>>) => void;
};

const headers = ["问题", "问题说明", "负责人", "状态", "外部记录", "更新时间"];
const editableFields: Array<EditableIssueField | null> = ["title", "description", "owner", "status", "externalRef", null];
const columnWidths = [280, 320, 150, 130, 170, 165];

function worksheetData(issues: UniverIssueRow[]) {
  const cellData: Record<number, Record<number, { v: string }>> = {
    0: Object.fromEntries(headers.map((header, column) => [column, { v: header }])),
  };
  issues.forEach((issue, index) => {
    cellData[index + 1] = {
      0: { v: issue.title },
      1: { v: issue.description },
      2: { v: issue.owner },
      3: { v: issue.status },
      4: { v: issue.externalRef },
      5: { v: issue.updatedAt },
    };
  });

  return {
    id: "issues",
    name: "问题清单",
    rowCount: Math.max(issues.length + 20, 100),
    columnCount: headers.length,
    cellData,
    columnData: Object.fromEntries(columnWidths.map((width, column) => [column, { w: width }])),
    rowData: { 0: { h: 34 } },
  };
}

export function UniverIssueSheet({ tableId, tableName, issues, onIssueChange }: UniverIssueSheetProps): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const issuesRef = useRef(issues);
  const onIssueChangeRef = useRef(onIssueChange);
  issuesRef.current = issues;
  onIssueChangeRef.current = onIssueChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const { univer, univerAPI } = createUniver({
      locale: LocaleType.ZH_CN,
      locales: { [LocaleType.ZH_CN]: mergeLocales(UniverSheetsCoreZhCN) },
      darkMode: true,
      presets: [UniverSheetsCorePreset({ container, ribbonType: "classic", formulaBar: true })],
    });
    const workbook = univerAPI.createWorkbook({
      id: `issue-table-${tableId}`,
      name: tableName,
      sheetOrder: ["issues"],
      sheets: { issues: worksheetData(issuesRef.current) },
    });
    const worksheet = workbook.getSheetByName("问题清单");
    const changes = univerAPI.addEvent(univerAPI.Event.SheetValueChanged, ({ effectedRanges }) => {
      if (!worksheet) return;
      for (const range of effectedRanges) {
        if (range.getSheetId() !== worksheet.getSheetId()) continue;
        for (let row = Math.max(1, range.getRow()); row <= range.getLastRow(); row += 1) {
          const issue = issuesRef.current[row - 1];
          if (!issue) continue;
          for (let column = range.getColumn(); column <= range.getLastColumn(); column += 1) {
            const field = editableFields[column];
            if (!field) continue;
            const value = worksheet.getRange(row, column).getDisplayValue();
            onIssueChangeRef.current(issue.id, { [field]: value });
          }
        }
      }
    });

    return () => {
      changes.dispose();
      univer.dispose();
    };
  }, [tableId, tableName]);

  return <div ref={containerRef} className="univer-issue-sheet" aria-label={`${tableName} Excel 编辑器`} />;
}

export default UniverIssueSheet;
