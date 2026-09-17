import { useEffect, useState, type MouseEvent, type ReactNode, type UIEvent } from "react";
import { displayNumber, type WorkbenchCard, type WorkbenchDocument } from "@ke/domain";
import { CollaborativeWorkspaceShell } from "../../components/collaborative-workspace/CollaborativeWorkspaceShell.js";
import { InformationWorkspaceShell } from "../../components/collaborative-workspace/InformationWorkspaceShell.js";
import { CodexConversationPanel } from "../../components/codex-conversation/CodexConversationPanel.js";
import { FlowchartsWorkspace } from "../project-management/flowcharts/FlowchartsWorkspace.js";
import { useStore } from "../../state/store.js";
import "./WorkbenchDocumentView.css";
import "./WorkbenchDocumentProposal.css";

type Proposal = { id: string; documentId: string; summary: string; createdAt: string };
async function request<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(`/api/workbench-documents${path}`, init); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "请求失败"); return data; }
function text(value: unknown): string { return typeof value === "string" ? value : value ? JSON.stringify(value) : ""; }

export function WorkbenchDocumentView(): ReactNode {
  const [, setDocuments] = useState<WorkbenchDocument[]>([]);
  const [currentDocument, setCurrentDocument] = useState<WorkbenchDocument>();
  const [draft, setDraft] = useState<WorkbenchDocument>();
  const [activeHeadingId, setActiveHeadingId] = useState<string>();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const load = async (id?: string) => { const list = await request<{ documents: WorkbenchDocument[] }>(""); setDocuments(list.documents); const target = id ?? currentDocument?.id ?? list.documents[0]?.id; if (target) { const [next, pending] = await Promise.all([request<{ document: WorkbenchDocument }>(`/${target}`), request<{ proposals: Proposal[] }>(`/${target}/proposals`)]); setCurrentDocument(next.document); setDraft(next.document); setProposals(pending.proposals); } };
  useEffect(() => { void load().catch(reason => setError(String(reason))); }, []);
  useEffect(() => {
    const events = new EventSource("/api/events");
    const changed = (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as { kind?: string; detail?: { documentId?: string } };
      if (payload.kind !== "workbench_document.changed" || !payload.detail?.documentId) return;
      void load(payload.detail.documentId).catch(reason => setError(String(reason)));
    };
    events.addEventListener("change", changed as EventListener);
    return () => events.close();
  }, [currentDocument?.id]);
  const cards = draft?.cards ?? [];
  const depth = (card: WorkbenchCard) => { let result = 0; let parent = card.parentId; while (parent) { result++; parent = cards.find(item => item.id === parent)?.parentId; } return result; };
  const formatMarkdown = async () => {
    if (!currentDocument) return; setBusy(true); setError("");
    try {
      const result = await request<{ document: WorkbenchDocument }>(`/${currentDocument.id}/format-markdown`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: currentDocument.version }) });
      setCurrentDocument(result.document); setDraft(result.document); setDocuments(current => current.map(item => item.id === result.document.id ? result.document : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); }
  };
  const create = async () => { setBusy(true); setError(""); try { const conversation = await fetch("/api/deliverable-codex/__general__/__general__/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "工作台讨论" }) }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "创建对话失败"); return body.conversation; }); const result = await request<{ document: WorkbenchDocument }>("", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "未命名工作台", conversationId: conversation.id }) }); setCurrentDocument(result.document); setDraft(result.document); setDocuments(current => [result.document, ...current]); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } };
  const resolveProposal = async (proposal: Proposal, accepted: boolean) => { setBusy(true); setError(""); try { if (accepted) await request(`/${proposal.documentId}/proposals/${proposal.id}/accept`, { method: "POST" }); else await request(`/${proposal.documentId}/proposals/${proposal.id}`, { method: "DELETE" }); await load(proposal.documentId); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } };
  const headings = cards.filter(card => card.type === "heading");
  useEffect(() => { setActiveHeadingId(headings[0]?.id); }, [currentDocument?.id, currentDocument?.version]);
  const updateActiveHeading = (event: UIEvent<HTMLElement>) => {
    const marker = event.currentTarget.getBoundingClientRect().top + 112;
    const active = headings.reduce<WorkbenchCard | undefined>((current, heading) => {
      const element = document.getElementById(`workbench-card-${heading.id}`);
      return element && element.getBoundingClientRect().top <= marker ? heading : current;
    }, headings[0]);
    if (active) setActiveHeadingId(active.id);
  };
  const locator = <div className="wd-locator"><strong>工作台目录</strong>{headings.map((card, index) => <button key={card.id} aria-current={activeHeadingId === card.id ? "location" : undefined} onClick={() => document.getElementById(`workbench-card-${card.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>{index + 1}. {card.title || "未命名标题"}</button>)}</div>;
  const main = !draft ? <div className="wd-empty"><h1>工作台文档</h1><p>先创建一个工作台，Rich 会收集信息，Agent 把确认后的内容组织成文档卡片。</p><button className="wd-primary" disabled={busy} onClick={() => void create()}>新建工作台</button></div> : <div className="wd-document">
    <header className="wd-document__header"><div><input value={draft.title} aria-label="工作台标题" onChange={event => setDraft({ ...draft, title: event.target.value })} /></div>{cards.length === 1 && cards[0]?.type === "rich_text" && typeof cards[0].content === "string" && /(^|\n)##\s+/.test(cards[0].content) && <button disabled={busy} onClick={() => void formatMarkdown()}>整理为卡片</button>}</header>
    {error && <p className="wd-error" role="alert">{error}</p>}
    {proposals.map(proposal => <section className="wd-proposal" key={proposal.id}><div><strong>工作台更新候选</strong><p>{proposal.summary}</p></div><div><button disabled={busy} onClick={() => void resolveProposal(proposal, false)}>暂不写入</button><button className="wd-primary" disabled={busy} onClick={() => void resolveProposal(proposal, true)}>写入工作台</button></div></section>)}
    <article className="wd-flow">{cards.length ? cards.map(card => <Card key={card.id} card={card} number={card.type === "heading" ? String(headings.findIndex(heading => heading.id === card.id) + 1) : displayNumber({ ...draft, cards }, card.id)} depth={depth(card)} />) : <div className="wd-flow__empty"><h2>从空白开始</h2><p>在右侧告诉 Rich 你的目标。明确后，Agent 会先建立可调整的标题骨架。</p></div>}</article>
  </div>;
  return <CollaborativeWorkspaceShell className="collaborative-workspace--workbench-document" information={<InformationWorkspaceShell locator={draft ? locator : undefined} main={main} onMainScroll={updateActiveHeading} />} conversation={<CodexConversationPanel conversationId={currentDocument?.conversationId} metadata={currentDocument ? { workbenchDocumentId: currentDocument.id } : undefined} header={<><span className="wd-conversation-kicker">任务对话</span><strong>{currentDocument?.title ?? "与 Rich 协作"}</strong><small>讨论形成候选，确认后写入左侧工作台</small></>} />} />;
}

function Card({ card, number, depth }: { card: WorkbenchCard; number: string; depth: number }): ReactNode {
  const component = ["module", "flowchart", "mindmap", "image", "file", "link"].includes(card.type);
  const headingLevel = Math.min(depth + 1, 3);
  const setAppView = useStore(state => state.setAppView);
  const openBinding = (event: MouseEvent) => { event.stopPropagation(); if (card.type === "flowchart") setAppView("flowcharts"); if (card.type === "mindmap") setAppView("deepWorkbench"); };
  return (
    <section id={`workbench-card-${card.id}`} className={`wd-card ${card.type === "heading" ? `wd-card--heading-level-${headingLevel}` : ""} ${component ? "wd-card--component" : ""} ${card.type === "flowchart" ? "wd-card--flowchart" : ""}`} style={{ marginLeft: `${depth * 20}px` }}>
      {card.type === "heading" ? <HeadingCard level={headingLevel} number={number} title={card.title || "未命名标题"} /> : component ? (
        <>
          {card.type !== "flowchart" && <><small>{card.type}</small><h3>{card.title || "未命名组件"}</h3><p>{text(card.content) || "此卡片绑定 Rich 中的独立对象。"}</p></>}
          {card.type === "flowchart" ? <FlowchartDrawer card={card} /> : card.type === "mindmap" && <button className="wd-card__open" onClick={openBinding}>打开原对象</button>}
        </>
      ) : <RichTextCard content={text(card.content)} />}
    </section>
  );
}

function HeadingCard({ level, number, title }: { level: number; number: string; title: string }) {
  if (level === 1) return <h2><small>{number}</small>{title}</h2>;
  if (level === 2) return <h3><small>{number}</small>{title}</h3>;
  return <h4><small>{number}</small>{title}</h4>;
}

function RichTextCard({ content }: { content: string }): ReactNode {
  if (!content) return <p>空文本卡片</p>;
  return <>{content.split(/(```[\s\S]*?```)/g).filter(Boolean).map((part, index) => {
    const code = part.match(/^```([\w-]+)?\n?([\s\S]*?)```$/);
    if (code) return <pre className="wd-code-card" key={index}><span>{code[1] || "代码"}</span><code>{code[2].trim()}</code></pre>;
    return <TextBlocks key={index} content={part} />;
  })}</>;
}

function TextBlocks({ content }: { content: string }): ReactNode {
  const lines = content.trim().split("\n").map(line => line.trim()).filter(Boolean);
  const blocks: Array<{ type: "text"; value: string } | { type: "steps"; value: string[] }> = [];
  let prose: string[] = [];
  let steps: string[] = [];
  const flushProse = () => { if (prose.length) { blocks.push({ type: "text", value: prose.join("\n") }); prose = []; } };
  const flushSteps = () => { if (steps.length) { blocks.push({ type: "steps", value: steps }); steps = []; } };
  for (const line of lines) {
    const step = line.match(/^\d+[.、]\s*(.+)$/)?.[1];
    if (step) { flushProse(); steps.push(step); continue; }
    flushSteps();
    prose.push(line);
  }
  flushProse();
  flushSteps();
  return <>{blocks.map((block, index) => block.type === "steps"
    ? <ol className="wd-step-card" key={index}>{block.value.map((step, stepIndex) => <li key={stepIndex}>{step}</li>)}</ol>
    : <p key={index}>{block.value}</p>)}</>;
}

function FlowchartDrawer({ card }: { card: WorkbenchCard }): ReactNode {
  const content = card.content && typeof card.content === "object" ? card.content as { flowchartId?: unknown } : undefined;
  const propertyId = card.properties.flowchartId;
  const boundId = typeof content?.flowchartId === "string" ? content.flowchartId : typeof propertyId === "string" ? propertyId : undefined;
  const [fallbackId, setFallbackId] = useState<string>();
  const [enlarged, setEnlarged] = useState(false);
  useEffect(() => {
    if (boundId) return;
    void fetch("/api/flowcharts").then(async response => response.ok ? response.json() as Promise<Array<{ id: string }>> : []).then(items => setFallbackId(items[0]?.id)).catch(() => setFallbackId(undefined));
  }, [boundId]);
  const flowchartId = boundId ?? fallbackId;
  return <div className="wd-flowchart-drawer" aria-label={`${card.title || "流程图"}引用`}>
    <div className="wd-flowchart-drawer__label"><span>流程图</span><strong>{card.title || "未命名流程图"}</strong><small>{boundId ? "已绑定" : "引用现有流程图"}</small><button type="button" className="wd-flowchart-drawer__expand" aria-label="放大流程图" title="放大流程图" onClick={() => setEnlarged(true)}>⛶</button></div>
    {flowchartId ? <FlowchartsWorkspace flowchartIds={[flowchartId]} embedded preview readOnly /> : <p className="wd-flowchart-drawer__empty">当前没有可引用的流程图。</p>}
    {enlarged && flowchartId && <div className="wd-flowchart-modal" role="dialog" aria-modal="true" aria-label={`${card.title || "流程图"}放大视图`}>
      <header><div><span>流程图</span><strong>{card.title || "未命名流程图"}</strong></div><button type="button" aria-label="关闭放大流程图" onClick={() => setEnlarged(false)}>×</button></header>
      <div className="wd-flowchart-modal__canvas"><FlowchartsWorkspace flowchartIds={[flowchartId]} embedded preview /></div>
    </div>}
  </div>;
}
