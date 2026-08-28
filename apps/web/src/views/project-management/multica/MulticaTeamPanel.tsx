import type { ReactNode } from "react";
import type { MulticaTeamSnapshot } from "../../../api/client.js";

export function MulticaTeamPanel({ team, onClose }: { team: MulticaTeamSnapshot; onClose: () => void }): ReactNode {
  const leader = team.agents.find(agent => agent.id === team.squad.leader_id);
  return <aside className="multica-team-panel">
    <header><div><span>MULTICA TEAM</span><h3>{team.squad.name}</h3></div><button type="button" onClick={onClose} aria-label="关闭团队信息">×</button></header>
    <section><h4>Project / Squad</h4><dl><div><dt>项目</dt><dd>{team.project?.title ?? "—"}</dd></div><div><dt>Leader</dt><dd>{leader?.name ?? team.squad.leader_id ?? "—"}</dd></div><div><dt>说明</dt><dd>{team.squad.description ?? "—"}</dd></div></dl></section>
    <section><h4>Agents</h4><div className="multica-team-panel__agents">{team.agents.map(agent => <article key={agent.id} className={agent.id === team.squad.leader_id ? "is-leader" : ""}><header><strong>{agent.name}</strong><span>{agent.role ?? "member"}</span></header><p>{agent.runtime_name ?? agent.runtime_provider ?? "未配置 Runtime"}</p><code>{agent.model ?? "默认模型"}</code><div>{(agent.mcp_servers ?? []).length ? agent.mcp_servers?.map(server => <em key={server.id}>MCP · {server.name ?? server.id}</em>) : <small>无 MCP</small>}</div></article>)}</div></section>
    <section><h4>Project resources</h4>{team.resources.length ? team.resources.map(resource => <article className="multica-team-panel__resource" key={resource.id}><strong>{resource.type ?? "resource"}</strong><code>{resource.local_path ?? "—"}</code><span>{resource.execution_mode ?? "—"}</span></article>) : <p className="multica-team-panel__none">暂无资源</p>}</section>
  </aside>;
}
