import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import type { AttachmentsBlock, AttachmentNode } from "@ke/domain";
import { api } from "../api/client.js";
import "./AttachmentsEditor.css";

interface Props {
  /** The element id is needed so uploads land in the right per-element dir. */
  elementId: string;
  block: AttachmentsBlock;
  onUpdate: (next: AttachmentsBlock) => void;
}

/**
 * Inline editor for the AttachmentsBlock. Two source modes:
 *   - "uploaded":     drag files in → POST /api/attachments/:id → save URLs.
 *     Renders as a flat list. Each file is downloadable + deletable.
 *   - "linked-folder": user picks a folder via <input webkitdirectory>; the
 *     browser hands us the file list with relative paths and we build a tree
 *     snapshot. Files aren't uploaded — they live wherever the user picked
 *     them. The block just remembers names + structure.
 *
 * Mode is sticky per block (default "uploaded" when freshly added). User can
 * switch mode but it clears the list — files from one mode can't be mixed
 * with the other.
 */
export function AttachmentsEditor({ elementId, block, onUpdate }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const setMode = (source: AttachmentsBlock["source"]) => {
    if (source === block.source) return;
    if (block.items.length > 0 && !window.confirm("切换模式会清空当前清单,确定？")) return;
    onUpdate({ style: "attachments", source, items: [], folderName: undefined, scannedAt: undefined });
  };

  async function handleUpload(files: File[]) {
    if (files.length === 0) return;
    setBusy(true); setError(null);
    try {
      const saved = await api.uploadAttachments(elementId, files);
      const newNodes: AttachmentNode[] = saved.map(f => ({ kind: "file", name: f.name, src: f.src, size: f.size }));
      // Dedupe by name — server overwrites existing files of same name, so
      // we replace the existing entry rather than appending a duplicate.
      const nameSet = new Set(newNodes.map(n => n.name));
      const kept = block.items.filter(n => !(n.kind === "file" && nameSet.has(n.name)));
      onUpdate({
        ...block,
        source: "uploaded",
        items: [...kept, ...newNodes],
        scannedAt: new Date().toISOString(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    void handleUpload(files);
    e.target.value = "";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (block.source !== "uploaded") return;
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    void handleUpload(files);
  }

  function handleFolderInputChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) { e.target.value = ""; return; }
    // Each File has `webkitRelativePath` like "rootDir/sub/file.txt".
    const folderName = files[0].webkitRelativePath.split("/")[0] ?? "选中的文件夹";
    const tree = buildTreeFromFiles(files);
    onUpdate({
      style: "attachments",
      source: "linked-folder",
      folderName,
      items: tree,
      scannedAt: new Date().toISOString(),
    });
    e.target.value = "";
  }

  async function deleteFile(name: string) {
    if (!window.confirm(`删除附件「${name}」？文件会从服务器上一并清除。`)) return;
    setBusy(true); setError(null);
    try {
      await api.deleteAttachment(elementId, name);
      onUpdate({
        ...block,
        items: block.items.filter(n => !(n.kind === "file" && n.name === name)),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const isUploaded = block.source === "uploaded";

  return (
    <div className="att-editor">
      <div className="att-mode">
        <button
          type="button"
          className={isUploaded ? "is-active" : ""}
          onClick={() => setMode("uploaded")}
          disabled={busy}
        >
          📎 拖入文件
        </button>
        <button
          type="button"
          className={!isUploaded ? "is-active" : ""}
          onClick={() => setMode("linked-folder")}
          disabled={busy}
        >
          📁 链接文件夹
        </button>
      </div>

      {isUploaded ? (
        <div
          className={`att-dropzone${dragOver ? " is-over" : ""}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <p className="att-dropzone__hint">
            把文件拖到这里上传,或<button type="button" className="att-link" onClick={() => fileInputRef.current?.click()} disabled={busy}>选择文件</button>。
            上传的文件会保存到 <code>data/attachments/{elementId}/</code>。
          </p>
          <input
            ref={fileInputRef}
            type="file" multiple hidden
            onChange={handleFileInputChange}
          />
        </div>
      ) : (
        <div className="att-dropzone att-dropzone--folder">
          <p className="att-dropzone__hint">
            {block.folderName
              ? <>已链接文件夹: <strong>{block.folderName}</strong>。重新链接会替换当前清单。</>
              : "选一个本地文件夹,我会解析里面的所有文件 + 目录列出来。文件本身不会上传到服务器。"}
            <button
              type="button" className="att-link"
              onClick={() => folderInputRef.current?.click()}
              disabled={busy}
            >选择文件夹</button>
          </p>
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is non-standard but widely supported
            webkitdirectory=""
            directory=""
            multiple hidden
            onChange={handleFolderInputChange}
          />
        </div>
      )}

      {block.items.length > 0 && (
        <div className="att-tree">
          {block.items.map((node, i) => (
            <AttachmentRow
              key={`${i}-${nodeKey(node)}`}
              node={node} depth={0}
              canDelete={isUploaded}
              onDelete={isUploaded ? deleteFile : undefined}
            />
          ))}
        </div>
      )}
      {block.scannedAt && (
        <div className="att-meta">
          {block.items.length === 0 ? "(空)" : `共 ${countFiles(block.items)} 个文件`}
          {" · 更新于 "} {block.scannedAt.slice(0, 19).replace("T", " ")}
        </div>
      )}
      {error && <div className="att-error">{error}</div>}
    </div>
  );
}

function nodeKey(n: AttachmentNode): string {
  return n.kind === "file" ? `f:${n.name}` : `d:${n.name}`;
}

/** Recursive directory / file row. */
function AttachmentRow({
  node, depth, canDelete, onDelete,
}: {
  node: AttachmentNode;
  depth: number;
  canDelete: boolean;
  onDelete?: (name: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  if (node.kind === "file") {
    return (
      <div className="att-row att-row--file" style={{ paddingLeft: 8 + depth * 16 }}>
        <span className="att-row__icon" aria-hidden="true">📄</span>
        {node.src ? (
          <a className="att-row__name" href={node.src} download={node.name} title="点击下载">
            {node.name}
          </a>
        ) : (
          <span className="att-row__name att-row__name--local" title="本地文件,未上传">
            {node.name}
          </span>
        )}
        {typeof node.size === "number" && <span className="att-row__meta">{prettySize(node.size)}</span>}
        {canDelete && onDelete && (
          <button
            type="button" className="att-row__delete"
            onClick={() => onDelete(node.name)} title="删除附件"
          >×</button>
        )}
      </div>
    );
  }
  // dir
  return (
    <>
      <button
        type="button"
        className="att-row att-row--dir"
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => setOpen(v => !v)}
      >
        <span className="att-row__icon" aria-hidden="true">{open ? "▾" : "▸"}</span>
        <span className="att-row__icon" aria-hidden="true">📁</span>
        <span className="att-row__name att-row__name--dir">{node.name}</span>
        <span className="att-row__meta">{countFiles(node.children)} 个文件</span>
      </button>
      {open && node.children.map((c, i) => (
        <AttachmentRow
          key={`${i}-${nodeKey(c)}`}
          node={c} depth={depth + 1}
          canDelete={canDelete} onDelete={onDelete}
        />
      ))}
    </>
  );
}

function countFiles(nodes: AttachmentNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.kind === "file") n++;
    else n += countFiles(node.children);
  }
  return n;
}

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Convert a flat File list (from <input webkitdirectory>) into a nested
 *  tree based on each File's `webkitRelativePath`. */
interface RawFile { name: string; webkitRelativePath: string; size: number }
function buildTreeFromFiles(files: RawFile[]): AttachmentNode[] {
  // Drop the leading folder name from relative paths (it's the picked folder
  // itself, not part of its contents).
  const root: AttachmentNode[] = [];
  const dirMap = new Map<string, AttachmentNode[]>(); // path → children array
  dirMap.set("", root);

  function ensureDir(path: string): AttachmentNode[] {
    if (dirMap.has(path)) return dirMap.get(path)!;
    const idx = path.lastIndexOf("/");
    const parentPath = idx < 0 ? "" : path.slice(0, idx);
    const name = idx < 0 ? path : path.slice(idx + 1);
    const parent = ensureDir(parentPath);
    const children: AttachmentNode[] = [];
    parent.push({ kind: "dir", name, children });
    dirMap.set(path, children);
    return children;
  }

  for (const f of files) {
    const rel = f.webkitRelativePath || f.name;
    const parts = rel.split("/");
    parts.shift(); // strip the picked folder's own name
    if (parts.length === 0) continue;
    const fileName = parts.pop()!;
    const dirPath = parts.join("/");
    const dirChildren = ensureDir(dirPath);
    dirChildren.push({ kind: "file", name: fileName, size: f.size, relPath: rel });
  }

  // Sort: dirs first, then files; alphabetical within each group.
  function sort(nodes: AttachmentNode[]): void {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name, "zh");
    });
    for (const n of nodes) if (n.kind === "dir") sort(n.children);
  }
  sort(root);

  return root;
}
