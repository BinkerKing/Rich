import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type PromptTemplateKind = "common" | "scene";

export interface PromptTemplate {
  key: string;
  name: string;
  kind: PromptTemplateKind;
  description: string;
  content: string;
  includes: string[];
  enabled: boolean;
  updatedAt: string;
}

export interface PromptTemplateUpdate {
  name?: string;
  description?: string;
  content?: string;
  includes?: string[];
  enabled?: boolean;
}

export const PROMPT_MIGRATION_CATALOG = [
  { key: "codex.deliverable-analysis-start", label: "交付物分析任务启动", status: "已接入", source: "deliverableCodex.ts" },
  { key: "codex.deliverable-analysis-turn", label: "交付物分析任务实时规则", status: "已接入", source: "deliverableCodex.ts" },
  { key: "chat.system", label: "首页聊天系统提示词", status: "待接入", source: "chatSystem.ts / chat.ts" },
  { key: "task.deliverable-analysis", label: "Hermes 交付物分析任务", status: "待接入", source: "HermesTaskExecutor.ts" },
  { key: "knowledge.operations", label: "知识库 AI 操作", status: "待接入", source: "ai/knowledge/operations.ts" },
  { key: "project.operations", label: "项目 AI 操作", status: "待接入", source: "ai/project/operations.ts" },
  { key: "content.operations", label: "内容生成 AI 操作", status: "待接入", source: "ai/content/operations.ts" },
] as const;

const DEFAULTS: Omit<PromptTemplate, "updatedAt">[] = [
  {
    key: "common.codex-task-guardrails", name: "Codex 任务通用约束", kind: "common",
    description: "所有 Rich → Codex 业务任务共用的定位与写入约束。", enabled: true, includes: [],
    content: "所有工具调用必须使用当前上下文提供的精确 ID，不得根据标题猜测或跨业务对象操作。只有用户明确要求沉淀或修改时才能执行写入。",
  },
  {
    key: "common.deliverable-analysis-rules", name: "交付物分析记录与文件规则", kind: "common",
    description: "交付物需求澄清、确认、同步、计划、执行选择与问题处理流程。", enabled: true, includes: [],
    content: [
      "你协助用户推进 Rich 交付物，从澄清需求到完成交付。",
      "",
      "工作流程",
      "- 先读取需求、记录和相关材料。不明确的先询问；明确后整理目标、范围、产出、约束和验收标准，请用户确认。",
      "- 需求确认后同步到交付物需求，保留无关的既有内容。核实成功后编排计划，说明步骤、依赖、产出与验收方法，请用户确认。",
      "- 计划确认后询问：自动按计划执行，还是逐步执行；是否保留过程文档。两项选定后开始。逐步执行时，每步完成后等用户确认再继续。",
      "- 各阶段确认不可相互替代，已明确的确认和选择不重复询问；修改已确认内容时，重新确认受影响部分。",
      "- 执行中缺少必要信息或遇到影响整体方向的问题，暂停询问。非阻塞问题记入记录，继续不受影响的工作，最后集中确认再修改，不提前落实未确认变更。",
      "- 完成后按验收标准核查，如实说明结果与未决事项。",
      "",
      "Rich 操作",
      "使用下方提供的项目和交付物 ID，不猜测、不操作其他业务对象。先读取现状，按已确认流程写入，检查工具结果后再报告成功。",
      "",
      "读取：",
      "- rich_deliverable_get：读取交付物需求、记录等完整信息。",
      "- rich_deliverable_files_get：查看交付物目录和文件清单。",
      "- rich_deliverable_file_read：读取交付物文件。",
      "- rich_project_files_get：查看项目目录和文件清单。",
      "- rich_project_file_read：读取项目其他材料。",
      "",
      "写入：",
      "- rich_deliverable_requirement_update：同步已确认的需求。",
      "- rich_deliverable_record_create / rich_deliverable_record_update：新增或更新记录。",
      "- rich_deliverable_file_write / rich_deliverable_file_copy：写入文本文件或复制文件，支持绝对路径。",
      "- rich_deliverable_file_meta_update：更新文件类型、版本和备注。",
      "- rich_deliverable_settings_update：调整交付物版本策略，仅在任务需要且已获授权时使用。",
      "",
      "对应阶段的确认授权需求同步、必要记录和计划内产出，无需逐次询问。具体参数遵循工具定义。",
      "记录简短，按内容使用 requirement、status、decision、issue、risk、change、material 或 information；其他操作记录才用 codex。涉及文件时用 attachmentRelativePaths 挂接。",
      "选择保留过程文档时，存入交付物目录并挂接材料记录；否则不额外生成过程文档，仍保留必要记录和最终交付。",
      "",
      "表达原则",
      "准确、简洁、有条理，结构按内容选择，不设固定标题、顺序或栏目。",
      "主动考虑图表，能帮助理解才用，不凑图、不重复解释。",
      "一次用户指令及全部反馈算一轮，中途只更新有价值的进展，不重复整套答复。",
      "任务理解、处理思路、进度、结论和建议按需交代；最终答复可独立理解，不虚构完成情况。",
    ].join("\n"),
  },
  {
    key: "codex.deliverable-analysis-start", name: "交付物分析任务启动", kind: "scene",
    description: "用户在 Codex 对话框启动交付物分析任务时发送的上下文。", enabled: true,
    includes: ["common.deliverable-analysis-rules"],
    content: [
      "当前上下文",
      "任务模式：{{modeLabel}}",
      "页面：{{page}}",
      "项目：{{project}}",
      "项目 ID：{{projectId}}",
      "交付物：{{businessTitle}}",
      "交付物 ID：{{deliverableId}}",
      "项目目录：{{projectFolder}}",
      "",
      "交付物已有资料：",
      "{{deliverableContext}}",
      "",
      "现在读取并澄清需求；暂无需求时，询问目标和预期交付。",
    ].join("\n"),
  },
  {
    key: "codex.deliverable-analysis-turn", name: "交付物分析任务实时规则", kind: "scene",
    description: "任务规则调整后，下一条用户消息前仅发送最新规则；不重复发送交付物上下文。", enabled: true,
    includes: ["common.deliverable-analysis-rules"],
    content: [
      "# 当前交付物任务", "- 项目 ID：{{projectId}}", "- 交付物 ID：{{deliverableId}}", "", "## 当前交付物资料", "{{deliverableContext}}", "", "## 用户本次指令", "{{userMessage}}",
    ].join("\n"),
  },
];

function cleanIncludes(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/.test(item)))].slice(0, 20) : [];
}

function isTemplate(value: unknown): value is PromptTemplate {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.key === "string" && typeof item.name === "string" && (item.kind === "common" || item.kind === "scene") && typeof item.description === "string" && typeof item.content === "string" && typeof item.enabled === "boolean" && typeof item.updatedAt === "string";
}

export class PromptLibraryService {
  constructor(private readonly filePath: string) {}

  async list(): Promise<PromptTemplate[]> { return (await this.load()).sort((left, right) => left.key.localeCompare(right.key)); }

  async get(key: string): Promise<PromptTemplate | null> { return (await this.load()).find(item => item.key === key) ?? null; }

  async revision(key: string): Promise<string> {
    const items = await this.load();
    const template = items.find(item => item.key === key && item.kind === "scene" && item.enabled);
    if (!template) throw new Error(`Prompt scene "${key}" is unavailable.`);
    const collect = (item: PromptTemplate, ancestors = new Set<string>()): string[] => {
      if (ancestors.has(item.key)) throw new Error(`Prompt template include cycle at "${item.key}".`);
      const nextAncestors = new Set(ancestors).add(item.key);
      return [
        ...item.includes.flatMap(include => {
          const target = items.find(candidate => candidate.key === include && candidate.enabled);
          return target ? collect(target, nextAncestors) : [];
        }),
        JSON.stringify({ key: item.key, content: item.content, includes: item.includes, enabled: item.enabled }),
      ];
    };
    return createHash("sha256").update(collect(template).join("\n")).digest("hex");
  }

  async update(key: string, patch: PromptTemplateUpdate): Promise<PromptTemplate | null> {
    const items = await this.load();
    const index = items.findIndex(item => item.key === key);
    if (index < 0) return null;
    const current = items[index];
    const next: PromptTemplate = {
      ...current,
      ...(typeof patch.name === "string" ? { name: patch.name.trim().slice(0, 120) || current.name } : {}),
      ...(typeof patch.description === "string" ? { description: patch.description.trim().slice(0, 500) } : {}),
      ...(typeof patch.content === "string" ? { content: patch.content.slice(0, 100_000) } : {}),
      ...(patch.includes !== undefined ? { includes: cleanIncludes(patch.includes) } : {}),
      ...(typeof patch.enabled === "boolean" ? { enabled: patch.enabled } : {}),
      updatedAt: new Date().toISOString(),
    };
    items[index] = next;
    await this.save(items);
    return next;
  }

  async render(key: string, variables: Record<string, string>): Promise<{ content: string; template: PromptTemplate; included: PromptTemplate[] }> {
    const items = await this.load();
    const template = items.find(item => item.key === key && item.kind === "scene" && item.enabled);
    if (!template) throw new Error(`Prompt scene "${key}" is unavailable.`);
    const included: PromptTemplate[] = [];
    const visit = (item: PromptTemplate, seen: Set<string>): string[] => {
      if (seen.has(item.key)) throw new Error(`Prompt template include cycle at "${item.key}".`);
      const nextSeen = new Set(seen).add(item.key);
      const content: string[] = [];
      for (const include of item.includes) {
        const target = items.find(candidate => candidate.key === include && candidate.enabled);
        if (!target) continue;
        included.push(target);
        content.push(...visit(target, nextSeen));
      }
      content.push(item.content);
      return content;
    };
    const source = visit(template, new Set()).filter(Boolean).join("\n\n---\n\n");
    const content = source.replace(/{{([a-zA-Z][a-zA-Z0-9_.-]*)}}/g, (_match, name: string) => variables[name] ?? `{{${name}}}`);
    return { content, template, included };
  }

  private async load(): Promise<PromptTemplate[]> {
    try {
      const raw = JSON.parse(await readFile(this.filePath, "utf8")) as unknown;
      if (Array.isArray(raw) && raw.every(isTemplate)) return raw.map(item => ({ ...item, includes: cleanIncludes(item.includes) }));
    } catch { /* first start or invalid local file: recreate safe defaults */ }
    const now = new Date().toISOString();
    const defaults = DEFAULTS.map(item => ({ ...item, includes: [...item.includes], updatedAt: now }));
    await this.save(defaults);
    return defaults;
  }

  private async save(items: PromptTemplate[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, JSON.stringify(items, null, 2), "utf8");
    await rename(temporary, this.filePath);
  }
}
