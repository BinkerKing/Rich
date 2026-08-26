import { useEffect, useRef, useState } from "react";
import { api, type ProjectManagementModuleKey, type ProjectManagementSearchHit } from "../../api/client.js";

export type ProjectManagementSection = ProjectManagementModuleKey;

export const PROJECT_MANAGEMENT_SECTIONS: Array<{
  id: ProjectManagementSection;
  label: string;
  icon: string;
}> = [
  { id: "description", label: "项目说明", icon: "◆" },
  { id: "dictionary", label: "数据字典", icon: "▦" },
  { id: "automation", label: "数据自动化", icon: "▶" },
  { id: "workflow", label: "作业流程", icon: "⇄" },
  { id: "scenarios", label: "场景手册", icon: "▤" },
  { id: "environments", label: "环境配置", icon: "◎" },
  { id: "deploymentSteps", label: "部署步骤", icon: "☑" },
  { id: "monitoring", label: "监控预警", icon: "⌁" },
  { id: "codeVersions", label: "代码版本", icon: "⌘" },
  { id: "todos", label: "项目代办", icon: "✓" },
  { id: "folder", label: "文件夹", icon: "▣" },
];

const moduleLabels = new Map(PROJECT_MANAGEMENT_SECTIONS.map(section => [section.id, section.label]));

export function ProjectManagementSearchBar({
  projectId,
  onJump,
  autoFocusSignal,
}: {
  projectId: string;
  onJump: (section: ProjectManagementSection) => void;
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
    <div className="prj-pm-global-search">
      <label>
        <span>全局搜索</span>
        <input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} onFocus={() => setOpen(query.trim().length > 0)} placeholder="搜索字段、表、口径、码值、流程、场景、部署步骤..." />
      </label>
      {open && <div className="prj-pm-global-search__results">
        {results.length === 0 ? <div className="prj-pm-global-search__empty">没有命中内容</div> : results.map(hit => (
          <button key={hit.id} type="button" onClick={() => { onJump(hit.moduleKey); setOpen(false); }}>
            <span>{moduleLabels.get(hit.moduleKey) || hit.moduleKey}</span>
            <strong>{hit.title}</strong>
            {hit.subtitle && <small>{hit.subtitle}</small>}
            {hit.excerpt && <p>{hit.excerpt}</p>}
          </button>
        ))}
      </div>}
    </div>
  );
}
