import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Element } from "@ke/domain";
import { api } from "../api/client.js";
import { useStore } from "../state/store.js";
import "./GuidedPracticeWizard.css";

type StageKey = "goal" | "scenario" | "technical" | "scope" | "prd" | "plan";
type MsgRole = "user" | "assistant";

interface WizardMessage {
  id: string;
  role: MsgRole;
  stage: StageKey;
  text: string;
}

interface DraftState {
  title: string;
  idea: string;
  goal: string;
  users: string;
  scenarios: string;
  technical: string;
  features: string;
  risks: string;
  outOfScope: string;
  tasks: string;
}

interface GuidedPracticeResult {
  reply: string;
  draftPatch: Partial<DraftState>;
  nextStage: StageKey;
  confidence: "low" | "medium" | "high";
  openQuestions: string[];
}

interface Props {
  onClose: () => void;
  onCreated: (id: string) => void;
}

const STAGES: Array<{ key: StageKey; label: string; prompt: string; hint: string }> = [
  {
    key: "goal",
    label: "项目目标",
    prompt: "先说清楚这个项目为什么值得做。目标用户是谁？你希望它改变什么结果？",
    hint: "目标、用户、成功结果",
  },
  {
    key: "scenario",
    label: "业务场景",
    prompt: "接下来把真实使用场景说细一点：谁在什么时刻遇到什么问题，会怎么使用它？",
    hint: "触发时机、用户动作、成功标准",
  },
  {
    key: "technical",
    label: "技术分析",
    prompt: "现在看技术面。它需要哪些数据、接口、AI 能力、页面或后台能力？最大的风险在哪里？",
    hint: "数据、接口、依赖、风险",
  },
  {
    key: "scope",
    label: "MVP 范围",
    prompt: "我们收敛第一版。哪些必须做？哪些先不做？哪些可以之后再进入 v1.1？",
    hint: "必须做、暂不做、验收边界",
  },
  {
    key: "prd",
    label: "PRD 草案",
    prompt: "我已经可以整理 PRD v1.0 了。你还想补充哪些产品原则、验收标准或边界？",
    hint: "PRD 口径确认",
  },
  {
    key: "plan",
    label: "执行计划",
    prompt: "最后把计划拆出来。第一版你希望按哪些里程碑推进？有没有优先级或顺序要求？",
    hint: "里程碑、任务、优先级",
  },
];

const initialDraft: DraftState = {
  title: "",
  idea: "",
  goal: "",
  users: "",
  scenarios: "",
  technical: "",
  features: "",
  risks: "",
  outOfScope: "",
  tasks: "",
};

function id(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function nonEmptyLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map(s => s.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);
}

function flattenUnknown(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(flattenUnknown);
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const preferred = [
      "summary", "goal", "objective", "problem", "coreValue", "initialProductConcept",
      "testingObjective", "testObject", "testScope", "testMethod", "successCriteria",
      "title", "desc", "description", "body", "value", "raw",
      "included", "notYetDecided", "outOfScope", "excluded",
    ];
    const lines: string[] = [];
    for (const key of preferred) {
      if (key in source) lines.push(...flattenUnknown(source[key]));
    }
    for (const [key, raw] of Object.entries(source)) {
      if (preferred.includes(key)) continue;
      const sub = flattenUnknown(raw);
      if (sub.length > 0) lines.push(`${key}：${sub.join("\n")}`);
    }
    return lines;
  }
  return [String(value)];
}

function flattenMaybeJsonText(text: string): string {
  const all = text.trim();
  if (/^[{[]/.test(all)) {
    try {
      return flattenUnknown(JSON.parse(all)).join("\n");
    } catch {
      // Fall through to line-level cleanup below.
    }
  }
  return nonEmptyLines(text)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!/^[{[]/.test(trimmed)) return [trimmed];
      try {
        return flattenUnknown(JSON.parse(trimmed));
      } catch {
        return [trimmed];
      }
    })
    .join("\n");
}

function stripListPrefix(text: string): string {
  return text
    .trim()
    .replace(/^任务\s*\d+\s*[:：\-—]\s*/i, "")
    .replace(/^(?:S\d+\s*[—-]\s*)?\d+[.)、．]\s*/, "")
    .replace(/^[-*]\s*/, "")
    .trim();
}

function normalKey(text: string): string {
  return stripListPrefix(text)
    .replace(/[，。,.；;：:\s"'“”‘’（）()【】[\]-]/g, "")
    .slice(0, 72);
}

function uniqueLines(text: string, limit?: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of nonEmptyLines(flattenMaybeJsonText(text))) {
    const item = stripListPrefix(raw);
    const key = normalKey(item);
    if (!item || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (limit && out.length >= limit) break;
  }
  return out;
}

function firstSentence(text: string): string {
  const cleaned = stripListPrefix(text);
  const s = cleaned.split(/[。!?\n]/)[0]?.trim() ?? "";
  return s.length > 42 ? `${s.slice(0, 42)}…` : s;
}

function appendText(current: string, next: string): string {
  const merged = uniqueLines(`${current}\n${next}`);
  return merged.join("\n");
}

function normalizeDraft(draft: DraftState): DraftState {
  return {
    title: firstSentence(flattenMaybeJsonText(draft.title || draft.idea || "新的实战项目")),
    idea: uniqueLines(draft.idea, 1).join("\n"),
    goal: uniqueLines(draft.goal, 4).join("\n"),
    users: uniqueLines(draft.users, 6).join("\n"),
    scenarios: uniqueLines(draft.scenarios, 8).join("\n"),
    technical: uniqueLines(draft.technical, 8).join("\n"),
    features: uniqueLines(draft.features, 10).join("\n"),
    risks: uniqueLines(draft.risks, 8).join("\n"),
    outOfScope: uniqueLines(draft.outOfScope, 8).join("\n"),
    tasks: uniqueLines(draft.tasks, 10).join("\n"),
  };
}

function section(id: string, title: string, blocks: unknown[]) {
  return { id, title, blocks };
}

function lead(text: string) {
  return { style: "lead", text };
}

function prose(text: string) {
  return { style: "prose", text };
}

function dots(items: string[]) {
  return { style: "dot-list", items };
}

function checks(items: string[], columns = 1) {
  return { style: "check-list", items, columns };
}

function kv(rows: Array<{ key: string; value: string }>) {
  return { style: "kv-table", rows };
}

function content(sections: unknown[]) {
  return { updatedAt: new Date().toISOString().slice(0, 10), sections };
}

function mergeDraftPatch(current: DraftState, patch: Partial<DraftState>): DraftState {
  const next = { ...current };
  for (const key of Object.keys(patch) as Array<keyof DraftState>) {
    const value = patch[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (key === "title" || key === "idea" || key === "users") {
      next[key] = trimmed;
    } else {
      next[key] = appendText(next[key], trimmed);
    }
  }
  return next;
}

async function groupByTitle(practiceId: string, title: string): Promise<Element | null> {
  const [els, rels] = await Promise.all([api.listElements(), api.listRelations({ from: practiceId })]);
  const byId = new Map(els.map(e => [e.id, e]));
  for (const rel of rels) {
    const child = byId.get(rel.to);
    if (child?.type === "group" && child.title === title) return child;
  }
  return null;
}

async function ensureGroup(practiceId: string, title: string): Promise<Element> {
  const found = await groupByTitle(practiceId, title);
  if (found) return found;
  return api.createPracticeGroup({ practiceId, title });
}

export function GuidedPracticeWizard({ onClose, onCreated }: Props): ReactNode {
  const hydrate = useStore(s => s.hydrate);
  const saved = useMemo(() => {
    try {
      const raw = window.localStorage.getItem("rich.guidedPracticeWizard.v1");
      return raw ? JSON.parse(raw) as { stage?: StageKey; draft?: DraftState; messages?: WizardMessage[] } : null;
    } catch {
      return null;
    }
  }, []);
  const [stage, setStage] = useState<StageKey>(saved?.stage ?? "goal");
  const [draft, setDraft] = useState<DraftState>(saved?.draft ? normalizeDraft(saved.draft) : initialDraft);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<WizardMessage[]>(saved?.messages ?? [
    { id: id("m"), role: "assistant", stage: "goal", text: STAGES[0].prompt },
  ]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    window.localStorage.setItem("rich.guidedPracticeWizard.v1", JSON.stringify({ stage, draft, messages }));
  }, [draft, messages, stage]);

  const currentIndex = STAGES.findIndex(s => s.key === stage);
  const cleanDraft = useMemo(() => normalizeDraft(draft), [draft]);
  const canGenerate = cleanDraft.goal.trim().length > 0 && cleanDraft.scenarios.trim().length > 0 && cleanDraft.features.trim().length > 0;
  const taskLines = useMemo(() => {
    const fromUser = uniqueLines(cleanDraft.tasks, 10);
    if (fromUser.length > 0) return fromUser;
    const featureLines = uniqueLines(cleanDraft.features, 5);
    return [
      "梳理 PRD v1.0 的产品目标、场景和验收标准",
      ...featureLines.map(f => `实现：${f}`),
      "补充版本绑定、任务状态和后续变更规则",
    ].slice(0, 8);
  }, [cleanDraft.features, cleanDraft.tasks]);

  const send = async (): Promise<void> => {
    const text = input.trim();
    if (!text || thinking) return;
    const userMessage: WizardMessage = { id: id("m"), role: "user", stage, text };
    setInput("");
    setThinking(true);
    setError("");
    setMessages(prev => [...prev, userMessage]);
    try {
      const res = await fetch("/api/ai/guided-practice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stage,
          userInput: text,
          draft: cleanDraft,
          messages: [...messages, userMessage].map(m => ({ role: m.role, stage: m.stage, text: m.text })),
          model: "hermes",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Hermes HTTP ${res.status}`);
      }
      const body = await res.json() as { adapter: string; result: GuidedPracticeResult };
      const result = body.result;
      setDraft(prev => normalizeDraft(mergeDraftPatch(prev, result.draftPatch)));
      setStage(result.nextStage);
      setMessages(prev => [
        ...prev,
        {
          id: id("m"),
          role: "assistant",
          stage: result.nextStage,
          text: `${result.reply}${result.openQuestions.length > 0 ? `\n\n待确认：\n${result.openQuestions.map(q => `- ${q}`).join("\n")}` : ""}`,
        },
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setMessages(prev => [
        ...prev,
        {
          id: id("m"),
          role: "assistant",
          stage,
          text: `Hermes 这轮分析失败了：${message}。我不会用本地假整理替代它；请稍后重试。`,
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const createProject = async (): Promise<void> => {
    if (!canGenerate || saving) return;
    setSaving(true);
    setError("");
    try {
      const finalDraft = cleanDraft;
      const title = finalDraft.title || firstSentence(finalDraft.idea) || "新的实战项目";
      const finalTaskLines = taskLines;
      const practice = await api.createPracticeElement({
        title,
        subtitle: "由引导式立项生成：PRD v1.0 与执行计划 v1.0 已绑定。",
      });
      await api.patchElement(practice.id, {
        tags: ["实战项目", "引导式立项"],
        content: content([
          section("source", "立项来源", [
            lead(finalDraft.idea || finalDraft.goal),
            checks(["由对话式需求明确化流程生成。", "PRD v1.0 与执行计划 v1.0 一一绑定。", "新增需求需进入 PRD v1.1/v2.0。"], 2),
          ]),
        ]),
      });

      const knowledgeGroup = await ensureGroup(practice.id, "知识点");
      const scenarioGroup = await ensureGroup(practice.id, "场景分析");
      const featureGroup = await ensureGroup(practice.id, "功能说明");
      const prdGroup = await ensureGroup(practice.id, "PRD");
      const planGroup = await ensureGroup(practice.id, "计划版本");
      const taskGroup = await ensureGroup(practice.id, "开发任务");
      const conversationGroup = await ensureGroup(practice.id, "立项对话");

      await api.createPracticeChild({
        parentId: knowledgeGroup.id,
        type: "knowledge",
        title: "PRD 与计划版本绑定规则",
        subtitle: "一个需求版本只对应一个执行计划版本。",
        content: content([
          section("rule", "规则", [
            checks(["PRD 是需求基线。", "计划是执行基线。", "新增需求先生成新 PRD，再生成新计划。", "旧计划不接受范围膨胀。"], 2),
          ]),
        ]),
      });

      for (const item of uniqueLines(finalDraft.scenarios, 6)) {
        await api.createPracticeChild({
          parentId: scenarioGroup.id,
          type: "requirement",
          title: firstSentence(item),
          subtitle: item,
          content: content([section("scene", "业务场景", [lead(item)])]),
        });
      }

      for (const item of uniqueLines(finalDraft.features, 8)) {
        await api.createPracticeChild({
          parentId: featureGroup.id,
          type: "feature",
          title: firstSentence(item),
          subtitle: item,
          content: content([section("feature", "功能说明", [lead(item)])]),
        });
      }

      const prd = await api.createPracticeChild({
        parentId: prdGroup.id,
        type: "prd",
        title: `PRD v1.0 — ${title}`,
        subtitle: "由引导式需求明确化流程生成的第一版需求基线。",
        content: content([
          section("goal", "产品目标", [lead(finalDraft.goal)]),
          section("users", "目标用户", [prose(finalDraft.users || "待进一步确认。")]),
          section("scenarios", "业务场景", [dots(uniqueLines(finalDraft.scenarios))]),
          section("technical", "技术分析", [prose(finalDraft.technical || "待技术评审补充。")]),
          section("scope", "MVP 范围", [checks(uniqueLines(finalDraft.features))]),
          section("out", "暂不做", [dots(uniqueLines(finalDraft.outOfScope || "进入后续 PRD 版本。"))]),
          section("risks", "风险与待确认", [dots(uniqueLines(finalDraft.risks || "暂无明确风险。"))]),
          section("acceptance", "验收标准", [checks(["能按 PRD v1.0 创建执行计划 v1.0。", "任务必须绑定 PRD/计划版本。", "新增需求不污染当前计划。"])]),
        ]),
      });

      const plan = await api.createElement({
        parentId: planGroup.id,
        type: "guide",
        title: `执行计划 v1.0 — ${title}`,
        subtitle: "绑定 PRD v1.0；由引导式立项生成。",
        content: content([
          section("binding", "版本绑定", [
            kv([
              { key: "绑定 PRD", value: `${prd.title} (${prd.id})` },
              { key: "计划版本", value: "v1.0" },
              { key: "状态口径", value: "创建后任务默认 todo；只有真正开工才切 doing。" },
            ]),
          ]),
          section("tasks", "任务草案", [dots(finalTaskLines)]),
        ]),
      });

      await api.createElement({
        parentId: conversationGroup.id,
        type: "guide",
        title: "立项对话记录 v1.0",
        subtitle: "完整保留用户与 Hermes 的需求明确化对话。",
        content: content([
          section("transcript", "完整对话", [
            prose(messages
              .map(m => `${m.role === "assistant" ? "Hermes" : "大斌哥"} / ${STAGES.find(s => s.key === m.stage)?.label ?? m.stage}：\n${m.text}`)
              .join("\n\n")),
          ]),
          section("structured", "最终结构化结果", [
            kv([
              { key: "项目目标", value: finalDraft.goal || "未填写" },
              { key: "业务场景", value: finalDraft.scenarios || "未填写" },
              { key: "技术分析", value: finalDraft.technical || "未填写" },
              { key: "MVP 功能", value: finalDraft.features || "未填写" },
            ]),
          ]),
        ]),
      });

      for (const [idx, task] of finalTaskLines.entries()) {
        const created = await api.createPracticeChild({
          parentId: taskGroup.id,
          type: "dev-task",
          title: `S${String(idx + 1).padStart(2, "0")} — ${firstSentence(task)}`,
          subtitle: task,
          content: content([
            section("state", "当前状态", [lead("待排期：该任务由引导式立项生成，目前没有人在 Doing。")]),
          ]),
        });
        await api.patchElement(created.id, {
          content: {
            ...(created.content && typeof created.content === "object" ? created.content : {}),
            prdVersion: { id: prd.id, version: "v1.0", title: prd.title },
            planVersion: { id: plan.element.id, version: "v1.0", title: plan.element.title },
          },
        });
      }

      await hydrate();
      window.localStorage.removeItem("rich.guidedPracticeWizard.v1");
      onCreated(practice.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div className="gpw" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="gpw__panel" onClick={e => e.stopPropagation()}>
        <header className="gpw__head">
          <div>
            <div className="gpw__eyebrow">引导式立项</div>
            <h2>从一个想法到 PRD v1.0</h2>
          </div>
          <button type="button" className="gpw__close" onClick={onClose}>×</button>
        </header>

        <div className="gpw__stages">
          {STAGES.map((s, i) => (
            <button key={s.key} type="button" className={`gpw-stage${s.key === stage ? " is-active" : ""}${i < currentIndex ? " is-done" : ""}`} onClick={() => setStage(s.key)}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <strong>{s.label}</strong>
              <em>{s.hint}</em>
            </button>
          ))}
        </div>

        <main className="gpw__main">
          <section className="gpw-chat">
            <div className="gpw-chat__log" ref={scrollRef}>
              {messages.map(m => (
                <article key={m.id} className={`gpw-msg gpw-msg--${m.role}`}>
                  <span>{m.role === "assistant" ? "Hermes" : "你"}</span>
                  <p>{m.text}</p>
                </article>
              ))}
            </div>
            <div className="gpw-chat__input">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                rows={4}
                placeholder={STAGES[currentIndex]?.prompt}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button type="button" onClick={() => void send()} disabled={!input.trim() || thinking}>
                {thinking ? "Hermes 分析中" : "发给 Hermes"}
              </button>
            </div>
          </section>

          <aside className="gpw-brief">
            <label>
              <span>项目标题</span>
              <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="自动从想法中生成，也可以手改" />
            </label>
            <label>
              <span>项目目标</span>
              <textarea value={draft.goal} onChange={e => setDraft({ ...draft, goal: e.target.value })} />
            </label>
            <label>
              <span>业务场景</span>
              <textarea value={draft.scenarios} onChange={e => setDraft({ ...draft, scenarios: e.target.value })} />
            </label>
            <label>
              <span>技术分析</span>
              <textarea value={draft.technical} onChange={e => setDraft({ ...draft, technical: e.target.value })} />
            </label>
            <label>
              <span>MVP 功能</span>
              <textarea value={draft.features} onChange={e => setDraft({ ...draft, features: e.target.value })} />
            </label>
            <label>
              <span>风险</span>
              <textarea value={draft.risks} onChange={e => setDraft({ ...draft, risks: e.target.value })} />
            </label>
            <label>
              <span>暂不做</span>
              <textarea value={draft.outOfScope} onChange={e => setDraft({ ...draft, outOfScope: e.target.value })} />
            </label>
            <label>
              <span>计划任务草案</span>
              <textarea value={draft.tasks} onChange={e => setDraft({ ...draft, tasks: e.target.value })} />
            </label>
          </aside>
        </main>

        <footer className="gpw__foot">
          {error && <span className="gpw__error">{error}</span>}
          <span className="gpw__hint">至少补齐项目目标、业务场景、MVP 功能后生成。</span>
          <button type="button" onClick={onClose}>取消</button>
          <button type="button" className="is-primary" disabled={!canGenerate || saving} onClick={() => void createProject()}>
            {saving ? "生成中…" : "生成 PRD v1.0 + 计划 v1.0"}
          </button>
        </footer>
      </div>
    </div>
  );
}
