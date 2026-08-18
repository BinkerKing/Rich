/**
 * 部署拓扑画布 · 基于 @xyflow/react
 *
 * 数据流：
 *   project
 *     └─ env (deployment-env)
 *         ├─ module (group)            ← 渲染成 react-flow 的 group node（容器）
 *         │   └─ server                ← 渲染成 child node，parentId = module 的 node id
 *         └─ connection                ← 渲染成 edge：fromServer → toServer
 *
 * 交互：
 *   - 拖动节点：onNodeDragStop 把 x/y 保存到 element.content.layout.x/y
 *   - 连线：onConnect 弹端口/协议输入框，创建新的 connection 元
 *   - 拖服务器到不同模块：onNodeDragStop 检测 intersection，调 /move 改 parent
 *   - 点服务器节点：触发 onPickServer 打开 drawer（复用 DeploySection 的 ServerDrawer）
 *
 * 自动布局：第一次加载（无 layout 数据）时按"模块网格"摆放：
 *   - 模块横向排列，宽 320 高 280
 *   - 模块内服务器纵向堆叠
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Element } from "@ke/domain";
import {
  ReactFlow, Background, Controls, MiniMap,
  applyNodeChanges, applyEdgeChanges, addEdge,
  type Node, type Edge, type NodeChange, type EdgeChange, type Connection,
  type NodeProps, Handle, Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "../api/client.js";

interface Props {
  envId: string;
  modules: Element[];
  servers: Array<{ server: Element; module: Element }>;
  connections: Element[];
  onPickServer: (id: string) => void;
  onReload: () => void;
}

/** 拓扑节点的 layout 保存在 element.content.layout */
interface NodeLayout { x: number; y: number; width?: number; height?: number }
function serverRoleLabel(role: string | undefined): string {
  if (role === "front") return "前置机";
  if (role === "app") return "应用服务器";
  if (role === "database") return "数据库";
  if (role === "vip") return "虚拟VIP";
  if (role === "router") return "路由";
  return "未设置";
}
function readLayout(el: Element): NodeLayout | null {
  const c = el.content as { layout?: NodeLayout } | null | undefined;
  if (!c?.layout) return null;
  if (typeof c.layout.x !== "number" || typeof c.layout.y !== "number") return null;
  return c.layout;
}

/** 自动布局：模块横排，每个模块内服务器纵列 */
function autoLayout(modules: Element[], serversByModule: Map<string, Element[]>): {
  modulePos: Map<string, NodeLayout>;
  serverPos: Map<string, NodeLayout>;
} {
  const MODULE_W = 280;
  const MODULE_H_BASE = 80;
  const SERVER_H = 56;
  const MODULE_X_GAP = 60;
  const MODULES_PER_ROW = 4;
  const ROW_GAP = 80;
  const modulePos = new Map<string, NodeLayout>();
  const serverPos = new Map<string, NodeLayout>();
  modules.forEach((m, idx) => {
    const col = idx % MODULES_PER_ROW;
    const row = Math.floor(idx / MODULES_PER_ROW);
    const servers = serversByModule.get(m.id) ?? [];
    const h = MODULE_H_BASE + servers.length * (SERVER_H + 10);
    const x = col * (MODULE_W + MODULE_X_GAP);
    // 把每行高度对齐到本行最高模块（粗略：用上一行的累积高度 + ROW_GAP）
    let y = 0;
    for (let r = 0; r < row; r++) {
      let rowMax = MODULE_H_BASE;
      for (let c = 0; c < MODULES_PER_ROW; c++) {
        const i = r * MODULES_PER_ROW + c;
        if (i >= modules.length) break;
        const ms = serversByModule.get(modules[i].id)?.length ?? 0;
        const mh = MODULE_H_BASE + ms * (SERVER_H + 10);
        if (mh > rowMax) rowMax = mh;
      }
      y += rowMax + ROW_GAP;
    }
    modulePos.set(m.id, { x, y, width: MODULE_W, height: h });
    servers.forEach((s, si) => {
      serverPos.set(s.id, {
        x: 10,
        y: 50 + si * (SERVER_H + 10),
        width: MODULE_W - 20,
        height: SERVER_H,
      });
    });
  });
  return { modulePos, serverPos };
}

// ── 自定义节点 ──────────────────────────────────────────────────
function ServerNode({ data }: NodeProps) {
  const d = data as { title: string; ip?: string; port?: number; hostname?: string; serverRole?: string };
  return (
    <div className="topo-server-node" title={d.hostname}>
      <Handle type="target" position={Position.Top} className="topo-handle" />
      <div className="topo-server-node__head">
        <span className="topo-server-node__name">{d.title}</span>
        <span className={`topo-server-node__role topo-server-node__role--${d.serverRole ?? "unset"}`}>
          {serverRoleLabel(d.serverRole)}
        </span>
      </div>
      <code className="topo-server-node__ip">{d.ip ?? "—"}{d.port ? `:${d.port}` : ""}</code>
      <Handle type="source" position={Position.Bottom} className="topo-handle" />
    </div>
  );
}

function ModuleNode({ data }: NodeProps) {
  const d = data as { title: string; subtitle?: string; count: number };
  return (
    <div className="topo-module-node">
      <header>
        <strong>{d.title}</strong>
        <span className="topo-module-node__count">{d.count}</span>
      </header>
      {d.subtitle && <div className="topo-module-node__sub">{d.subtitle}</div>}
    </div>
  );
}

const NODE_TYPES = { server: ServerNode, module: ModuleNode };

function mergeNodesById(current: Node[], next: Node[]): Node[] {
  const currentById = new Map(current.map(node => [node.id, node]));
  return next.map(node => {
    const existing = currentById.get(node.id);
    if (!existing) return node;
    return {
      ...node,
      position: existing.position,
      selected: existing.selected,
      dragging: existing.dragging,
    };
  });
}

// ── 主组件 ──────────────────────────────────────────────────────
export function TopologyCanvas({ envId: _envId, modules, servers, connections, onPickServer, onReload }: Props) {
  // 探活结果：connectionId → status
  const [probeResults, setProbeResults] = useState<Map<string, "ok" | "timeout" | "refused" | "unreachable">>(new Map());
  const [probedAt, setProbedAt] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);

  async function probeAll() {
    setProbing(true);
    try {
      const items: Array<{ id: string; ip: string; port: number }> = [];
      for (const conn of connections) {
        const cc = conn.content as { fromServerId?: string; toServerId?: string; port?: number };
        if (!cc.toServerId || !cc.port) continue;
        const toServer = servers.find(s => s.server.id === cc.toServerId)?.server;
        const ip = (toServer?.content as { ip?: string } | undefined)?.ip;
        if (!ip) continue;
        items.push({ id: conn.id, ip, port: cc.port });
      }
      if (items.length === 0) {
        window.alert("没有可探活的连接（缺 IP 或端口）");
        return;
      }
      const r = await api.probeConnections(items);
      const map = new Map<string, "ok" | "timeout" | "refused" | "unreachable">();
      for (const res of r.results) map.set(res.id, res.status);
      setProbeResults(map);
      setProbedAt(r.probedAt);
    } catch (e) {
      window.alert(`探活失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProbing(false);
    }
  }
  // 索引：server id → server element
  const serverById = useMemo(() => {
    const m = new Map<string, Element>();
    for (const { server } of servers) m.set(server.id, server);
    return m;
  }, [servers]);

  // 模块 → 子服务器
  const serversByModule = useMemo(() => {
    const m = new Map<string, Element[]>();
    for (const { server, module } of servers) {
      const arr = m.get(module.id) ?? [];
      arr.push(server);
      m.set(module.id, arr);
    }
    return m;
  }, [servers]);

  const layoutHints = useMemo(() => autoLayout(modules, serversByModule), [modules, serversByModule]);

  // 把 elements → nodes
  const initialNodes = useMemo<Node[]>(() => {
    const out: Node[] = [];
    for (const m of modules) {
      const saved = readLayout(m);
      const hint = layoutHints.modulePos.get(m.id)!;
      const pos = saved ?? hint;
      out.push({
        id: m.id,
        type: "module",
        position: { x: pos.x, y: pos.y },
        style: { width: hint.width, height: hint.height, zIndex: -1 },
        data: {
          title: m.title,
          subtitle: m.subtitle ?? "",
          count: serversByModule.get(m.id)?.length ?? 0,
        },
      });
    }
    for (const { server, module } of servers) {
      const saved = readLayout(server);
      const hint = layoutHints.serverPos.get(server.id)!;
      const pos = saved ?? hint;
      const c = (server.content ?? {}) as { ip?: string; port?: number; hostname?: string; serverRole?: string };
      out.push({
        id: server.id,
        type: "server",
        parentId: module.id,
        extent: "parent",
        position: { x: pos.x, y: pos.y },
        style: { width: hint.width },
        data: {
          title: server.title,
          ip: c.ip,
          port: c.port,
          hostname: c.hostname,
          serverRole: c.serverRole,
        },
      });
    }
    return out;
  }, [modules, servers, layoutHints, serversByModule]);

  const initialEdges = useMemo<Edge[]>(() => {
    return connections
      .map(conn => {
        const cc = conn.content as { fromServerId?: string; toServerId?: string; port?: number; protocol?: string; firewall?: string; purpose?: string };
        if (!cc.fromServerId || !cc.toServerId) return null;
        // 探活结果优先于 firewall 字段（"实际通"覆盖"理论应通"）
        const probeStatus = probeResults.get(conn.id);
        const statusClass = probeStatus === "ok" ? "open"
          : probeStatus === "timeout" || probeStatus === "unreachable" ? "blocked"
          : probeStatus === "refused" ? "blocked"
          : (cc.firewall ?? "unknown");
        const labelExtras = probeStatus ? ` · ${probeStatus}` : "";
        return {
          id: conn.id,
          source: cc.fromServerId,
          target: cc.toServerId,
          label: `${cc.port}/${cc.protocol ?? "tcp"}${labelExtras}`,
          animated: statusClass === "pending",
          className: `topo-edge topo-edge--${statusClass}`,
          data: { connectionId: conn.id, port: cc.port, protocol: cc.protocol, firewall: cc.firewall, purpose: cc.purpose, probeStatus },
        } as Edge;
      })
      .filter((e): e is Edge => !!e);
  }, [connections, probeResults]);

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  const nodeRenderKey = useMemo(() => {
    return initialNodes
      .map(n => `${n.id}:${n.type ?? ""}:${n.parentId ?? ""}:${JSON.stringify(n.data)}:${JSON.stringify(n.style)}`)
      .join("|");
  }, [initialNodes]);
  const edgeRenderKey = useMemo(() => {
    return initialEdges.map(e => `${e.id}:${e.source}:${e.target}:${e.label ?? ""}:${e.className ?? ""}`).join("|");
  }, [initialEdges]);

  // 数据变化时更新节点信息，但保留当前画布位置，避免拖拽后被旧布局闪回。
  useEffect(() => { setNodes(current => mergeNodesById(current, initialNodes)); }, [nodeRenderKey]);
  useEffect(() => { setEdges(initialEdges); }, [edgeRenderKey]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds));
  }, []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds));
  }, []);

  /** 拖动结束后把 x/y 写回 element.content.layout */
  const onNodeDragStop = useCallback(async (_e: React.MouseEvent, node: Node) => {
    const el = node.type === "server" ? serverById.get(node.id) : modules.find(m => m.id === node.id);
    if (!el) return;
    const oldContent = (el.content ?? {}) as Record<string, unknown>;
    try {
      await api.patchElement(node.id, {
        content: {
          ...oldContent,
          layout: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
        },
      });
    } catch (e) {
      console.warn("[topo] save layout failed:", e);
    }
  }, [serverById, modules]);

  /** 用户拉线 → 创建新的 connection 元 */
  const onConnect = useCallback(async (conn: Connection) => {
    if (!conn.source || !conn.target) return;
    if (conn.source === conn.target) return;
    const portStr = window.prompt("目标端口（如 3306 / 5432 / 80）：");
    if (!portStr) return;
    const port = parseInt(portStr, 10);
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
      window.alert("端口非法（1-65535）");
      return;
    }
    const protocol = window.prompt("协议（tcp / udp / http / https / nfs / ...）", "tcp") ?? "tcp";
    const purpose = window.prompt("用途（可选）：") ?? "";
    try {
      const r = await api.createElement({
        title: `conn-${port}`,
        type: "connection",
        parentId: _envId,
      });
      await api.patchElement(r.element.id, {
        content: {
          fromServerId: conn.source,
          toServerId: conn.target,
          port,
          protocol,
          purpose,
          firewall: "unknown",
        },
      });
      const newEdge: Edge = {
        id: r.element.id,
        source: conn.source!,
        target: conn.target!,
        sourceHandle: conn.sourceHandle ?? undefined,
        targetHandle: conn.targetHandle ?? undefined,
        label: `${port}/${protocol}`,
        className: "topo-edge topo-edge--unknown",
      };
      setEdges(eds => [...eds, newEdge]);
      onReload();
    } catch (e) {
      window.alert(`新建连接失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [_envId, onReload]);

  /** 点服务器节点 → 触发 drawer */
  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node) => {
    if (node.type === "server") onPickServer(node.id);
  }, [onPickServer]);

  /** 边右键 / 双击删除 */
  const onEdgeDoubleClick = useCallback(async (_e: React.MouseEvent, edge: Edge) => {
    if (!window.confirm(`删除连接 ${edge.label}？`)) return;
    setEdges(eds => eds.filter(e => e.id !== edge.id));
    try {
      await api.deleteElement(edge.id);
      onReload();
    } catch (e) {
      setEdges(eds => eds.some(item => item.id === edge.id) ? eds : [...eds, edge]);
      window.alert(`删除失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [onReload]);

  return (
    <div className="topo-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} color="rgba(255,255,255,.06)" />
        <Controls position="top-left" />
        <MiniMap nodeColor={() => "#8ffef7"} maskColor="rgba(0,0,0,0.6)"
          style={{ background: "#0a141e", border: "1px solid rgba(255,255,255,.1)" }} />
      </ReactFlow>
      <div className="topo-canvas__toolbar">
        <button type="button" className="prj-btn-primary topo-canvas__probe-btn"
          onClick={() => void probeAll()} disabled={probing || connections.length === 0}>
          {probing ? "探活中…" : "🛰 探活所有连接"}
        </button>
        {probedAt && (
          <span className="topo-canvas__probed">
            上次探活：{new Date(probedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            {" · "}
            <span style={{ color: "#4ade80" }}>{Array.from(probeResults.values()).filter(s => s === "ok").length} 通</span>
            {" / "}
            <span style={{ color: "#f87171" }}>{Array.from(probeResults.values()).filter(s => s !== "ok").length} 不通</span>
          </span>
        )}
      </div>
      <div className="topo-canvas__hint">
        💡 拖动节点重排 · 从节点底部拉线到另一个节点的顶部创建连接 · 双击连线删除 · 点服务器看详情
      </div>
    </div>
  );
}
