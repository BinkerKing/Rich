import { useEffect, useRef, useState } from "react";
import { api, type ProjectManagementModuleKey, type ProjectManagementSearchHit } from "../../api/client.js";
import { searchTargetFromHit } from "./searchNavigation.js";

export type ProjectManagementSection = ProjectManagementModuleKey;
export type ProjectManagementSearchTarget = { section: ProjectManagementSection; entityType: string; entityId: string; systemId?: string; tableId?: string };

export const PROJECT_MANAGEMENT_SECTIONS: Array<{
  id: ProjectManagementSection;
  label: string;
}> = [
  { id: "dashboard", label: "驾驶舱" },
  { id: "deliveryPlan", label: "交付计划" },
  { id: "deliverables", label: "交付物" },
  { id: "reports", label: "报告" },
  { id: "description", label: "项目说明" },
  { id: "dictionary", label: "数据字典" },
  { id: "automation", label: "数据自动化" },
  { id: "workflow", label: "作业流程" },
  { id: "flowcharts", label: "项目流程图" },
  { id: "scenarios", label: "场景手册" },
  { id: "environments", label: "环境配置" },
  { id: "deploymentSteps", label: "部署步骤" },
  { id: "monitoring", label: "监控预警" },
  { id: "codeVersions", label: "版本控制" },
  { id: "todos", label: "项目代办" },
  { id: "testing", label: "测试中心" },
  { id: "issues", label: "问题清单" },
  { id: "folder", label: "文件夹" },
];

const moduleLabels = new Map(PROJECT_MANAGEMENT_SECTIONS.map(section => [section.id, section.label]));
const entityLabels = new Map<string, string>([["moduleItem", "记录"], ["dictionaryField", "字段"], ["dictionaryTable", "数据表"], ["folderEntry", "文件"]]);

export function ProjectManagementSearchBar({
  projectId,
  onNavigate,
  autoFocusSignal,
}: {
  projectId: string;
  onNavigate: (target: ProjectManagementSearchTarget) => void;
  autoFocusSignal?: number;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProjectManagementSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!autoFocusSignal) return;
    window.setTimeout(() => inputRef.current?.focus(), 60);
  }, [autoFocusSignal]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void api.searchProjectManagement(projectId, query, 12)
        .then(next => {
          if (cancelled) return;
          setResults(next.results);
          setOpen(query.trim().length > 0);
        })
        .catch(() => {
          if (cancelled) return;
          setResults([]);
          setOpen(false);
        });
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [projectId, query]);

  return (
    <div className="prj-pm-global-search" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <label aria-label="全局搜索">
        <span className="prj-pm-global-search__icon" aria-hidden="true">⌕</span>
        <input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} onFocus={() => setOpen(query.trim().length > 0)} onKeyDown={event => {
          if (event.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }} placeholder="搜索字段、表、文件、口径、流程…" />
        <kbd>ESC</kbd>
      </label>
      {open && <div className="prj-pm-global-search__results">
        <div className="prj-pm-global-search__result-head"><span>搜索结果</span><em>{results.length} 项</em></div>
        {results.length === 0 ? <div className="prj-pm-global-search__empty">没有找到匹配内容，试试字段英文名、表名或文件名。</div> : results.map(hit => (
          <button key={hit.id} type="button" onClick={() => {
            onNavigate(searchTargetFromHit(hit));
            setOpen(false);
          }}>
            <span className="prj-pm-global-search__kind">{entityLabels.get(hit.entityType) || moduleLabels.get(hit.moduleKey) || "记录"}</span>
            <span className="prj-pm-global-search__content">
              <strong>{hit.title}</strong>
              {(hit.subtitle || hit.excerpt) && <small>{hit.subtitle || hit.excerpt}</small>}
            </span>
            <span className="prj-pm-global-search__section">{moduleLabels.get(hit.moduleKey) || hit.moduleKey} <b>→</b></span>
          </button>
        ))}
      </div>}
    </div>
  );
}
