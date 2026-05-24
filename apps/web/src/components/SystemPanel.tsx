import { useState, type CSSProperties, type FormEvent } from "react";
import type { Element } from "@ke/domain";
import { Icon, iconForElement } from "./Icon.js";
import { useStore, type AppView } from "../state/store.js";
import { EmbeddedTaskList } from "./EmbeddedTaskList.js";
import "./components.css";

export type SystemPanelMode = "search" | "view" | "map" | "notice";

interface Props {
  mode: SystemPanelMode;
  /** Selected element — required for search relevance ranking. Optional so the
   *  panel can mount on pages that don't have a current element (e.g. home). */
  selected?: Element;
  elements: Map<string, Element>;
  onSelect: (id: string) => void;
}

export function SystemPanel({ mode, selected, elements, onSelect }: Props) {
  // Drawer-mode rendering: only mount when the user explicitly opens it via
  // the TopBar tool buttons. Default state is closed so the main content
  // area gets the full window width.
  const open = useStore(s => s.systemPanelOpen);
  if (!open) return null;

  if (mode === "search") {
    if (!selected) {
      return (
        <aside className="system-panel">
          <header className="system-panel__head"><h2>搜索</h2></header>
          <div className="system-placeholder">
            <Icon name="search" />
            <strong>进入知识树后可搜索元</strong>
          </div>
        </aside>
      );
    }
    return <SearchSystem selected={selected} elements={elements} onSelect={onSelect} />;
  }
  if (mode === "view") {
    return <ViewSystem />;
  }
  if (mode === "notice") {
    return <NoticeSystem />;
  }

  // map (only remaining placeholder)
  return (
    <aside className="system-panel">
      <header className="system-panel__head">
        <h2>知识地图</h2>
        <span>待接入</span>
      </header>
      <div className="system-placeholder">
        <Icon name="map" />
        <strong>知识地图</strong>
      </div>
    </aside>
  );
}

function NoticeSystem() {
  // Count only visible (non-hidden) tasks so the header matches what's shown.
  const visible = useStore(s => s.tasks.filter(t => !t.hidden));
  const running = visible.filter(t => t.status === "running").length;
  return (
    <aside className="system-panel notice-system">
      <header className="system-panel__head">
        <h2>任务列表</h2>
        <span className="system-panel__head-meta">
          {running > 0 ? `${running} 进行中 · 共 ${visible.length} 条` : `${visible.length} 条`}
        </span>
      </header>
      <EmbeddedTaskList />
    </aside>
  );
}

function ViewSystem() {
  const appView = useStore(s => s.appView);
  const setAppView = useStore(s => s.setAppView);
  const exitToHome = useStore(s => s.exitToHome);

  // Click 知识树 → always land on the InputView home page (clears rootId).
  // Picking / continuing a specific tree happens from that page.
  const views: Array<{ id: AppView; label: string; desc: string; icon: "branch" | "gear" | "spark" | "target"; onClick: () => void }> = [
    { id: "tree", label: "知识树", desc: "回到知识树首页选择 / 新建", icon: "branch", onClick: exitToHome },
    { id: "news", label: "AI 早报", desc: "每日 AI 能力进展与应用速览", icon: "spark", onClick: () => setAppView("news") },
    { id: "mindmap", label: "导图 PPT", desc: "把元 / 文稿一键拆成可播放导图", icon: "branch", onClick: () => setAppView("mindmap") },
    { id: "greatme", label: "计划管理", desc: "AI 拆解 · 目标跟进 · 日报反馈", icon: "target", onClick: () => setAppView("greatme") },
    { id: "practice", label: "项目实战", desc: "拆解 · PRD · 效果图", icon: "gear", onClick: () => setAppView("practice") },
    { id: "toolbox", label: "工具箱", desc: "锁屏 · 定时器 · 其它小工具", icon: "gear", onClick: () => setAppView("toolbox") },
    { id: "admin", label: "后台", desc: "AI 引擎 · 操作日志 · 提示词", icon: "gear", onClick: () => setAppView("admin") },
  ];

  return (
    <aside className="system-panel view-system">
      <header className="system-panel__head">
        <h2>视图系统</h2>
      </header>
      <div className="view-list">
        {views.map(v => (
          <button
            key={v.id}
            type="button"
            className={`view-card${appView === v.id ? " is-active" : ""}`}
            onClick={v.onClick}
            title={`切换到${v.label}`}
          >
            <span className="view-card__icon"><Icon name={v.icon} /></span>
            <span className="view-card__main">
              <strong>{v.label}</strong>
              <em>{v.desc}</em>
            </span>
            {appView === v.id && <span className="view-card__badge">当前</span>}
          </button>
        ))}
      </div>
    </aside>
  );
}

function SearchSystem({
  selected,
  elements,
  onSelect,
}: {
  selected: Element;
  elements: Map<string, Element>;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState("");
  // Pin the ranking anchor at the moment the user submits the search. Without
  // this the list re-ranks every time the user clicks a result (because
  // `selected` changes and rankRelated uses it as a weight).
  const [searchAnchor, setSearchAnchor] = useState<Element | null>(null);
  const all = Array.from(elements.values());
  const anchor = searchAnchor ?? selected;
  const related = submittedQuery ? rankRelated(anchor, all, submittedQuery).slice(0, 8) : [];

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = query.trim();
    if (!nextQuery) return;
    setSubmittedQuery(nextQuery);
    setSearchAnchor(selected);
    setIsSearching(true);
    window.setTimeout(() => setIsSearching(false), 900);
  }

  return (
    <aside className="system-panel search-system">
      <header className="system-panel__head">
        <h2>搜索</h2>
      </header>

      <form className="system-search-box" onSubmit={submitSearch}>
        <input
          value={query}
          placeholder="搜索知识元或主题（支持自然语言）"
          onChange={event => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            if (!nextQuery.trim()) {
              setSubmittedQuery("");
              setIsSearching(false);
            }
          }}
        />
        <button type="submit" aria-label="搜索">
          <Icon name="search" />
        </button>
      </form>

      {isSearching && (
        <div className="search-status">
          <Icon name="center" />
          <strong>智能定位中...</strong>
        </div>
      )}

      {submittedQuery && !isSearching && (
        <>
          <section className="system-section">
            <h3>相关知识元</h3>
            <div className="search-result-list">
              {related.map((item, index) => (
                <button key={item.element.id} type="button" onClick={() => onSelect(item.element.id)}>
                  <span className="search-result-dot" style={{ "--dot-color": item.color } as CSSProperties} />
                  <span className="search-result-main">
                    <strong>{item.element.title}</strong>
                    <em>{item.reason}</em>
                  </span>
                  <b>{Math.max(62, 100 - index * 5)}%</b>
                </button>
              ))}
            </div>
          </section>

        </>
      )}
    </aside>
  );
}

function rankRelated(selected: Element, elements: Element[], query: string) {
  const terms = new Set([
    query,
    ...query.split(/[·\s,，。:：/]+/).filter(Boolean),
    selected.title,
    ...selected.title.split(/[·\s]+/).filter(Boolean),
    selected.type,
  ]);
  const colors = ["#6aa8ff", "#74e5b0", "#3dd5cd", "#ffc977", "#55caff", "#ff8fb5"];

  return elements
    .filter(element => element.id !== selected.id)
    .map(element => {
      const title = element.title;
      const haystack = `${element.title} ${element.subtitle ?? ""} ${element.tags?.join(" ") ?? ""}`;
      const score = Array.from(terms).reduce((sum, term) => (
        term && haystack.includes(term) ? sum + 1 : sum
      ), 0);
      return {
        element,
        score: score + (element.type === selected.type ? 0.5 : 0),
        reason: element.type === selected.type ? "同类型 · 关联度" : "相关分支 · 关联度",
        color: colors[Math.abs(hashCode(element.id)) % colors.length],
      };
    })
    .sort((a, b) => b.score - a.score || a.element.title.localeCompare(b.element.title, "zh-Hans-CN"));
}

function hashCode(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
