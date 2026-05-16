import { useState, type CSSProperties, type FormEvent } from "react";
import type { Element } from "@ke/domain";
import { Icon, iconForElement } from "./Icon.js";
import "./components.css";

export type SystemPanelMode = "search" | "view" | "map" | "notice";

interface Props {
  mode: SystemPanelMode;
  selected: Element;
  elements: Map<string, Element>;
  onSelect: (id: string) => void;
}

export function SystemPanel({ mode, selected, elements, onSelect }: Props) {
  if (mode === "search") {
    return <SearchSystem selected={selected} elements={elements} onSelect={onSelect} />;
  }

  const labels: Record<SystemPanelMode, string> = {
    search: "搜索系统",
    view: "视图系统",
    map: "地图系统",
    notice: "通知系统",
  };

  return (
    <aside className="system-panel">
      <header className="system-panel__head">
        <h2>{labels[mode]}</h2>
        <span>待接入</span>
      </header>
      <div className="system-placeholder">
        <Icon name={mode === "map" ? "map" : mode === "view" ? "grid" : "bell"} />
        <strong>{labels[mode]}</strong>
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
  const all = Array.from(elements.values());
  const related = rankRelated(selected, all).slice(0, 8);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    window.setTimeout(() => setIsSearching(false), 900);
  }

  return (
    <aside className="system-panel search-system">
      <header className="system-panel__head">
        <h2>AI 定位</h2>
        <span>搜索系统</span>
      </header>

      <form className="system-search-box" onSubmit={submitSearch}>
        <Icon name="search" />
        <input
          value={query}
          placeholder="搜索知识元或主题（支持自然语言）"
          onChange={event => setQuery(event.target.value)}
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

      <button className="system-more" type="button">
        展开更多
        <span>⌄</span>
      </button>
    </aside>
  );
}

function rankRelated(selected: Element, elements: Element[]) {
  const terms = new Set([
    selected.title,
    ...selected.title.split(/[·\s]+/).filter(Boolean),
    selected.type,
  ]);
  const colors = ["#6aa8ff", "#74e5b0", "#3dd5cd", "#ffc977", "#55caff", "#ff8fb5"];

  return elements
    .filter(element => element.id !== selected.id)
    .map(element => {
      const title = element.title;
      const score = Array.from(terms).reduce((sum, term) => (
        term && title.includes(term) ? sum + 1 : sum
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
