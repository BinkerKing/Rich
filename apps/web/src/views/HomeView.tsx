import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { RichContent } from "../components/RichContent.js";
import { dispatchMascotEvent } from "../lib/mascotEvents.js";
import { useMascotState } from "../lib/useMascotState.js";
import { VisualBlockRenderer } from "../components/VisualBlockRenderer.js";
import { detectBlockType, type DetectedBlockType } from "../lib/detectBlockType.js";
import { persistVisualBlocks } from "../lib/extractVisualBlocks.js";
import { useChatComposer } from "../lib/useChatComposer.js";
import { api, type AgentSessionState } from "../api/client.js";
import { ChatSlashCommandMenu } from "../components/ChatSlashCommandMenu.js";
import { ConversationTaskPanel } from "../components/ConversationTaskPanel.js";
import { ConversationSavePanel } from "../components/ConversationSavePanel.js";
import { AgentApprovalCard, type PendingAgentApproval } from "../components/AgentApprovalCard.js";
import { parseChatSlashInput, type ChatSlashCommand } from "../lib/chatSlashCommands.js";
import { useStore } from "../state/store.js";

/** 哪些 block 类型才能上舞台 = 真正『图形』、不是文字组织 */
const STAGE_VISUAL_TYPES = new Set<DetectedBlockType>([
  "flowchart", "chart", "sequence", "architecture", "tree", "sketch",
]);
/** table / concept / raw 不上舞台 —— 它们本质是文字塞进框里，看着还是大把文字 */
import { markChatSendStart, markMascotFirstFrame, markFirstTextChunk, newReqId } from "../lib/perfMarks.js";
import "../components/RichContent.css";
import {
  CHAT_HISTORY_STORAGE_KEY,
  CHAT_HISTORY_UPDATED_EVENT,
  DEFAULT_CHAT_CONVERSATION_ID,
  loadChatHistory,
  loadServerChatHistory,
  saveChatHistory,
  attachmentDataUrl,
  type ChatHistoryMessage,
} from "../lib/chatHistory.js";
import { IronManFlight } from "./IronManFlight.js";
import walk0 from "../assets/mascot/walk-0.png";
import walk1 from "../assets/mascot/walk-1.png";
import walk2 from "../assets/mascot/walk-2.png";
import walk3 from "../assets/mascot/walk-3.png";
import "./HomeView.css";

/**
 * HomeView — Rich's cinematic landing page.
 *
 * Replaces the previous InputView as the default home (when appView===tree
 * AND no rootId). Layout:
 *
 *   ┌──────────────────────────────────┐
 *   │      [ animated mascot ]         │  ← top half: presentation surface
 *   │                                  │     (currently just the walk cycle;
 *   │                                  │      future: avatar / video / etc.)
 *   ├─────[ input box on midline ]─────┤  ← middle: user → Rich input
 *   │                                  │
 *   │  Rich's streamed reply           │  ← bottom half: response area
 *   │                                  │
 *   └──────────────────────────────────┘
 *
 * Input pipes to Hermes via /api/chat/stream — same backend as the global
 * Cmd+Shift+Space chat overlay. Tool calls, text deltas, errors all
 * appear in the bottom half in real time. The thread is shared with the
 * global Cmd+Shift+Space chat overlay via localStorage.
 *
 * Quick-jump buttons (top right) still surface the other entry points so
 * the user can reach the old InputView, tree, news, etc.
 */

const WALK_FRAMES = [walk0, walk1, walk2, walk3];

/** Animation catalogue — server defines the names, we define the look.
 *  Each entry maps to CSS class `home-mascot--<name>`; tweak the visual
 *  in HomeView.css (glow color / scale / bob amplitude / particles). */
type MascotName =
  | "walk" | "idle" | "celebrate" | "think" | "happy"
  | "sad" | "alert" | "sleep" | "dance" | "wave" | "transform" | "ironman";

interface MascotState {
  current: MascotName;
  fallback: MascotName;
  startedAt: string;
  durationMs?: number;
  triggeredBy: "hermes" | "user" | "system";
}

/** Per-animation frame rate (ms between sprite swaps). Loop-style animations
 *  cycle through walk-0..walk-3; one-shots may freeze on a single frame and
 *  rely on CSS effects (scale / rotate / glow). */
const FPS_MS: Record<MascotName, number> = {
  walk: 180, idle: 600, celebrate: 90, think: 360, happy: 140,
  sad: 480, alert: 100, sleep: 1200, dance: 80, wave: 200, transform: 60,
  ironman: 999_999, // sprite hidden during this sequence; FPS irrelevant
};

type Turn = ChatHistoryMessage;
interface ChatPair {
  id: string;
  index: number;
  question: Turn;
  answer?: Turn;
}

function nextId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function shouldDance(text: string) {
  return /跳舞|跳个舞|小人跳|dance/i.test(text);
}

/** 抽出最近一组 (问题, 答案) 给首页主区显示。流式中也算 — answer 可能 pending。 */
function latestPair(turns: Turn[]): { question: Turn; answer: Turn | null } | null {
  // 找最后一个 user turn
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.role === "user") {
      const next = turns[i + 1];
      return { question: t, answer: next?.role === "assistant" ? next : null };
    }
  }
  return null;
}

/** 解析答案文本里的 ascii 视觉块（含未闭合的 streaming 块） */
const VBLOCK_RE = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
const VBLOCK_OPEN_RE = /```([a-zA-Z]*)\n([\s\S]*)$/;
function parseAnswerVisuals(content: string): { ascii: string; closed: boolean }[] {
  const out: { ascii: string; closed: boolean }[] = [];
  VBLOCK_RE.lastIndex = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = VBLOCK_RE.exec(content)) !== null) {
    out.push({ ascii: m[2], closed: true });
    last = VBLOCK_RE.lastIndex;
  }
  // 末尾未闭合的围栏
  const tail = content.slice(last);
  const openMatch = tail.match(VBLOCK_OPEN_RE);
  if (openMatch && openMatch[2].length > 0) {
    out.push({ ascii: openMatch[2], closed: false });
  }
  return out;
}
/** Strip ONLY blocks that will go to the visual stage. Code blocks
 *  (```sql, ```python, ```bash …) and anything else `detectBlockType`
 *  classifies as non-stage (raw / concept / table) must stay in the text
 *  so markdown can render them inline — otherwise the answer ends up with
 *  blank gaps where the code should be. */
function stripVisuals(content: string): string {
  const stripBlock = (full: string, ascii: string): string =>
    STAGE_VISUAL_TYPES.has(detectBlockType(ascii)) ? "" : full;
  return content
    .replace(VBLOCK_RE, (full, _lang, ascii) => stripBlock(full, ascii))
    .replace(VBLOCK_OPEN_RE, (full, _lang, ascii) => stripBlock(full, ascii))
    .trim();
}

function textChunkWeight(text: string): number {
  const compact = text.replace(/\s+/g, " ").trim();
  return Math.max(1, Math.ceil(compact.length / 42));
}

function splitTextForColumns(text: string): [string, string] {
  const paragraphs = text.split(/\n{2,}/).map(part => part.trim()).filter(Boolean);
  const chunks = paragraphs.length > 1
    ? paragraphs
    : text.split(/\n/).map(part => part.trim()).filter(Boolean);

  if (chunks.length <= 1) {
    const compact = text.trim();
    if (!compact) return ["", ""];
    const center = Math.floor(compact.length / 2);
    const before = compact.lastIndexOf(" ", center);
    const after = compact.indexOf(" ", center);
    const splitAt = before > compact.length * 0.35
      ? before
      : after > -1 && after < compact.length * 0.65
        ? after
        : center;
    return [compact.slice(0, splitAt).trim(), compact.slice(splitAt).trim()];
  }

  const totalWeight = chunks.reduce((sum, chunk) => sum + textChunkWeight(chunk), 0);
  const firstColumnTarget = totalWeight * 0.42;
  let runningWeight = 0;
  let cut = 1;
  for (let i = 0; i < chunks.length - 1; i++) {
    runningWeight += textChunkWeight(chunks[i]);
    if (runningWeight >= firstColumnTarget) {
      cut = i + 1;
      break;
    }
  }

  return [chunks.slice(0, cut).join("\n\n"), chunks.slice(cut).join("\n\n")];
}

function buildChatPairs(turns: Turn[], limit = 50): ChatPair[] {
  const pairs: ChatPair[] = [];
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (turn.role !== "user") continue;
    let answer: Turn | undefined;
    for (let j = i + 1; j < turns.length; j++) {
      if (turns[j].role === "user") break;
      if (turns[j].role === "assistant") {
        answer = turns[j];
        break;
      }
    }
    pairs.push({
      id: `${turn.id}-${answer?.id ?? "pending"}`,
      index: pairs.length + 1,
      question: turn,
      answer,
    });
  }
  return pairs.slice(-limit).reverse();
}

function messageTime(turn: Turn | undefined): number | null {
  if (!turn) return null;
  if (typeof turn.createdAt === "number") return turn.createdAt;
  const prefix = turn.id.split("-")[0];
  const parsed = Number.parseInt(prefix, 36);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatHistoryTime(turn: Turn | undefined): string {
  const ts = messageTime(turn);
  if (!ts) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

/** 右键菜单：
 *  - 选中文字 → 复制 / 高亮 / 下划线
 *  - 右键现有 mark → 取消标记
 *  高亮 / 下划线用 DOM range wrap，本地（DOM 内存）有效，刷新或重渲染失效。 */
interface SelectionMenu {
  x: number;
  y: number;
  /** 选中模式：text + range 必有；markEl 不存在 */
  text?: string;
  range?: Range;
  /** 移除模式：markEl 存在；text / range 不一定有 */
  markEl?: HTMLElement;
}

export function HomeView() {
  const [frame, setFrame] = useState(0);
  const [input, setInput] = useState("");
  const [agentSession, setAgentSession] = useState<AgentSessionState | null>(null);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [savePanelOpen, setSavePanelOpen] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<PendingAgentApproval | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [turns, setTurns] = useState<Turn[]>(() => loadChatHistory());
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selMenu, setSelMenu] = useState<SelectionMenu | null>(null);
  // T06 状态机驱动首页大 Mascot —— useMascotState 接 mascotStateMachine，
  // 状态变化时映射到本地 home-mascot 名字（保留旧 sprite 系统 + 后端 /api/mascot/play 集成）
  const machineState = useMascotState();
  // 照片对话支持：附件状态机 + 上传逻辑都封在 hook 里，ChatOverlay 也用同款
  const composer = useChatComposer({ maxAttachments: 8 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const slashCommand = useMemo(() => parseChatSlashInput(input), [input]);
  const elements = useStore(state => state.elements);
  const projects = useMemo(() => Array.from(elements.values()).filter(element => {
    const content = element.content;
    return element.type === "project" && Boolean(content) && typeof content === "object"
      && typeof (content as { localFolder?: unknown }).localFolder === "string";
  }).map(element => ({ id: element.id, title: element.title })), [elements]);

  useEffect(() => {
    const refresh = () => void api.getAgentSession(DEFAULT_CHAT_CONVERSATION_ID).then(setAgentSession).catch(() => undefined);
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  useEffect(() => { setSlashIndex(0); }, [input]);
  const [mascot, setMascot] = useState<MascotState>({
    current: "walk", fallback: "walk",
    startedAt: new Date().toISOString(), triggeredBy: "system",
  });
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composingRef = useRef(false);
  const lastDictationInputAtRef = useRef(0);
  const historyPointerToggledRef = useRef(false);
  const answerTextMeasureRef = useRef<HTMLDivElement | null>(null);
  // Hidden mirror div that wraps EXACTLY like the textarea (same width, font,
  // line-height, padding, white-space). We slice the typed text at the caret
  // position, insert a zero-width marker span, then read the marker's
  // bounding rect — that's the pixel-precise caret position, including
  // arrow-key movement and soft wrapping.
  const measureRef = useRef<HTMLDivElement | null>(null);
  const caretMarkerRef = useRef<HTMLSpanElement | null>(null);
  const [caretPos, setCaretPos] = useState(0);
  const [petX, setPetX] = useState(0);
  const [petY, setPetY] = useState(0);
  const [textNeedsColumns, setTextNeedsColumns] = useState(false);
  const [dismissedAnswerId, setDismissedAnswerId] = useState<string | null>(null);
  const chatPairs = useMemo(() => buildChatPairs(turns), [turns]);

  // 首页主区显示「最新一组对话」—— 用户问一句，Rich 答的视觉块+文字在 stage 大显示
  const latestQA = useMemo(() => latestPair(turns), [turns]);
  const latestAnswerContent = latestQA?.answer?.content ?? "";
  const latestAnswerId = latestQA?.answer?.id ?? null;
  const allVisuals = useMemo(
    () => parseAnswerVisuals(latestAnswerContent),
    [latestAnswerContent],
  );
  /** 只筛真正的图（流程图/图表/时序/架构/树/手绘）；table/concept/raw 不上舞台 */
  const latestVisuals = useMemo(
    () => allVisuals.filter(v => STAGE_VISUAL_TYPES.has(detectBlockType(v.ascii))),
    [allVisuals],
  );
  const latestText = useMemo(() => stripVisuals(latestAnswerContent), [latestAnswerContent]);
  const textColumnParts = useMemo(() => splitTextForColumns(latestText), [latestText]);
  const isTextOnlyAnswer = latestText.length > 0 && latestVisuals.length === 0;
  const currentAnswerDismissed = latestAnswerId !== null && dismissedAnswerId === latestAnswerId;
  /** stage 是否进入「答案模式」：用户问了任何问题 → 当前 Q&A 上半屏展示。
   *  有视觉块就视觉块 + 文字（针对当前问题）；纯文字就文字。
   *  历史是另外的 surface，默认隐藏，点 📜 才看。 */
  const stageInAnswerMode = !!latestQA?.answer && !currentAnswerDismissed && (
    latestQA.answer.pending ||
    latestText.length > 0 ||
    latestVisuals.length > 0 ||
    !!latestQA.answer.error
  );

  useEffect(() => {
    setHistoryOpen(false);
  }, []);

  useEffect(() => {
    setDismissedAnswerId(null);
  }, [latestAnswerId]);

  useLayoutEffect(() => {
    if (!isTextOnlyAnswer) {
      setTextNeedsColumns(false);
      return;
    }

    const measureEl = answerTextMeasureRef.current;
    if (!measureEl) return;

    let raf = 0;
    const measure = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const next = measureEl.scrollHeight > measureEl.clientHeight + 4;
        setTextNeedsColumns(prev => (prev === next ? prev : next));
      });
    };

    measure();
    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(measure)
      : null;
    observer?.observe(measureEl);
    window.addEventListener("resize", measure);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isTextOnlyAnswer, latestText]);

  // 选中 + 右键菜单 —— 答案区 / 历史 / 视觉块 / 问题气泡 都支持。
  // 复制：直接 navigator.clipboard。高亮 / 下划线：DOM wrap（本地有效，不持久）。
  useEffect(() => {
    const SELECTABLE_SCOPE =
      ".home-answer__text, .home-answer__visuals, .home-history, .home-corner-bubble, .vbr";
    const onContext = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest?.(SELECTABLE_SCOPE)) return;
      // 优先：右键点在现有 mark 上 → 取消标记菜单
      const markEl = t.closest?.(".home-mark") as HTMLElement | null;
      if (markEl) {
        e.preventDefault();
        setSelMenu({ x: e.clientX, y: e.clientY, markEl });
        return;
      }
      const sel = window.getSelection();
      const text = sel?.toString() ?? "";
      if (!text.trim() || !sel || sel.rangeCount === 0) return;
      e.preventDefault();
      setSelMenu({ x: e.clientX, y: e.clientY, text, range: sel.getRangeAt(0).cloneRange() });
    };
    const onAway = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(".home-sel-menu")) return;
      setSelMenu(null);
    };
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("mousedown", onAway);
    window.addEventListener("scroll", () => setSelMenu(null), true);
    return () => {
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("mousedown", onAway);
      window.removeEventListener("scroll", () => setSelMenu(null), true);
    };
  }, []);

  async function copySelection() {
    if (!selMenu?.text) return;
    try { await navigator.clipboard.writeText(selMenu.text); } catch { /* offline / blocked */ }
    setSelMenu(null);
  }
  function markSelection(kind: "highlight" | "underline") {
    if (!selMenu?.range) return;
    try {
      const span = document.createElement("span");
      span.className = `home-mark home-mark--${kind}`;
      selMenu.range.surroundContents(span);
      window.getSelection()?.removeAllRanges();
    } catch {
      // Range 跨越多个块时 surroundContents 失败 —— 暂时静默
    }
    setSelMenu(null);
  }
  /** 取消高亮 / 下划线：把 mark span 内的文字节点搬到 span 外，再删掉 span */
  function removeMark() {
    if (!selMenu?.markEl) return;
    const el = selMenu.markEl;
    const parent = el.parentNode;
    if (parent) {
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    }
    setSelMenu(null);
  }

  // 历史 panel 全屏模式时 ESC 关闭（用户原话「点开看」是主动行为，关闭也得方便）
  useEffect(() => {
    if (!historyOpen) return;
    const handler = (e: KeyboardEvent): void => {
      const t = e.target;
      if (t instanceof HTMLElement && t.closest("input, textarea")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setHistoryOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [historyOpen]);

  // Initial fetch of mascot state, then live updates via the shared SSE
  // channel (/api/events). Any code path (REST or MCP) that publishes
  // `mascot.changed` triggers a refetch — we don't bother diff-applying
  // because the state is tiny.
  useEffect(() => {
    const refetch = () => {
      fetch("/api/mascot/state")
        .then(r => r.ok ? r.json() : null)
        .then(s => { if (s) setMascot(s); })
        .catch(() => { /* offline — keep current */ });
    };
    refetch();
    const es = new EventSource("/api/events");
    const onChange = () => refetch();
    es.addEventListener("change", onChange);
    return () => { es.close(); };
  }, []);

  // T06 状态机 → 首页大 Mascot 名字 映射：聊天发起 / 流式 / 完成 时
  // 自动驱动 home-mascot--<name> 切换。后端 /api/mascot/play 没改变（仅在
  // shouldDance 等用户主动行为时调），状态机优先级更高。
  useEffect(() => {
    const MAP: Record<typeof machineState, MascotName> = {
      idle: "walk",
      thinking: "think",
      talking: "happy",        // 流式输出中：保持活力（walk 太静、think 太蹙眉）
      proud: "celebrate",
      confused: "alert",
      embarrassed: "sad",
    };
    const next = MAP[machineState] ?? "walk";
    setMascot(prev => prev.current === next ? prev : {
      current: next,
      fallback: "walk",
      startedAt: new Date().toISOString(),
      triggeredBy: "system",
    });
  }, [machineState]);

  // Mascot walk-cycle: swap sprite frames at a tempo dictated by the current
  // animation. Pure JS state (rather than CSS `steps()` animation) keeps the
  // same sprite set reusable at multiple sizes; the per-animation visual
  // effects (glow / bob amplitude / particles) live in CSS keyed off the
  // `home-mascot--<name>` class on the wrapper.
  useEffect(() => {
    const ms = FPS_MS[mascot.current] ?? 180;
    const id = window.setInterval(
      () => setFrame(f => (f + 1) % WALK_FRAMES.length),
      ms,
    );
    return () => window.clearInterval(id);
  }, [mascot.current]);

  // Newest message renders at the TOP (right under the input box), so
  // auto-scroll to scrollTop=0 on every update — keeps the live token
  // stream visible without the user chasing it.
  useEffect(() => {
    bottomRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    const refresh = () => setTurns(loadChatHistory({ preservePending: true }));
    const refreshFromServer = () => {
      if (busy) return;
      void loadServerChatHistory().then(serverMessages => {
        if (serverMessages.length === 0) return;
        setTurns(serverMessages);
        saveChatHistory(serverMessages);
      }).catch(() => refresh());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === CHAT_HISTORY_STORAGE_KEY) refresh();
    };
    refreshFromServer();
    window.addEventListener(CHAT_HISTORY_UPDATED_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHAT_HISTORY_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [busy]);

  // Auto-grow textarea: shrink-to-content first, then size to scrollHeight.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  // Block-caret position. The mirror div has identical typography + width to
  // the textarea, so its line wrapping matches char-for-char. We insert a
  // marker at `caretPos` and read its bounding rect → that's where the caret
  // really is. Tracks BOTH arrow-key movement (caretPos updates via onSelect)
  // AND soft wrap (mirror wraps the same way the textarea does).
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    const mirror = measureRef.current;
    const marker = caretMarkerRef.current;
    if (!ta || !mirror || !marker) return;
    // Pin the mirror to the textarea's content width so soft-wrap lines up.
    mirror.style.width = `${ta.clientWidth}px`;
    const mirrorRect = mirror.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    setPetX(markerRect.left - mirrorRect.left);
    setPetY(markerRect.top - mirrorRect.top);
  }, [input, caretPos]);

  useEffect(() => {
    const isTypingSurface = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest("input, textarea, select, button, a, [contenteditable='true'], [role='menuitem']"));
    };
    /** 用户要在这些区域选中文字 / 右键复制 —— 不能抢焦点回输入框，
     *  否则 Cmd+C 复制的是输入框（空）而不是用户选中的文字。 */
    const isSelectableSurface = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return Boolean(target.closest(
        ".home-answer__text, .home-answer__visuals, .home-history, .home-corner-bubble, .vbr, .ke-annotation"
      ));
    };
    const insertAtCursor = (text: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const base = el.value || input;
      const start = el.selectionStart ?? base.length;
      const end = el.selectionEnd ?? start;
      const nextValue = `${base.slice(0, start)}${text}${base.slice(end)}`;
      setInput(nextValue);
      window.requestAnimationFrame(() => {
        el.focus();
        const next = start + text.length;
        el.setSelectionRange(next, next);
        setCaretPos(next);
      });
    };
    const onPointerDown = (event: PointerEvent) => {
      if (isTypingSurface(event.target)) return;
      if (isSelectableSurface(event.target)) return;   // 文字选中区不偷焦点
      if (event.button !== 0) return;                  // 只有左键才回焦输入框（右键 / 中键放过去）
      window.requestAnimationFrame(() => textareaRef.current?.focus());
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingSurface(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.isComposing || event.key === "Process" || event.key.startsWith("Dead")) return;
      if (event.key.length !== 1) return;
      // 用户有选中（在答案区 / 历史里）时，别把按键塞进输入框 —— 让选区交互优先
      const sel = window.getSelection();
      if (sel && sel.toString().length > 0) return;
      event.preventDefault();
      insertAtCursor(event.key);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [input]);

  async function chooseChatCommand(command: ChatSlashCommand) {
    if (command.id === "agent") {
      const session = await api.startAgentSession(DEFAULT_CHAT_CONVERSATION_ID);
      setAgentSession(session);
      setInput("");
    } else if (command.id === "chat") {
      if (agentSession) setAgentSession(await api.exitAgentSession(DEFAULT_CHAT_CONVERSATION_ID));
      setInput("");
    } else if (command.id === "task") {
      setTaskPanelOpen(true);
      setInput("");
    } else if (command.id === "save") {
      setSavePanelOpen(true);
      setInput("");
    } else {
      setInput(`${command.token} `);
    }
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function send(text: string) {
    const trimmed = text.trim();
    const attRefs = composer.getAttachmentRefs();
    // 允许『纯图无文字』发送（图本身就是问题）；但 busy / 还在上传时拒绝
    if ((!trimmed && attRefs.length === 0) || busy || composer.isUploading) return;
    if (trimmed && shouldDance(trimmed)) {
      const dancing: MascotState = {
        current: "dance",
        fallback: mascot.fallback || "walk",
        startedAt: new Date().toISOString(),
        triggeredBy: "user",
      };
      setMascot(dancing);
      void fetch("/api/mascot/play", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "dance" }),
      }).catch(() => { /* local animation already started */ });
    }
    const now = Date.now();
    const userTurn: Turn = {
      id: nextId(), role: "user",
      content: trimmed || "（图片）",
      tools: [], pending: false, createdAt: now,
      attachments: attRefs.length > 0
        ? attRefs.map(r => ({ id: r.id, url: r.url, mime: r.mime, width: r.width, height: r.height }))
        : undefined,
    };
    const assistantTurn: Turn = {
      id: nextId(), role: "assistant", content: "", tools: [], pending: true, createdAt: now,
    };
    const baseTurns = loadChatHistory();
    const nextTurns = [...baseTurns, userTurn, assistantTurn];
    setTurns(nextTurns);
    saveChatHistory(nextTurns);
    // 把附件绑定到 message（服务端记得这些图属于哪条消息）
    for (const ref of attRefs) {
      void fetch(`/api/chat/attachments/${ref.id}/bind`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messageId: userTurn.id }),
      }).catch(() => { /* 绑定失败不影响发送 */ });
    }
    // 不要自动开历史 —— 当前 Q&A 在上面 stage 已经展示，历史是另外的 surface
    // 用户主动点 📜 才开（fullscreen overlay）
    setInput("");
    composer.clear();
    setBusy(true);

    // Build history-to-send: all prior turns + new user message. We don't
    // send the empty assistant placeholder we just appended; only the
    // canonical conversation Hermes needs to reason about.
    const history = [...baseTurns, userTurn].map(t => ({ role: t.role, content: t.content }));
    // Mascot 状态切到 thinking（瞬时，跟服务端 mascot 事件兜底叠加）
    dispatchMascotEvent({ type: "user-send" });
    // T18 性能埋点
    const reqId = newReqId();
    markChatSendStart(reqId);
    markMascotFirstFrame(reqId);
    let firstTextChunkSeen = false;

    try {
      const r = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: DEFAULT_CHAT_CONVERSATION_ID,
          clientRequestId: reqId,
          userMessageId: userTurn.id,
          surface: "home",
          messages: history,
          // 把图片 ref 也带上 —— 后端会从 chat_attachments 拉字节 inline 进最后一条 user message
          attachments: attRefs.length > 0
            ? attRefs.map(r => ({ id: r.id, mime: r.mime }))
            : undefined,
        }),
      });
      if (!r.ok || !r.body) throw new Error(`chat failed: ${r.status}`);
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let currentEvent: string | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).replace(/\r$/, "");
          buf = buf.slice(nl + 1);
          if (line === "") { currentEvent = null; continue; }
          if (line.startsWith("event:")) { currentEvent = line.slice(6).trim(); continue; }
          if (line.startsWith("data:")) {
            const data = line.slice(5).trim();
            if (!data) continue;
            let parsed: unknown;
            try { parsed = JSON.parse(data); } catch { continue; }
            if (currentEvent === "text") {
              const { chunk } = parsed as { chunk: string };
              setTurns(prev => {
                const next = prev.map((t, i) =>
                  i === prev.length - 1 ? { ...t, content: t.content + chunk } : t,
                );
                saveChatHistory(next);
                return next;
              });
              if (!firstTextChunkSeen) {
                firstTextChunkSeen = true;
                dispatchMascotEvent({ type: "first-text-chunk" });
                markFirstTextChunk(reqId);   // T18
              }
            } else if (currentEvent === "mascot") {
              const m = parsed as { state: import("../lib/mascotEvents.js").MascotState };
              if (m.state) dispatchMascotEvent({ type: "server-push", state: m.state });
            } else if (currentEvent === "tool") {
              const tev = parsed as { name: string; status: "running" | "completed" };
              setTurns(prev => {
                const next = prev.slice();
                const i = next.length - 1;
                const t = next[i];
                if (!t) return prev;
                const tools = [...(t.tools ?? [])];
                if (tev.status === "completed") {
                  // Update the most recent matching "running" entry to "completed".
                  for (let k = tools.length - 1; k >= 0; k--) {
                    if (tools[k].name === tev.name && tools[k].status === "running") {
                      tools[k] = { ...tev, ts: Date.now() };
                      next[i] = { ...t, tools };
                      saveChatHistory(next);
                      return next;
                    }
                  }
                }
                tools.push({ ...tev, ts: Date.now() });
                next[i] = { ...t, tools };
                saveChatHistory(next);
                return next;
              });
            } else if (currentEvent === "approval_required") {
              const approval = parsed as PendingAgentApproval;
              setPendingApproval(approval);
            } else if (currentEvent === "done") {
              setTurns(prev => {
                const next = prev.map((t, i) =>
                  i === prev.length - 1 ? { ...t, pending: false } : t,
                );
                saveChatHistory(next);
                // T15 持久化视觉块
                const last = next.at(-1);
                if (last?.role === "assistant" && last.content && last.id) {
                  void persistVisualBlocks(last.id, last.content);
                }
                return next;
              });
              dispatchMascotEvent({ type: "done" });
            } else if (currentEvent === "error") {
              const { message } = parsed as { message: string };
              setTurns(prev => {
                const next = prev.map((t, i) =>
                  i === prev.length - 1 ? { ...t, pending: false, error: message } : t,
                );
                saveChatHistory(next);
                return next;
              });
              dispatchMascotEvent({ type: "error", message });
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      dispatchMascotEvent({ type: "error", message });
      setTurns(prev => {
        const next = prev.map((t, i) =>
          i === prev.length - 1
            ? { ...t, pending: false, error: message }
            : t,
        );
        saveChatHistory(next);
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (slashCommand.open && slashCommand.matches.length > 0) {
      void chooseChatCommand(slashCommand.matches[slashIndex] ?? slashCommand.matches[0]);
      return;
    }
    if (input.trim() === "/agent new") {
      void api.newAgentSession(DEFAULT_CHAT_CONVERSATION_ID).then(session => {
        setAgentSession(session);
        setInput("");
      });
      return;
    }
    if (slashCommand.selected?.command === "task") {
      setTaskPanelOpen(true);
      setInput("");
      return;
    }
    if (slashCommand.selected?.command === "save") {
      setSavePanelOpen(true);
      setInput("");
      return;
    }
    void send(input);
  }

  function syncHomeInput(el: HTMLTextAreaElement, inputType?: string) {
    if (inputType === "insertFromDictation") {
      lastDictationInputAtRef.current = Date.now();
    }
    setInput(el.value);
    setCaretPos(el.selectionStart ?? el.value.length);
  }

  function toggleHistory() {
    setHistoryOpen(open => !open);
  }

  function returnToHomeStage() {
    if (latestAnswerId) setDismissedAnswerId(latestAnswerId);
    setHistoryOpen(false);
    setSelMenu(null);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }

  return (
    <div className="home-view">
      {taskPanelOpen && <ConversationTaskPanel conversationId={DEFAULT_CHAT_CONVERSATION_ID} projects={projects}
        messages={turns.filter((turn): turn is Turn & { role: "user" | "assistant" } => turn.role === "user" || turn.role === "assistant").map(turn => ({ id: turn.id, role: turn.role, content: turn.content }))}
        onClose={() => setTaskPanelOpen(false)} />}
      {savePanelOpen && <ConversationSavePanel conversationId={DEFAULT_CHAT_CONVERSATION_ID} projects={projects}
        messages={turns.filter((turn): turn is Turn & { role: "user" | "assistant" } => turn.role === "user" || turn.role === "assistant").map(turn => ({ id: turn.id, role: turn.role, content: turn.content }))}
        onClose={() => setSavePanelOpen(false)} />}
      {pendingApproval && <AgentApprovalCard conversationId={DEFAULT_CHAT_CONVERSATION_ID} approval={pendingApproval} onResolved={() => setPendingApproval(null)} />}
      {/* Invisible drag strip across the top of the window. Native
       *  titleBarStyle is "hiddenInset" — without an explicit drag region
       *  the user can't move the window or double-click to maximize.
       *  Interactive children (quick-jump buttons, mascot eventually) are
       *  marked `-webkit-app-region: no-drag` in CSS so they stay clickable. */}
      <div className="home-drag-bar" aria-hidden="true" />

      {/* Navigation entirely lives in the bottom-left MascotDock — no
       *  top-right quick-jump on this page anymore. */}
      <button
        type="button"
        className={`home-history-toggle${historyOpen ? " is-open" : ""}`}
        aria-label={historyOpen ? "隐藏聊天历史" : "查看聊天历史"}
        title={historyOpen ? "隐藏聊天历史" : "查看聊天历史"}
        onClick={() => {
          if (historyPointerToggledRef.current) {
            historyPointerToggledRef.current = false;
            return;
          }
          toggleHistory();
        }}
        onPointerDown={e => {
          e.preventDefault();
          historyPointerToggledRef.current = true;
          toggleHistory();
        }}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleHistory();
          }
        }}
      >
        <span aria-hidden="true">≡</span>
      </button>

      {/* Top half — presentation surface. The wrapper carries the
       *  `home-mascot--<name>` class so each animation gets its own
       *  glow color / scale / bob amplitude / particle layer from CSS. */}
      <section className={`home-stage${stageInAnswerMode ? " is-answer-mode" : ""}`}>
        <div className="home-scan-grid" />
        {mascot.current === "ironman" ? (
          // Iron Man owns the whole stage for 30s
          <IronManFlight key={mascot.startedAt} />
        ) : stageInAnswerMode ? (
          // ╭─────────────────── 答案模式 ───────────────────╮
          // 用户问了问题 → 首页主区 = AI 视觉答案区。
          // 视觉块（流程图 / 表 / 树）BIG 显示在中间；文字答案在下方。
          // 用户的问题 + Mascot 都搬到左下角（home-corner-mascot），
          // 问题以气泡 (bubble) 形式挂在 Mascot 头顶。
          (() => {
            // 根据内容自适应布局：
            //   - 纯图（无文字）  → 居中大图
            //   - 纯文字（无图）  → 居中文字块
            //   - 图 + 文字       → 左右分栏（图左，文字右），不再上下堆叠
            const hasVisuals = latestVisuals.length > 0;
            const hasText = latestText.length > 0;
            const layout =
              hasVisuals && hasText ? "split" :
              hasVisuals ? "visuals-only" :
              hasText ? "text-only" : "empty";
            return (
              <div className={`home-answer home-answer--${layout}`}>
                <div className="home-answer__body">
                  {hasVisuals && (
                    <div className="home-answer__visuals">
                      {latestVisuals.map((v, i) => (
                        <VisualBlockRenderer
                          key={i}
                          ascii={v.ascii}
                          mode={v.closed ? "final" : "stream"}
                          done={v.closed}
                        />
                      ))}
                    </div>
                  )}
                  {hasText && layout === "text-only" && (
                    <div className={`home-answer__text${textNeedsColumns ? " is-two-column" : ""}`}>
                      <div
                        ref={answerTextMeasureRef}
                        className="home-answer__text-probe"
                        aria-hidden="true"
                      >
                        <RichContent text={latestText} />
                      </div>
                      {textNeedsColumns ? (
                        <div className="home-answer__text-columns">
                          <div className="home-answer__text-column home-answer__text-column--primary">
                            <RichContent text={textColumnParts[0] || latestText} />
                          </div>
                          <div className="home-answer__text-column home-answer__text-column--scroll">
                            <RichContent text={textColumnParts[1]} />
                          </div>
                        </div>
                      ) : (
                        <RichContent text={latestText} />
                      )}
                    </div>
                  )}
                  {hasText && layout !== "text-only" && (
                    <div className="home-answer__text">
                      <RichContent text={latestText} />
                    </div>
                  )}
                  {!hasText && !hasVisuals && latestQA?.answer?.pending && (
                    <div className="home-answer__waiting">Rich 正在写…</div>
                  )}
                  {latestQA?.answer?.error && (
                    <div className="home-answer__error">⚠ {latestQA.answer.error}</div>
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          // ╭───────────────── 空闲模式（默认）─────────────────╮
          // 没问问题时 mascot 大居中（保持原视觉）
          <div className={`home-mascot-wrap home-mascot--${mascot.current}`}>
            <div className="home-mascot-glow" />
            <img
              src={WALK_FRAMES[frame]}
              alt=""
              className="home-mascot-sprite"
              draggable={false}
            />
            <div className="home-mascot-shadow" />
            <div className="home-mascot-particles" aria-hidden="true" />
          </div>
        )}
      </section>

      {/* 左下角的小人 + 用户问题气泡 + （正在附加的）图片缩略图。
       *  flex column 自下而上：mascot → 气泡 → 待发送的图片预览。
       *  这样新粘的图永远在气泡顶上，不再跟气泡重叠。 */}
      {(stageInAnswerMode || composer.attachments.length > 0) && mascot.current !== "ironman" && (
        <aside
          className={`home-corner-mascot home-corner-mascot--${mascot.current}`}
          aria-label="你的问题"
        >
          {/* 待发送图：堆在气泡之上 —— 用户能看到自己刚附加的图 */}
          {composer.attachments.length > 0 && (
            <div className="home-corner-pending" aria-label="待发送的图片">
              {composer.attachments.map(a => (
                <div
                  key={a.clientId}
                  className={`home-corner-pending__thumb home-corner-pending__thumb--${a.state}`}
                  title={a.state === "failed" ? a.error : "点击查看原图"}
                >
                  <img src={a.previewUrl} alt="" draggable={false} className="is-zoomable" />
                  {a.state === "uploading" && <span className="home-corner-pending__spinner" aria-hidden="true">⌛</span>}
                  {a.state === "failed" && <span className="home-corner-pending__err" aria-hidden="true">!</span>}
                  <button
                    type="button"
                    className="home-corner-pending__remove"
                    onClick={(e) => { e.stopPropagation(); composer.detach(a.clientId); }}
                    aria-label="删除这张图"
                    title="删除"
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {/* 上一条问题的气泡 */}
          {stageInAnswerMode && latestQA?.question && (latestQA.question.content || (latestQA.question.attachments?.length ?? 0) > 0) && (
            <div className="home-corner-bubble" role="note">
              {(latestQA.question.attachments?.length ?? 0) > 0 && (
                <div className="home-corner-bubble__images">
                  {latestQA.question.attachments!.map(att => (
                    <img
                      key={att.id}
                      src={attachmentDataUrl(att)}
                      alt=""
                      draggable={false}
                      className="home-corner-bubble__image is-zoomable"
                      title="点击查看原图"
                    />
                  ))}
                </div>
              )}
              {latestQA.question.content && latestQA.question.content !== "（图片）" && (
                <>
                  <span className="home-corner-bubble__name">大斌哥：</span>
                  <span className="home-corner-bubble__text">{latestQA.question.content}</span>
                </>
              )}
            </div>
          )}
          {/* mascot —— 仅在答案模式下显示，避免和首页大 mascot 重复 */}
          {stageInAnswerMode && (
            <span
              className="home-corner-mascot__sprite"
              role="button"
              tabIndex={0}
              title="双击回到首页"
              aria-label="双击回到首页"
              onDoubleClick={returnToHomeStage}
              onKeyDown={e => {
                if (e.key === "Escape") returnToHomeStage();
              }}
            >
              <img src={WALK_FRAMES[frame]} alt="" draggable={false} />
            </span>
          )}
        </aside>
      )}

      {/* Middle — input bar with attachment support (drop / paste / 📎). */}
      <form
        className="home-input"
        onSubmit={onSubmit}
        onDragOver={e => {
          // 必须 preventDefault 才能让 drop 触发
          if (e.dataTransfer?.types?.includes("Files")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={e => {
          const files = Array.from(e.dataTransfer?.files ?? []);
          const images = files.filter(f => f.type.startsWith("image/"));
          if (images.length === 0) return;
          e.preventDefault();
          for (const f of images) {
            void composer.attach(f).catch(err => console.warn("[home-input] attach:", err));
          }
        }}
      >
        {agentSession?.status === "active" && !slashCommand.open && (
          <div className="agent-session-marker" role="status">
            <span>Hermes Agent</span>
            <small>{agentSession.modelSessionId ? "上下文已连接" : "等待第一轮消息"}</small>
            <button type="button" onClick={() => void chooseChatCommand({ id: "chat", token: "/chat", label: "普通对话", hint: "" })}>退出</button>
          </div>
        )}
        {slashCommand.open && (
          <ChatSlashCommandMenu commands={slashCommand.matches} activeIndex={slashIndex} onChoose={command => void chooseChatCommand(command)} />
        )}
        <div ref={measureRef} className="home-input-measure" aria-hidden="true">
          {input.slice(0, caretPos)}
          <span ref={caretMarkerRef} className="home-input-measure-marker">{"​"}</span>
          {/* Trailing zero-width fallback so a caret right after a final "\n"
              still gets a layout box on the new line (otherwise the trailing
              newline collapses and offsetTop reports the wrong row). */}
          {input.slice(caretPos) || "​"}
        </div>
        <span
          className="home-input-pet"
          aria-hidden="true"
          style={{ transform: `translate(${petX}px, ${petY}px)` }}
        />

        {/* 缩略图已移到左下角 .home-corner-pending（堆在气泡上方），不再在 input 内 */}

        <textarea
          ref={textareaRef}
          value={input}
          onBeforeInput={e => {
            const native = e.nativeEvent as InputEvent;
            if (native.inputType === "insertFromDictation") {
              lastDictationInputAtRef.current = Date.now();
            }
          }}
          onInput={e => {
            const native = e.nativeEvent as InputEvent;
            syncHomeInput(e.currentTarget, native.inputType);
          }}
          onChange={e => {
            syncHomeInput(e.target);
          }}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={e => {
            composingRef.current = false;
            syncHomeInput(e.currentTarget);
          }}
          // Native event — fires on click, arrow keys, drag-select, Home/End,
          // Cmd+A, etc. Whenever the caret moves, we re-measure.
          onSelect={e => setCaretPos((e.currentTarget as HTMLTextAreaElement).selectionStart ?? 0)}
          onPaste={e => {
            // 截图粘贴：从 clipboard items 里抓 image
            const items = Array.from(e.clipboardData?.items ?? []);
            const imgItem = items.find(it => it.type.startsWith("image/"));
            if (!imgItem) return;
            const file = imgItem.getAsFile();
            if (!file) return;
            e.preventDefault();
            void composer.attach(file).catch(err => console.warn("[home-input] paste:", err));
          }}
          onKeyDown={e => {
            if (slashCommand.open && slashCommand.matches.length > 0) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const delta = e.key === "ArrowDown" ? 1 : -1;
                setSlashIndex(index => (index + delta + slashCommand.matches.length) % slashCommand.matches.length);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setInput("");
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                void chooseChatCommand(slashCommand.matches[slashIndex] ?? slashCommand.matches[0]);
                return;
              }
            }
            if (e.key === "Enter" && input.trim() === "/agent new") {
              e.preventDefault();
              void api.newAgentSession(DEFAULT_CHAT_CONVERSATION_ID).then(session => {
                setAgentSession(session);
                setInput("");
              });
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              const justDictated = Date.now() - lastDictationInputAtRef.current < 1200;
              if (e.nativeEvent.isComposing || composingRef.current || justDictated) return;
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder=""
          rows={1}
          autoFocus
        />

        {/* 📎 选择文件按钮（位于输入框右侧） */}
        <button
          type="button"
          className="home-input-attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={composer.isFull}
          aria-label="附加图片"
          title={composer.isFull ? "已达上限" : "附加图片"}
        >📎</button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={e => {
            const files = Array.from(e.target.files ?? []);
            for (const f of files) {
              void composer.attach(f).catch(err => console.warn("[home-input] picker:", err));
            }
            e.target.value = "";  // 允许选同一文件
          }}
        />

        <button type="submit" disabled={busy || composer.isUploading || (!input.trim() && composer.attachments.length === 0)} aria-hidden="true" tabIndex={-1} />
      </form>

      {/* 历史 panel：默认隐藏；点 📜 toggle 切到全屏 overlay 模式
       *  打开时盖住整个首页（包括 stage / input），用户能专心翻历史
       *  右下角历史按钮保留在 overlay 上方，再点一次收回。 */}
      {historyOpen && (
        <section
          ref={bottomRef}
          className="home-history is-fullscreen"
          aria-live="polite"
        >
          <ChatHistoryPanel pairs={chatPairs} />
        </section>
      )}

      {selMenu && (
        <div
          className="home-sel-menu"
          style={{ left: selMenu.x, top: selMenu.y }}
          role="menu"
          onContextMenu={e => e.preventDefault()}
        >
          {selMenu.markEl ? (
            // 模式 B：右键点在已有标记上 → 取消
            <button type="button" role="menuitem" onClick={removeMark}>
              <span className="home-sel-menu__swatch home-sel-menu__swatch--remove" /> 取消标记
            </button>
          ) : (
            // 模式 A：选中文字 → 复制 / 高亮 / 下划线
            <>
              <button type="button" role="menuitem" onClick={() => void copySelection()}>
                <span className="home-sel-menu__icon" aria-hidden="true">⎘</span> 复制
              </button>
              <button type="button" role="menuitem" onClick={() => markSelection("highlight")}>
                <span className="home-sel-menu__swatch home-sel-menu__swatch--highlight" /> 高亮
              </button>
              <button type="button" role="menuitem" onClick={() => markSelection("underline")}>
                <span className="home-sel-menu__swatch home-sel-menu__swatch--underline" /> 下划线
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ChatHistoryPanel({ pairs }: { pairs: ChatPair[] }) {
  const [activeId, setActiveId] = useState(() => pairs[0]?.id ?? "");
  const questionRefs = useRef(new Map<string, HTMLButtonElement>());
  const answerRefs = useRef(new Map<string, HTMLElement>());
  const answerPaneRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    setActiveId(current => pairs.some(pair => pair.id === current) ? current : pairs[0]?.id ?? "");
  }, [pairs]);

  useEffect(() => {
    const el = activeId ? questionRefs.current.get(activeId) : null;
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  function scrollToPair(id: string) {
    const target = answerRefs.current.get(id);
    const pane = answerPaneRef.current;
    if (!target || !pane) return;
    syncingRef.current = true;
    setActiveId(id);
    const targetTop = target.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
    pane.scrollTo({
      top: targetTop - 8,
      behavior: "smooth",
    });
    window.setTimeout(() => { syncingRef.current = false; }, 360);
  }

  function syncFromAnswerScroll() {
    if (syncingRef.current) return;
    const pane = answerPaneRef.current;
    if (!pane) return;
    const paneTop = pane.getBoundingClientRect().top;
    let nextId = pairs[0]?.id ?? "";
    for (const pair of pairs) {
      const el = answerRefs.current.get(pair.id);
      if (!el) continue;
      const top = el.getBoundingClientRect().top - paneTop;
      if (top <= 24) nextId = pair.id;
      else break;
    }
    setActiveId(nextId);
  }

  return (
    <div className="home-history-split">
      <div className="home-history-questions" aria-label="你的问题历史">
        {pairs.map(pair => (
          <button
            key={pair.id}
            ref={el => {
              if (el) questionRefs.current.set(pair.id, el);
              else questionRefs.current.delete(pair.id);
            }}
            type="button"
            className={`home-history-question${activeId === pair.id ? " is-active" : ""}`}
            onClick={() => scrollToPair(pair.id)}
          >
            <span className="home-history-question__meta">
              <em>#{String(pair.index).padStart(2, "0")}</em>
              {formatHistoryTime(pair.question) && <time>{formatHistoryTime(pair.question)}</time>}
            </span>
            <span className="home-history-question__body">
              {pair.question.content && pair.question.content !== "（图片）" && (
                <span className="home-history-question__text">{pair.question.content}</span>
              )}
              {(pair.question.attachments?.length ?? 0) > 0 && (
                <span className="home-history-question__thumbs">
                  {pair.question.attachments!.map(att => (
                    <img
                      key={att.id}
                      src={attachmentDataUrl(att)}
                      alt=""
                      draggable={false}
                      className="home-history-question__thumb is-zoomable"
                      title="点击查看原图"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.dispatchEvent(new CustomEvent("ke-lightbox-open", { detail: { src: attachmentDataUrl(att) } }));
                      }}
                      onError={(e) => {
                        // 后端没数据 / url 失效 时给个占位，不要显示破图
                        const img = e.currentTarget;
                        img.style.background = "rgba(247, 130, 130, .15)";
                        img.style.border = "1px dashed rgba(247, 130, 130, .55)";
                        img.removeAttribute("src");
                        img.title = "图片无法加载（可能已被清理）";
                      }}
                    />
                  ))}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      <div
        ref={answerPaneRef}
        className="home-history-answers"
        aria-label="Rich 的回答历史"
        onScroll={syncFromAnswerScroll}
      >
        {pairs.map(pair => (
          <AnswerHistoryRow
            key={pair.id}
            pair={pair}
            active={activeId === pair.id}
            setRef={el => {
              if (el) answerRefs.current.set(pair.id, el);
              else answerRefs.current.delete(pair.id);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function AnswerHistoryRow({
  pair,
  active,
  setRef,
}: {
  pair: ChatPair;
  active: boolean;
  setRef: (el: HTMLElement | null) => void;
}) {
  const answer = pair.answer;
  return (
    <article
      ref={setRef}
      className={`home-history-answer${active ? " is-active" : ""}${answer?.pending ? " is-pending" : ""}${answer?.error ? " has-error" : ""}`}
    >
      <header className="home-history-answer__head">
        <span>Rich</span>
        <div>
          {formatHistoryTime(answer ?? pair.question) && <time>{formatHistoryTime(answer ?? pair.question)}</time>}
          {answer?.pending && <em>进行中</em>}
        </div>
      </header>
      <div className="home-history-answer__body">
        {answer?.content ? (
          <>
            <RichContent text={answer.content} />
            {answer.pending && <span className="home-cursor">▍</span>}
          </>
        ) : answer?.pending ? (
          <div className="home-turn-thinking">Rich 正在思考...</div>
        ) : (
          <div className="home-turn-thinking">等待回应...</div>
        )}
        {answer?.error && <div className="home-turn-error">{answer.error}</div>}
      </div>
    </article>
  );
}
