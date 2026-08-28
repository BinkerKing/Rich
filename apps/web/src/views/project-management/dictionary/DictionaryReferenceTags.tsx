import * as React from "react";
import type { ReactNode } from "react";
import type { ProjectDictionaryFieldHit, ProjectDictionaryTable } from "../../../api/client.js";
import type { DictionarySourceRef } from "./sqlRuleEngine.js";

export type DictionaryTableRef = { label: string; table?: ProjectDictionaryTable };

export function DictionarySourceRefTag({
  refItem,
  onOpenFieldRef,
  children,
}: {
  refItem: DictionarySourceRef;
  onOpenFieldRef: (field: ProjectDictionaryFieldHit) => void;
  children: ReactNode;
}) {
  const isTemp = Boolean(refItem.field?.extra?.isTempTable);
  return (
    <span
      className={`prj-pm-dict-ref-chip${refItem.field ? " is-bound" : ""}${isTemp ? " is-temp" : ""}`}
      role={refItem.field ? "link" : undefined}
      tabIndex={refItem.field ? 0 : undefined}
      title={refItem.field ? (isTemp ? "临时字段，仅供当前表 Mapping 使用" : "已绑定字段元，点击打开所在表") : undefined}
      onClick={refItem.field ? event => {
        event.stopPropagation();
        onOpenFieldRef(refItem.field!);
      } : undefined}
      onKeyDown={refItem.field ? event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onOpenFieldRef(refItem.field!);
        }
      } : undefined}>
      {children}
    </span>
  );
}

export function DictionaryTableRefTag({
  refItem,
  onOpenTableRef,
  children,
}: {
  refItem: DictionaryTableRef;
  onOpenTableRef: (tableId: string) => void;
  children: ReactNode;
}) {
  const isTemp = Boolean(refItem.table?.extra?.isTempTable);
  const isClickable = Boolean(refItem.table) && !isTemp;
  return (
    <span
      className={`prj-pm-dict-ref-chip${refItem.table ? " is-bound" : ""}${isTemp ? " is-temp" : ""}`}
      role={isClickable ? "link" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      title={refItem.table ? (isTemp ? "临时表，仅供当前表 Mapping 使用" : "已绑定表元，点击打开表") : undefined}
      onClick={isClickable ? event => {
        event.stopPropagation();
        onOpenTableRef(refItem.table!.id);
      } : undefined}
      onKeyDown={isClickable ? event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onOpenTableRef(refItem.table!.id);
        }
      } : undefined}>
      {children}
    </span>
  );
}
