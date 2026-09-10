import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, type ProjectModuleItem } from "../../../api/client.js";
import {
  buildGanttRows,
  type DeliveryItemKind,
  type DeliveryItemStatus,
} from "../delivery/DeliveryPlanModel.js";
import { ProjectRichTextEditor } from "../ProjectManagementModules.js";
import {
  addDeliverableRecord,
  addDeliverableVersion,
  consumeDeliverableFocus, consumeDeliverableItemFocus, DELIVERABLE_DATA_CHANGED_EVENT, DELIVERABLE_ITEM_FOCUS_EVENT,
  deliverableFolderPath,
  linkedDeliverableContent,
  normalizeDeliverableContent,
  orderDeliverableRecords,
  updateDeliverableFileMeta,
  type DeliverableFileType,
  type DeliverableRecord,
  type DeliverableRecordKind,
} from "./DeliverablesModel.js";
import {
  setDeliverableCodexTarget,
  showDeliverableCodex,
} from "./DeliverableCodexLauncher.js";

type Item = ProjectModuleItem & {
  content: ReturnType<typeof normalizeDeliverableContent>;
  standalone?: boolean;
};
type DeliverableFile = {
  fileName: string;
  relativePath: string;
  size: number;
  modifiedAt: string;
  isDirectory: boolean;
};
const fileSize = (size: number) =>
  size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : size >= 1024
      ? `${(size / 1024).toFixed(1)} KB`
      : `${size} B`;
const fileDate = (value: string) =>
  new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
const recordKindLabel = (kind: DeliverableRecordKind) =>
  kind === "requirement" ? "要求" : kind === "status" ? "进展" : kind === "decision" ? "决策" : kind === "issue" ? "问题" : kind === "risk" ? "风险" : kind === "change" ? "变更" : kind === "information" ? "信息" : kind === "material" ? "材料" : kind === "codex" ? "Codex" : kind === "ai_task_result" ? "AI 回复" : "AI 任务";
const richTextHasContent = (value: string) => value.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
const absoluteFolderPath = (projectRoot: string | undefined, folderPath: string) => projectRoot ? `${projectRoot.replace(/\/+$/, "")}/${folderPath.replace(/^\/+/, "")}` : folderPath;

export function DeliverablesWorkspace({
  projectId = "",
  projectRoot,
  deliverablesRoot,
  standalone = false,
  deliverableIds,
  onDeliverableIdsChange,
}: {
  projectId?: string;
  projectRoot?: string;
  deliverablesRoot?: string;
  standalone?: boolean;
  deliverableIds?: string[];
  onDeliverableIdsChange?: (ids: string[]) => Promise<void>;
}): ReactNode {
  const [items, setItems] = useState<Item[]>([]);
  const [openId, setOpenId] = useState<string>();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<DeliverableRecordKind>("requirement");
  const [aiExecutor, setAiExecutor] = useState<"hermes" | "multica">("hermes");
  const [recordFiles, setRecordFiles] = useState<File[]>([]);
  const [editingRecordId, setEditingRecordId] = useState<string>();
  const [editingRecordText, setEditingRecordText] = useState("");
  const [editingRecordKind, setEditingRecordKind] =
    useState<DeliverableRecordKind>("requirement");
  const [editingRecordFiles, setEditingRecordFiles] = useState<File[]>([]);
  const [filesByFolder, setFilesByFolder] = useState<
    Record<string, DeliverableFile[]>
  >({});
  const [loadingFolders, setLoadingFolders] = useState<Record<string, boolean>>(
    {},
  );
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [editingFileNotePath, setEditingFileNotePath] = useState<string>();
  const [editingFileNote, setEditingFileNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newFolderPath, setNewFolderPath] = useState("");
  const [binding, setBinding] = useState(false);
  const [availableDeliverables, setAvailableDeliverables] = useState<Array<{ id: string; title: string }>>([]);
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const materialInputRef = useRef<HTMLInputElement>(null);
  const editingMaterialInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const item = items.find((candidate) => candidate.id === openId);
    if (item) {
      setDeliverableCodexTarget({
        projectId,
        deliverableId: item.id,
        deliverableTitle: item.title,
      });
    }
  }, [items, openId, projectId]);

  const refreshFiles = async (item: Item) => {
    setLoadingFolders((all) => ({ ...all, [item.content.folderPath]: true }));
    try {
      const files = standalone || deliverableIds !== undefined
        ? await api.listStandaloneDeliverableFiles(item.id)
        : await api.listDeliverableFiles(projectId, item.content.folderPath);
      setFilesByFolder((all) => ({ ...all, [item.content.folderPath]: files }));
    } finally {
      setLoadingFolders((all) => ({
        ...all,
        [item.content.folderPath]: false,
      }));
    }
  };
  const refreshItems = async () => {
    if (standalone || deliverableIds !== undefined) {
      const global = (await api.listDeliverables()).filter(item => standalone || (deliverableIds ?? []).includes(item.id)).map(item => ({ ...item, moduleKey: "deliverables", parentId: null, subtitle: null, sortOrder: 0, content: normalizeDeliverableContent(item.content), standalone: true } as unknown as Item));
      if (standalone) { setItems(global); return; }
      const legacy = await api.listProjectManagementModuleItems(projectId, "deliverables", undefined, true);
      setItems([...global, ...legacy.map(item => ({ ...item, content: normalizeDeliverableContent(item.content) }))]);
      return;
    }
    if (!projectId) return;
    const deliverables = await api.listProjectManagementModuleItems(projectId, "deliverables", undefined, true);
    const next = deliverables.map((item) => ({ ...item, content: normalizeDeliverableContent(item.content) }));
    setItems(next);
    await Promise.all(next.map(refreshFiles));
  };
  const load = async () => {
    if (standalone || deliverableIds !== undefined) return refreshItems();
    if (!projectId) return;
    let deliverables = await api.listProjectManagementModuleItems(
      projectId,
      "deliverables",
      undefined,
      true,
    );
    const activeKeys = new Set<string>();
    const tasks = await api.listProjectManagementModuleItems(
      projectId,
      "deliveryPlan",
      undefined,
      true,
    );
    const taskCodes = new Map(
      buildGanttRows(
        tasks.map((task) => ({
          id: task.id,
          title: task.title,
          parentId: task.parentId,
          sortOrder: task.sortOrder,
          kind: task.content.kind as DeliveryItemKind,
          status: (task.content.status as DeliveryItemStatus) || "todo",
        })),
        new Date().toISOString().slice(0, 10),
      ).map((task) => [task.id, task.wbsCode]),
    );
    for (const task of tasks) {
      const activities = Array.isArray(task.content.activities)
        ? task.content.activities
        : [];
      const deliverableActivities = activities.filter(
        (raw): raw is Record<string, unknown> =>
          Boolean(raw) && typeof raw === "object" && raw.kind === "deliverable",
      );
      for (const [index, activity] of deliverableActivities.entries()) {
        if (
          typeof activity.id !== "string" ||
          typeof activity.text !== "string" ||
          typeof activity.createdAt !== "string"
        )
          continue;
        const key = `${task.id}:${activity.id}`;
        activeKeys.add(key);
        const folderPath = deliverableFolderPath(
          taskCodes.get(task.id) || String(task.sortOrder + 1),
          task.title,
          index + 1,
          activity.text,
          deliverablesRoot,
        );
        const existing = deliverables.find(
          (entry) =>
            normalizeDeliverableContent(entry.content).linkedActivityKey ===
            key,
        );
        if (existing) {
          const current = normalizeDeliverableContent(existing.content);
          if (
            existing.title !== activity.text ||
            current.folderPath !== folderPath ||
            current.status !== (activity.done === true ? "accepted" : "preparing")
          ) {
            const moved =
              current.folderPath && current.folderPath !== folderPath
                ? await api.renameDeliverableFolder(
                    projectId,
                    current.folderPath,
                    folderPath,
                  )
                : await api.createDeliverableFolder(projectId, folderPath);
            const nextFolderPath = moved.relativePath;
            const movePath = (path: string) =>
              path.startsWith(`${current.folderPath}/`)
                ? `${nextFolderPath}/${path.slice(current.folderPath.length + 1)}`
                : path;
            const content = {
              ...current,
              status: activity.done === true ? "accepted" : "preparing" as const,
              folderPath: nextFolderPath,
              versions: current.versions.map((version) => ({
                ...version,
                relativePath: movePath(version.relativePath),
              })),
              fileMeta: current.fileMeta.map((meta) => ({
                ...meta,
                relativePath: movePath(meta.relativePath),
              })),
              records: current.records.map((record) => ({
                ...record,
                attachments: record.attachments.map((file) => ({
                  ...file,
                  relativePath: movePath(file.relativePath),
                })),
              })),
            };
            const updated = await api.updateProjectManagementModuleItem(
              projectId,
              existing.id,
              { title: activity.text, content },
            );
            deliverables = deliverables.map((entry) =>
              entry.id === existing.id ? updated : entry,
            );
          }
        } else {
          const content = linkedDeliverableContent(
            task.id,
            {
              id: activity.id,
              text: activity.text,
              createdAt: activity.createdAt,
            },
            folderPath,
          );
          await api.createDeliverableFolder(projectId, folderPath);
          deliverables = [
            ...deliverables,
            await api.createProjectManagementModuleItem(
              projectId,
              "deliverables",
              { title: activity.text, content },
            ),
          ];
        }
      }
    }
    const stale = deliverables.filter((entry) => {
      const key = normalizeDeliverableContent(entry.content).linkedActivityKey;
      return key && !activeKeys.has(key);
    });
    await Promise.all(
      stale.map((entry) =>
        entry.content.folderPath
          ? api.archiveDeliverableFolder(
              projectId,
              String(entry.content.folderPath),
            )
          : undefined,
      ),
    );
    await Promise.all(
      stale.map((entry) =>
        api.deleteProjectManagementModuleItem(projectId, entry.id),
      ),
    );
    const staleIds = new Set(stale.map((entry) => entry.id));
    const next = deliverables
      .filter((entry) => !staleIds.has(entry.id))
      .map((entry) => ({
        ...entry,
        content: normalizeDeliverableContent(entry.content),
      }));
    setItems(next);
    await Promise.all(next.map(refreshFiles));
    const focusKey = consumeDeliverableFocus(projectId);
    const focused = next.find(
      (entry) => entry.content.linkedActivityKey === focusKey,
    );
    const focusedItemId = consumeDeliverableItemFocus(projectId);
    if (focusedItemId && next.some(entry => entry.id === focusedItemId)) setOpenId(focusedItemId);
    else if (focused) setOpenId(focused.id);
  };
  useEffect(() => {
    void load();
  }, [projectId, deliverablesRoot, standalone, deliverableIds]);
  useEffect(() => {
    const refreshDeliverableData = (event: Event) => {
      const target = (event as CustomEvent<{ projectId?: string; deliverableId?: string }>).detail;
      if (target?.projectId !== projectId || typeof target.deliverableId !== "string") return;
      void refreshItems();
    };
    window.addEventListener(DELIVERABLE_DATA_CHANGED_EVENT, refreshDeliverableData);
    return () => window.removeEventListener(DELIVERABLE_DATA_CHANGED_EVENT, refreshDeliverableData);
  }, [projectId, deliverablesRoot, standalone, deliverableIds]);
  useEffect(() => {
    if (openId)
      itemRefs.current[openId]?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
  }, [openId]);
  useEffect(() => {
    const openDeliverableItem = (event: Event) => {
      const target = (event as CustomEvent<{ projectId?: string; deliverableId?: string }>).detail;
      if (target?.projectId !== projectId || typeof target.deliverableId !== "string") return;
      const item = items.find(entry => entry.id === target.deliverableId);
      if (!item) return;
      setOpenId(item.id);
      void refreshFiles(item);
    };
    window.addEventListener(DELIVERABLE_ITEM_FOCUS_EVENT, openDeliverableItem);
    return () => window.removeEventListener(DELIVERABLE_ITEM_FOCUS_EVENT, openDeliverableItem);
  }, [items, projectId]);
  useEffect(() => {
    const item = items.find((current) => current.id === openId);
    if (item) void refreshFiles(item);
  }, [items, openId]);
  const save = async (item: Item, content: Item["content"]) => {
    if (standalone || deliverableIds !== undefined) {
      const updated = await api.updateDeliverable(item.id, { content });
      setItems(all => all.map(current => current.id === item.id ? ({ ...current, ...updated, content: normalizeDeliverableContent(updated.content) } as Item) : current));
      return;
    }
    if (!projectId) return;
    const updated = await api.updateProjectManagementModuleItem(
      projectId,
      item.id,
      { content },
    );
    setItems((all) =>
      all.map((current) =>
        current.id === item.id
          ? {
              ...updated,
              content: normalizeDeliverableContent(updated.content),
            }
          : current,
      ),
    );
  };
  const openFolder = async (item: Item) => {
    if (standalone || deliverableIds !== undefined) { await api.createStandaloneDeliverableFolder(item.id); await api.openStandaloneDeliverableFolder(item.id); return; }
    await api.createDeliverableFolder(projectId, item.content.folderPath);
    await api.deliverableFileAction(projectId, "open", item.content.folderPath);
  };
  const fileAction = async (item: Item, action: "open" | "reveal", path: string) => {
    if (standalone || deliverableIds !== undefined) {
      await api.standaloneDeliverableFileAction(item.id, action, path);
      return;
    }
    await api.deliverableFileAction(projectId, action, path);
  };
  const createStandalone = async () => {
    if (!newTitle.trim() || !newFolderPath.trim()) return;
    const item = await api.createDeliverable({ title: newTitle.trim(), content: normalizeDeliverableContent({ folderPath: newFolderPath.trim() }) });
    await api.createStandaloneDeliverableFolder(item.id);
    setNewTitle(""); setNewFolderPath(""); setCreating(false);
    await refreshItems(); setOpenId(item.id);
  };
  const openBinding = async () => {
    setAvailableDeliverables((await api.listDeliverables()).filter(item => !(deliverableIds ?? []).includes(item.id)).map(item => ({ id: item.id, title: item.title })));
    setBinding(true);
  };
  const bind = async (id: string) => {
    if (!onDeliverableIdsChange) return;
    await onDeliverableIdsChange([...(deliverableIds ?? []), id]);
    setBinding(false);
  };
  const unbind = async (item: Item) => {
    if (!onDeliverableIdsChange || !item.standalone || !window.confirm(`解除“${item.title}”与当前项目的关联？交付物和目录不会删除。`)) return;
    await onDeliverableIdsChange((deliverableIds ?? []).filter(id => id !== item.id));
  };
  const upload = async (item: Item, files: File[]) => {
    if (!files.length) return;
    if (standalone || deliverableIds !== undefined) {
      const uploaded = [];
      for (const file of files) uploaded.push(await api.uploadStandaloneDeliverableFile(item.id, file));
      await save(item, uploaded.reduce((content, file) => addDeliverableVersion(content, { id: crypto.randomUUID(), ...file, createdAt: new Date().toISOString() }), item.content));
      await refreshFiles(item);
      return;
    }
    await api.createDeliverableFolder(projectId, item.content.folderPath);
    const uploaded = [];
    for (const file of files)
      uploaded.push(
        await api.uploadDeliverableFile(
          projectId,
          item.content.folderPath,
          file,
        ),
      );
    await save(
      item,
      uploaded.reduce(
        (content, file) =>
          addDeliverableVersion(content, {
            id: crypto.randomUUID(),
            ...file,
            createdAt: new Date().toISOString(),
          }),
        item.content,
      ),
    );
    await refreshFiles(item);
  };
  const addRecord = async (item: Item) => {
    if (!richTextHasContent(text)) return;
    let content = item.content;
    const attachments = [];
    if (recordFiles.length) {
      await api.createDeliverableFolder(projectId, item.content.folderPath);
      for (const file of recordFiles) {
        const uploaded = await api.uploadDeliverableFile(
          projectId,
          item.content.folderPath,
          file,
        );
        attachments.push(uploaded);
        content = updateDeliverableFileMeta(content, uploaded.relativePath, {
          type: "material",
          version: "",
        });
      }
    }
    await save(
      item,
      addDeliverableRecord(content, {
        id: crypto.randomUUID(),
        kind,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        informationType: kind === "material" ? "material" : "information",
        attachments,
      }),
    );
    setText("");
    setRecordFiles([]);
    if (materialInputRef.current) materialInputRef.current.value = "";
    await refreshFiles(item);
  };
  const publishDeliverableAiTask = async (item: Item) => {
    if (!richTextHasContent(text)) return;
    const originRecordId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const parent: DeliverableRecord = {
      id: originRecordId, kind: "ai_task", text: text.trim(), createdAt, informationType: "information", attachments: [],
      aiTask: { id: "", status: "publishing", executor: aiExecutor },
    };
    await save(item, addDeliverableRecord(item.content, parent));
    const files = (filesByFolder[item.content.folderPath] || []).flatMap(file => {
      if (file.isDirectory) return [];
      const meta = item.content.fileMeta.find(entry => entry.relativePath === file.relativePath);
      return [{
        relativePath: file.relativePath, fileName: file.fileName, size: file.size,
        type: meta?.type || "material", ...(meta?.version ? { version: meta.version } : {}), ...(meta?.note ? { note: meta.note } : {}),
      }];
    });
    const task = await api.publishDeliverableAiTask({
      scenario: "deliverable_analysis", projectId, deliverableId: item.id, executor: aiExecutor, profile: "analysis",
      originRecordId, instructions: text.trim(),
      acceptanceCriteria: item.content.records.filter(record => record.kind === "requirement").map(record => record.text),
      contextSnapshot: {
        version: 1, createdAt: new Date().toISOString(),
        deliverable: { folderPath: item.content.folderPath, requirementHtml: item.content.descriptionHtml },
        records: item.content.records.map(record => ({ id: record.id, kind: record.kind, text: record.text, createdAt: record.createdAt })), files, history: [],
      },
    });
    await save(item, {
      ...addDeliverableRecord(item.content, parent),
      records: addDeliverableRecord(item.content, parent).records.map(record => record.id === originRecordId ? { ...record, aiTask: { id: task.id, status: task.status, executor: aiExecutor } } : record),
    });
    setText("");
  };
  const startRecordEdit = (record: DeliverableRecord) => {
    setEditingRecordId(record.id);
    setEditingRecordText(record.text);
    setEditingRecordKind(record.kind);
    setEditingRecordFiles([]);
  };
  const saveRecordEdit = async (item: Item, record: DeliverableRecord) => {
    if (!editingRecordText.trim()) return;
    let content = item.content;
    let attachments = record.attachments;
    if (editingRecordFiles.length) {
      await api.createDeliverableFolder(projectId, item.content.folderPath);
      attachments = [];
      for (const file of editingRecordFiles) {
        const uploaded = await api.uploadDeliverableFile(projectId, item.content.folderPath, file);
        attachments.push(uploaded);
        content = updateDeliverableFileMeta(content, uploaded.relativePath, { type: "material", version: "" });
      }
    }
    await save(item, {
      ...content,
      records: content.records.map((current) =>
        current.id === record.id
          ? {
              ...current,
              text: editingRecordText.trim(),
              kind: editingRecordKind,
              informationType: editingRecordKind === "material" ? "material" : "information",
              attachments: editingRecordKind === "material" ? attachments : [],
            }
          : current,
      ),
    });
    setEditingRecordId(undefined);
    setEditingRecordFiles([]);
    if (editingMaterialInputRef.current) editingMaterialInputRef.current.value = "";
    await refreshFiles(item);
  };
  const deleteRecord = async (item: Item, record: DeliverableRecord) => {
    if (!window.confirm("删除这条记录？")) return;
    await save(item, {
      ...item.content,
      records: item.content.records.filter(
        (current) => current.id !== record.id,
      ),
    });
  };
  const deleteFile = async (item: Item, file: DeliverableFile) => {
    if (!window.confirm(`删除 ${file.fileName}？`)) return;
    if (standalone || item.standalone) await api.deleteStandaloneDeliverableFile(item.id, file.relativePath);
    else await api.deleteDeliverableFile(projectId, file.relativePath);
    await save(item, {
      ...item.content,
      versions: item.content.versions.filter(
        (version) => version.relativePath !== file.relativePath,
      ),
      fileMeta: item.content.fileMeta.filter(
        (meta) => meta.relativePath !== file.relativePath,
      ),
    });
    await refreshFiles(item);
  };
  const updateFileMeta = (
    item: Item,
    file: DeliverableFile,
    patch: { type?: DeliverableFileType; version?: string; note?: string },
  ) =>
    void save(
      item,
      updateDeliverableFileMeta(item.content, file.relativePath, patch),
    );
  const startFileNoteEdit = (file: DeliverableFile, note: string) => {
    setEditingFileNotePath(file.relativePath);
    setEditingFileNote(note);
  };
  const saveFileNote = (item: Item, file: DeliverableFile) => {
    updateFileMeta(item, file, { note: editingFileNote.trim() });
    setEditingFileNotePath(undefined);
  };
  const cancelFileNoteEdit = () => {
    setEditingFileNotePath(undefined);
    setEditingFileNote("");
  };
  const visibleItems = openId
    ? items.filter((item) => item.id === openId)
    : items;

  return (
    <section className={`deliverables-workspace${standalone ? " deliverables-workspace--standalone" : ""}`}>
      <header>
        <div>
          <p className="deliverables-workspace__eyebrow">PROJECT OUTPUTS</p>
          <h1>交付物</h1>
          <p>{standalone ? "统一管理目录绑定的可复用交付物。" : "由项目任务自动关联的可追溯交付记录。"}</p>
        </div>
        {standalone && <button className="deliverables-workspace__primary" type="button" onClick={() => setCreating(value => !value)}>{creating ? "取消" : "新建交付物"}</button>}
        {!standalone && onDeliverableIdsChange && <button type="button" onClick={() => void openBinding()}>绑定已有交付物</button>}
      </header>
      {standalone && creating && <form className="deliverables-workspace__create" onSubmit={event => { event.preventDefault(); void createStandalone(); }}>
        <input aria-label="交付物名称" placeholder="交付物名称" value={newTitle} onChange={event => setNewTitle(event.target.value)} />
        <input aria-label="交付物目录" placeholder="绝对目录，例如 /Users/me/Deliverables/UAT" value={newFolderPath} onChange={event => setNewFolderPath(event.target.value)} />
        <button disabled={!newTitle.trim() || !newFolderPath.trim()}>创建并绑定目录</button>
      </form>}
      {binding && <div className="deliverables-workspace__binding" role="dialog" aria-label="绑定已有交付物"><header><strong>绑定已有交付物</strong><button onClick={() => setBinding(false)}>×</button></header>{availableDeliverables.length ? availableDeliverables.map(item => <button key={item.id} onClick={() => void bind(item.id)}>{item.title}</button>) : <p>没有可绑定的交付物。</p>}</div>}
      <div className="deliverables-workspace__list">
        {visibleItems.map((item) => (
          <article
            ref={(node) => {
              itemRefs.current[item.id] = node;
            }}
            key={item.id}
            className={openId === item.id ? "is-open" : ""}
          >
            <button
              className="deliverables-workspace__row"
              onClick={() => {
                const opening = openId !== item.id;
                setOpenId(opening ? item.id : undefined);
                if (opening) void refreshFiles(item);
                setEditing(false);
              }}
            >
              <b>{String(items.indexOf(item) + 1).padStart(2, "0")}</b>
              <strong>{item.title}</strong>
              <i>{({ draft: "草稿", preparing: "准备中", ready: "待交付", accepted: "已完成" } as const)[item.content.status]}</i>
              <time>
                {new Date(item.updatedAt).toLocaleDateString("zh-CN")}
              </time>
            </button>
            {openId === item.id && (
              <div className="deliverables-workspace__body">
                <div className="deliverables-workspace__toolbar">
                  <span>
                    文件位置 <code>{absoluteFolderPath(projectRoot, item.content.folderPath)}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      showDeliverableCodex({
                        projectId,
                        deliverableId: item.id,
                        deliverableTitle: item.title,
                      })
                    }
                  >
                    Codex 对话
                  </button>
                  <div
                    className="deliverables-workspace__switch"
                    role="group"
                    aria-label="版本策略"
                  >
                    <button
                      className={
                        item.content.versionPolicy === "latest"
                          ? "is-active"
                          : ""
                      }
                      onClick={() =>
                        void save(item, {
                          ...item.content,
                          versionPolicy: "latest",
                        })
                      }
                    >
                      只保留最新
                    </button>
                    <button
                      className={
                        item.content.versionPolicy === "versioned"
                          ? "is-active"
                          : ""
                      }
                      onClick={() =>
                        void save(item, {
                          ...item.content,
                          versionPolicy: "versioned",
                        })
                      }
                    >
                      版本控制
                    </button>
                  </div>
                  <button onClick={() => void openFolder(item)}>
                    打开文件夹
                  </button>
                  {!standalone && item.standalone && <button onClick={() => void unbind(item)}>解除项目绑定</button>}
                </div>
                <div className="deliverables-workspace__grid">
                  <section className="deliverables-workspace__description">
                    <header>
                      <h2>需求说明</h2>
                      <button onClick={() => setEditing(!editing)}>
                        {editing ? "取消" : "编辑"}
                      </button>
                    </header>
                    {editing ? (
                      <ProjectRichTextEditor
                        projectId={`${projectId}-${item.id}`}
                        value={item.content.descriptionHtml}
                        onChange={(html) =>
                          void save(item, {
                            ...item.content,
                            descriptionHtml: html,
                          })
                        }
                      />
                    ) : (
                      <article
                        className="workflow-rich-content"
                        dangerouslySetInnerHTML={{
                          __html:
                            item.content.descriptionHtml ||
                            "<p>暂无需求说明。</p>",
                        }}
                      />
                    )}
                  </section>
                  <div className="deliverables-workspace__right">
                    <section className="deliverables-workspace__records">
                      <h2>记录</h2>
                      <div className={`deliverables-workspace__record-composer${editingRecordId ? " is-editing-existing" : ""}`} style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                        <div className="deliverables-workspace__record-rich-editor" style={{ width: "100%" }}>
                          <ProjectRichTextEditor
                            projectId={`${projectId}-${item.id}-record-${editingRecordId || "new"}`}
                            value={editingRecordId ? editingRecordText : text}
                            onChange={editingRecordId ? setEditingRecordText : setText}
                          />
                        </div>
                        <footer style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
                          <label aria-label="记录类型">
                            <select className={`deliverables-workspace__record-kind-select is-${editingRecordId ? editingRecordKind : kind}`} value={editingRecordId ? editingRecordKind : kind} aria-label="记录类型" onChange={(event) => editingRecordId ? setEditingRecordKind(event.target.value as DeliverableRecordKind) : setKind(event.target.value as DeliverableRecordKind)}>
                              <option value="requirement">要求</option>
                              <option value="status">进展</option>
                              <option value="decision">决策</option>
                              <option value="issue">问题</option>
                              <option value="risk">风险</option>
                              <option value="change">变更</option>
                              <option value="information">信息</option>
                              <option value="material">材料</option>
                              <option value="codex">Codex</option>
                              <option value="ai_task">AI 任务</option>
                            </select>
                          </label>
                          {!editingRecordId && kind === "ai_task" && (
                            <label aria-label="AI 任务执行器">
                              <select value={aiExecutor} onChange={event => setAiExecutor(event.target.value as "hermes" | "multica")}>
                                <option value="hermes">Hermes</option>
                                <option value="multica">Multica</option>
                              </select>
                            </label>
                          )}
                          <aside>
                            <label>
                              添加附件
                              <input
                                ref={editingRecordId ? editingMaterialInputRef : materialInputRef}
                                type="file"
                                multiple
                                onChange={(event) => editingRecordId ? setEditingRecordFiles(Array.from(event.target.files || [])) : setRecordFiles(Array.from(event.target.files || []))}
                              />
                            </label>
                            <small title={(editingRecordId ? editingRecordFiles : recordFiles).map((file) => file.name).join("、")}>
                              {editingRecordId
                                ? editingRecordFiles.length
                                  ? editingRecordFiles.map((file) => file.name).join("、")
                                  : item.content.records.find((record) => record.id === editingRecordId)?.attachments.map((file) => file.fileName).join("、") || ""
                                : recordFiles.map((file) => file.name).join("、")}
                            </small>
                          </aside>
                          <button style={{ marginLeft: "auto" }} onClick={() => {
                            const record = item.content.records.find((current) => current.id === editingRecordId);
                            if (record) void saveRecordEdit(item, record);
                            else if (kind === "ai_task") void publishDeliverableAiTask(item);
                            else void addRecord(item);
                          }}>
                            {editingRecordId ? "保存" : kind === "ai_task" ? "发布 AI 任务" : "发布记录"}
                          </button>
                          {editingRecordId && <button className="deliverables-workspace__record-edit-cancel" onClick={() => setEditingRecordId(undefined)}>取消</button>}
                        </footer>
                      </div>
                      <div className="deliverables-workspace__record-list">
                      {orderDeliverableRecords(item.content.records).map((record) => {
                        const resultFiles = record.aiTaskResult ? [record.aiTaskResult.report, ...record.aiTaskResult.evidence].filter((file): file is NonNullable<typeof file> => Boolean(file)) : [];
                        return (
                          <article
                            key={record.id}
                            className={`deliverables-workspace__record is-${record.kind}${editingRecordId === record.id ? " is-editing-existing" : ""}`}
                            >
                            <b>{recordKindLabel(record.kind)}</b>
                            <div className="deliverables-workspace__record-content workflow-rich-content" onDoubleClick={() => record.kind === "ai_task_result" ? undefined : startRecordEdit(record)} title={record.kind === "ai_task_result" ? undefined : "双击编辑"} dangerouslySetInnerHTML={{ __html: record.text }} />
                            <aside className="deliverables-workspace__record-actions">
                              <time>{fileDate(record.aiTaskResult?.completedAt || record.createdAt)}</time>
                              {record.aiTask && <small className="deliverables-workspace__record-ai-task">AI 任务 · {record.aiTask.executor === "hermes" ? "Hermes" : "Multica"} · {record.aiTask.status}</small>}
                              {record.aiTaskResult && <small className="deliverables-workspace__record-ai-result">{record.aiTaskResult.executor === "hermes" ? "Hermes" : "Multica"} · {record.aiTaskResult.status === "archive_failed" ? "归档失败" : "待复核"}</small>}
                              {record.kind !== "ai_task_result" && <button aria-label="删除记录" title="删除记录" onClick={() => void deleteRecord(item, record)}>×</button>}
                            </aside>
                            {(record.attachments.length > 0 || resultFiles.length > 0) && (
                              <ul>
                                {[...record.attachments, ...resultFiles].map((file) => (
                                  <li key={file.relativePath}>
                                    <button
                                      className="deliverables-workspace__attachment-link"
                                      title={`打开 ${file.fileName}`}
                                      onClick={() => void fileAction(item, "open", file.relativePath)}
                                    >
                                      {file.fileName} · {fileSize(file.size)}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </article>
                        );
                      })}
                      </div>
                    </section>
                    <section
                      className={`deliverables-workspace__versions ${draggingFiles ? "is-dragging" : ""}`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDraggingFiles(true);
                      }}
                      onDragLeave={(event) => {
                        if (event.currentTarget === event.target)
                          setDraggingFiles(false);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDraggingFiles(false);
                        void upload(item, Array.from(event.dataTransfer.files));
                      }}
                    >
                      <header>
                        <div>
                          <h2>版本与材料</h2>
                          <small>拖拽文件到此处上传 · 目录内的全部文件</small>
                        </div>
                        <button
                          className="deliverables-workspace__refresh"
                          title="刷新文件清单"
                          aria-label="刷新文件清单"
                          onClick={() => void refreshFiles(item)}
                        >
                          ↻
                        </button>
                      </header>
                      {loadingFolders[item.content.folderPath] ? (
                        <p>正在读取目录文件…</p>
                      ) : (
                        <div className="deliverables-workspace__file-table">
                          <div className="deliverables-workspace__file-head">
                            <span>类型</span>
                            <span>版本</span>
                            <span>文件名</span>
                            <span>更新时间</span>
                            <span>大小</span>
                            <span>操作</span>
                          </div>
                          {(filesByFolder[item.content.folderPath] || []).map(
                            (file) => {
                              if (file.isDirectory) return (
                                <div className="deliverables-workspace__file-row is-directory" key={file.relativePath}>
                                  <span><i>目录</i></span>
                                  <span>—</span>
                                  <strong title={file.relativePath}><em>{file.fileName}</em></strong>
                                  <time>{fileDate(file.modifiedAt)}</time>
                                  <small className="deliverables-workspace__file-size">—</small>
                                  <aside>
                                    <button title="打开目录" aria-label="打开目录" onClick={() => void fileAction(item, "open", file.relativePath)}>↗</button>
                                  </aside>
                                </div>
                              );
                              const versionIndex =
                                item.content.versions.findIndex(
                                  (version) =>
                                    version.relativePath === file.relativePath,
                                );
                              const fallbackType: DeliverableFileType =
                                versionIndex >= 0 ? "deliverable" : "material";
                              const fallbackVersion =
                                versionIndex >= 0
                                  ? `V${item.content.versions.length - versionIndex}`
                                  : "";
                              const meta = item.content.fileMeta.find(
                                (entry) =>
                                  entry.relativePath === file.relativePath,
                              );
                              const type = meta?.type || fallbackType;
                              const version = meta?.version ?? fallbackVersion;
                              const note = meta?.note || "";
                              return (
                                <div
                                  className="deliverables-workspace__file-row"
                                  key={file.relativePath}
                                >
                                  <span>
                                    <select
                                      value={type}
                                      aria-label={`${file.fileName} 的类型`}
                                      onChange={(event) =>
                                        updateFileMeta(item, file, {
                                          type: event.target
                                            .value as DeliverableFileType,
                                        })
                                      }
                                    >
                                      <option value="deliverable">
                                        交付物
                                      </option>
                                      <option value="material">材料</option>
                                      <option value="intermediate">
                                        中间文件
                                      </option>
                                    </select>
                                  </span>
                                  <input
                                    aria-label={`${file.fileName} 的版本号`}
                                    value={version}
                                    placeholder="—"
                                    onChange={(event) =>
                                      updateFileMeta(item, file, {
                                        version: event.target.value,
                                      })
                                    }
                                  />
                                  <strong title={file.relativePath}>
                                    <em>
                                      {file.relativePath.slice(
                                        item.content.folderPath.length + 1,
                                      ) || file.fileName}
                                    </em>
                                    <span
                                      className="deliverables-workspace__file-note"
                                      onDoubleClick={() => startFileNoteEdit(file, note)}
                                      title="双击编辑备注"
                                    >
                                      {editingFileNotePath === file.relativePath ? (
                                        <input
                                          autoFocus
                                          aria-label={`${file.fileName} 的备注`}
                                          value={editingFileNote}
                                          placeholder="双击填写备注"
                                          onChange={(event) => setEditingFileNote(event.target.value)}
                                          onBlur={() => saveFileNote(item, file)}
                                          onKeyDown={(event) => {
                                            if (event.key === "Escape") {
                                              event.preventDefault();
                                              cancelFileNoteEdit();
                                            }
                                            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                                              event.currentTarget.blur();
                                            }
                                          }}
                                        />
                                      ) : note || <small>双击填写备注</small>}
                                    </span>
                                  </strong>
                                  <time>{fileDate(file.modifiedAt)}</time>
                                  <small className="deliverables-workspace__file-size">{fileSize(file.size)}</small>
                                  <aside>
                                    <button
                                      title="打开"
                                      aria-label="打开"
                                      onClick={() => void fileAction(item, "open", file.relativePath)}
                                    >
                                      ↗
                                    </button>
                                    <button
                                      title="在访达中显示"
                                      aria-label="在访达中显示"
                                      onClick={() => void fileAction(item, "reveal", file.relativePath)}
                                    >
                                      ⌕
                                    </button>
                                    <button
                                      title="删除"
                                      aria-label="删除"
                                      onClick={() =>
                                        void deleteFile(item, file)
                                      }
                                    >
                                      ×
                                    </button>
                                  </aside>
                                </div>
                              );
                            },
                          )}
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              </div>
            )}
          </article>
        ))}
        {items.length === 0 && (
          <p className="deliverables-workspace__empty">
            暂无任务交付物。请先在项目计划的任务中新增交付物。
          </p>
        )}
      </div>
    </section>
  );
}
