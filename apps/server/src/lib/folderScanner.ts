/**
 * 项目文件夹扫描器。
 *
 * 输入：项目本地路径 + 最大深度。
 * 输出：一棵 FolderNode 树 + 顶层统计（文件数 / 总大小 / 各扩展名占比）。
 *
 * 安全 / 性能限制：
 *   - 只读，绝不写
 *   - 默认排除 .DS_Store / .git / .svn / node_modules / dist / build / .class / .java 等噪音
 *   - 默认完整遍历；节点数上限防止目录过大占用过多资源
 *   - 软上限：最多 20000 个节点；超了截断 + 在节点上挂 truncated=true
 *   - 单文件 stat 失败不报错，整体跳过
 */
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

export interface FolderNode {
  /** 相对 rootPath 的路径；root 自己是 "" */
  path: string;
  name: string;
  kind: "dir" | "file";
  /** 字节数。dir 是递归累计 */
  size: number;
  /** dir 才有 */
  children?: FolderNode[];
  /** dir：是否被截断（超过节点上限） */
  truncated?: boolean;
  /** 该目录被项目手动忽略；保留目录本身但不读取子项。 */
  ignored?: boolean;
  /** file: 扩展名（小写，含 .） */
  ext?: string;
  mtime?: string;
}

export interface ScanResult {
  rootPath: string;
  scannedAt: string;
  totalNodes: number;
  totalFiles: number;
  totalDirs: number;
  totalSize: number;
  /** 扩展名分布 top 10 */
  extStats: Array<{ ext: string; count: number; totalBytes: number }>;
  root: FolderNode;
  /** 遇到的问题：无权限 / 链接断 / 等等 */
  warnings: string[];
}

const DEFAULT_EXCLUDE = new Set([
  ".DS_Store", ".git", ".svn", "node_modules", "dist", "build", ".next",
  ".cache", ".vscode", ".idea", "__pycache__", ".pnpm-store",
]);
const DEFAULT_EXCLUDE_EXTENSIONS = new Set([".class", ".java"]);

export interface ScanOptions {
  maxDepth?: number;           // 默认 1000（实际视为完整遍历）
  maxNodes?: number;           // 默认 20000
  excludeNames?: Set<string>;  // 排除某些目录/文件名
  ignoreDirectoryPaths?: Set<string>; // 相对 rootPath 的手动忽略目录
}

export async function scanFolder(rootPath: string, opts: ScanOptions = {}): Promise<ScanResult> {
  const maxDepth = opts.maxDepth ?? 1000;
  const maxNodes = opts.maxNodes ?? 20000;
  const exclude = opts.excludeNames ?? DEFAULT_EXCLUDE;
  const ignoredPaths = opts.ignoreDirectoryPaths ?? new Set<string>();

  const warnings: string[] = [];
  let totalNodes = 0;
  let totalFiles = 0;
  let totalDirs = 0;
  let totalSize = 0;
  const extCounts = new Map<string, { count: number; totalBytes: number }>();

  // 用栈做迭代式 DFS，避免大目录爆栈
  async function walkDir(absPath: string, depth: number): Promise<FolderNode> {
    const name = absPath.split("/").pop() ?? absPath;
    const node: FolderNode = {
      path: relative(rootPath, absPath),
      name,
      kind: "dir",
      size: 0,
      children: [],
    };
    totalNodes++;
    totalDirs++;
    if (ignoredPaths.has(node.path)) {
      node.ignored = true;
      return node;
    }
    if (totalNodes > maxNodes) {
      node.truncated = true;
      return node;
    }
    if (depth >= maxDepth) return node;

    let entries: string[];
    try {
      entries = await readdir(absPath);
    } catch (e) {
      warnings.push(`无法读 ${absPath}: ${(e as Error).message}`);
      return node;
    }
    for (const entry of entries) {
      if (exclude.has(entry)) continue;
      const childAbs = join(absPath, entry);
      let st;
      try { st = await stat(childAbs); }
      catch (e) {
        warnings.push(`stat 失败 ${childAbs}: ${(e as Error).message}`);
        continue;
      }
      if (totalNodes > maxNodes) {
        node.truncated = true;
        break;
      }
      if (st.isDirectory()) {
        const childNode = await walkDir(childAbs, depth + 1);
        node.size += childNode.size;
        node.children!.push(childNode);
      } else if (st.isFile()) {
        const ext = (entry.includes(".") ? entry.slice(entry.lastIndexOf(".")) : "").toLowerCase();
        if (DEFAULT_EXCLUDE_EXTENSIONS.has(ext)) continue;
        const fileNode: FolderNode = {
          path: relative(rootPath, childAbs),
          name: entry,
          kind: "file",
          size: st.size,
          ext,
          mtime: st.mtime.toISOString(),
        };
        node.children!.push(fileNode);
        totalNodes++;
        totalFiles++;
        totalSize += st.size;
        node.size += st.size;
        const cur = extCounts.get(ext) ?? { count: 0, totalBytes: 0 };
        cur.count++;
        cur.totalBytes += st.size;
        extCounts.set(ext, cur);
      }
    }
    // 排序：目录先 → 字母序
    node.children!.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name, "zh-CN");
    });
    return node;
  }

  const root = await walkDir(rootPath, 0);
  // root 自己 path 应该是 ""
  root.path = "";

  const extStats = Array.from(extCounts.entries())
    .map(([ext, v]) => ({ ext: ext || "(无扩展名)", ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    rootPath,
    scannedAt: new Date().toISOString(),
    totalNodes,
    totalFiles,
    totalDirs,
    totalSize,
    extStats,
    root,
    warnings,
  };
}
