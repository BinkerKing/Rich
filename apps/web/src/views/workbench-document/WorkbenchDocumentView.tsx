import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { displayNumber, type WorkbenchCard, type WorkbenchDocument } from "@ke/domain";
import { CollaborativeWorkspaceShell } from "../../components/collaborative-workspace/CollaborativeWorkspaceShell.js";
import { InformationWorkspaceShell } from "../../components/collaborative-workspace/InformationWorkspaceShell.js";
import { CodexConversationPanel } from "../../components/codex-conversation/CodexConversationPanel.js";
import { useStore } from "../../state/store.js";
import "./WorkbenchDocumentView.css";
import "./WorkbenchDocumentProposal.css";

type Operation = { type: "insert"; card: WorkbenchCard; parentId?: string; index: number } | { type: "update"; cardId: string; patch: Partial<Pick<WorkbenchCard, "title" | "content" | "properties">> } | { type: "remove"; cardId: string };
type Proposal = { id: string; documentId: string; summary: string; createdAt: string };
async function request<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(`/api/workbench-documents${path}`, init); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "请求失败"); return data; }
function text(value: unknown): string { return typeof value === "string" ? value : value ? JSON.stringify(value) : ""; }

export function WorkbenchDocumentView(): ReactNode {
  const [documents, setDocuments] = useState<WorkbenchDocument[]>([]);
  const [currentDocument, setCurrentDocument] = useState<WorkbenchDocument>();
  const [draft, setDraft] = useState<WorkbenchDocument>();
  const [selectedCard, setSelectedCard] = useState<string>();
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
  const dirty = Boolean(currentDocument && draft && (currentDocument.title !== draft.title || JSON.stringify(currentDocument.cards) !== JSON.stringify(draft.cards)));
  const cards = draft?.cards ?? [];
  const depth = (card: WorkbenchCard) => { let result = 0; let parent = card.parentId; while (parent) { result++; parent = cards.find(item => item.id === parent)?.parentId; } return result; };
  const selected = cards.find(card => card.id === selectedCard);
  const updateCard = (cardId: string, patch: Partial<WorkbenchCard>) => setDraft(current => current ? { ...current, cards: current.cards.map(card => card.id === cardId ? { ...card, ...patch } : card) } : current);
  const addText = () => setDraft(current => current ? { ...current, cards: [...current.cards, { id: `local-${crypto.randomUUID()}`, type: "rich_text", order: current.cards.length, content: "", properties: {} }] } : current);
  const removeSelected = () => { if (!selectedCard) return; setDraft(current => { if (!current) return current; const removed = new Set([selectedCard]); for (let changed = true; changed;) { changed = false; current.cards.forEach(card => { if (card.parentId && removed.has(card.parentId) && !removed.has(card.id)) { removed.add(card.id); changed = true; } }); } return { ...current, cards: current.cards.filter(card => !removed.has(card.id)) }; }); setSelectedCard(undefined); };
  const save = async () => {
    if (!currentDocument || !draft) return; setBusy(true); setError("");
    try {
      const original = new Map(currentDocument.cards.map(card => [card.id, card]));
      const operations: Operation[] = [];
      const draftIds = new Set(draft.cards.map(card => card.id));
      currentDocument.cards.slice().reverse().filter(card => !draftIds.has(card.id)).forEach(card => operations.push({ type: "remove", cardId: card.id }));
      for (const [index, card] of draft.cards.entries()) {
        const previous = original.get(card.id);
        if (!previous) { operations.push({ type: "insert", card, parentId: card.parentId, index }); continue; }
        const patch: Partial<Pick<WorkbenchCard, "title" | "content" | "properties">> = {}; if (card.title !== previous.title) patch.title = card.title; if (JSON.stringify(card.content) !== JSON.stringify(previous.content)) patch.content = card.content; if (JSON.stringify(card.properties) !== JSON.stringify(previous.properties)) patch.properties = card.properties;
        if (Object.keys(patch).length) operations.push({ type: "update", cardId: card.id, patch });
      }
      if (!operations.length && currentDocument.title === draft.title) return;
      const result = await request<{ document: WorkbenchDocument }>(`/${currentDocument.id}/manual-save`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: currentDocument.version, operations, title: draft.title }) });
      setCurrentDocument(result.document); setDraft(result.document); setDocuments(current => current.map(item => item.id === result.document.id ? result.document : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); }
  };
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
  const locator = <div className="wd-locator"><strong>工作台目录</strong>{headings.map((card, index) => <button key={card.id} onClick={() => document.getElementById(`workbench-card-${card.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>{index + 1}. {card.title || "未命名标题"}</button>)}</div>;
  const main = !draft ? <div className="wd-empty"><h1>工作台文档</h1><p>先创建一个工作台，Rich 会收集信息，Agent 把确认后的内容组织成文档卡片。</p><button className="wd-primary" disabled={busy} onClick={() => void create()}>新建工作台</button></div> : <div className="wd-document">
    <header className="wd-document__header"><div><select value={draft.id} onChange={event => void load(event.target.value)} aria-label="切换工作台">{documents.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select><input value={draft.title} aria-label="工作台标题" onChange={event => setDraft({ ...draft, title: event.target.value })} /></div><div>{cards.length === 1 && cards[0]?.type === "rich_text" && typeof cards[0].content === "string" && /(^|\n)##\s+/.test(cards[0].content) && <button disabled={busy} onClick={() => void formatMarkdown()}>整理为卡片</button>}<button onClick={addText}>添加文本</button><button className="wd-primary" disabled={!dirty || busy} onClick={() => void save()}>{busy ? "保存中" : "保存"}</button></div></header>
    {error && <p className="wd-error" role="alert">{error}</p>}
    {proposals.map(proposal => <section className="wd-proposal" key={proposal.id}><div><strong>工作台更新候选</strong><p>{proposal.summary}</p></div><div><button disabled={busy} onClick={() => void resolveProposal(proposal, false)}>暂不写入</button><button className="wd-primary" disabled={busy} onClick={() => void resolveProposal(proposal, true)}>写入工作台</button></div></section>)}
    <article className="wd-flow">{cards.length ? cards.map(card => <Card key={card.id} card={card} number={card.type === "heading" ? String(headings.findIndex(heading => heading.id === card.id) + 1) : displayNumber({ ...draft, cards }, card.id)} depth={depth(card)} selected={selectedCard === card.id} onSelect={() => setSelectedCard(card.id)} />) : <div className="wd-flow__empty"><h2>从空白开始</h2><p>在右侧告诉 Rich 你的目标。明确后，Agent 会先建立可调整的标题骨架。</p></div>}</article>
    {selected && <section className="wd-editor"><label>卡片内容<textarea value={text(selected.content)} onChange={event => updateCard(selected.id, { content: event.target.value })} /></label><button onClick={removeSelected}>删除卡片</button></section>}
  </div>;
  return <CollaborativeWorkspaceShell className="collaborative-workspace--workbench-document" information={<InformationWorkspaceShell locator={draft ? locator : undefined} main={main} />} conversation={<CodexConversationPanel conversationId={currentDocument?.conversationId} metadata={currentDocument ? { workbenchDocumentId: currentDocument.id } : undefined} header={<><span className="wd-conversation-kicker">任务对话</span><strong>{currentDocument?.title ?? "与 Rich 协作"}</strong><small>讨论形成候选，确认后写入左侧工作台</small></>} />} />;
}

function Card({ card, number, depth, selected, onSelect }: { card: WorkbenchCard; number: string; depth: number; selected: boolean; onSelect: () => void }): ReactNode {
  const component = ["module", "flowchart", "mindmap", "image", "file", "link"].includes(card.type);
  const setAppView = useStore(state => state.setAppView);
  const openBinding = (event: MouseEvent) => { event.stopPropagation(); if (card.type === "flowchart") setAppView("flowcharts"); if (card.type === "mindmap") setAppView("deepWorkbench"); };
  const steps = card.type === "flowchart" && card.content && typeof card.content === "object" && Array.isArray((card.content as { steps?: unknown }).steps) ? (card.content as { steps: string[] }).steps : [];
  return <section id={`workbench-card-${card.id}`} className={`wd-card ${component ? "wd-card--component" : ""} ${selected ? "is-selected" : ""}`} style={{ marginLeft: `${depth * 20}px` }} onClick={onSelect}>
    {card.type === "heading" ? <h2><small>{number}</small>{card.title || "未命名标题"}</h2> : component ? <><small>{card.type}</small><h3>{card.title || "未命名组件"}</h3>{card.type !== "flowchart" && <p>{text(card.content) || "此卡片绑定 Rich 中的独立对象。"}</p>}{["flowchart", "mindmap"].includes(card.type) && <button className="wd-card__open" onClick={openBinding}>打开原对象</button>}</> : <p>{text(card.content) || "空文本卡片"}</p>}
    {card.type === "flowchart" && steps.length > 0 && <div className="wd-flowchart" aria-label={`${card.title}流程图`}>{steps.map((step, index) => <span key={step}>{step}{index < steps.length - 1 && <b>→</b>}</span>)}</div>}
  </section>;
}
