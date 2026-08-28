# Rich MCP 2.0

Rich 在主服务的 `/mcp` 暴露 MCP 2.0，使用无会话的 Streamable HTTP。Hermes、Codex 等客户端继续使用原 URL：

```yaml
mcp_servers:
  rich:
    url: http://127.0.0.1:31515/mcp
```

生产入口位于 `apps/server/src/mcp-v2/`。本目录只保留迁移说明；旧工具注册代码将在 MCP 2.0 最终清理中删除。

## 设计

- 场景优先：完整用户结果使用 capture、plan、delegate、review 场景工具。
- 资源工具：对象和动作已经明确时，使用对应 `rich_*_manage`。
- 统一信封：所有工具返回 `ok/action/data|error/refs/changes/verification/warnings`。
- 写安全：真实写入必须有 `context.requestId`；支持 `options.dryRun`；删除、取消和整体替换需要 `options.confirmDestructive=true`。
- 工作跟踪：外部 Agent ID 与 Rich 本地任务 ID 分开保存。Rich ID 是查询、验收和经验沉淀的主键。
- 委派边界：MCP 2.0 默认使用不可用适配器，不会伪造任务。Multica CLI 适配器是后续独立工作。

## 维护

完整目录见 `docs/RICH_MCP_V2_CATALOG.md`，由下列命令生成：

```bash
pnpm --filter @ke/server mcp:docs
pnpm --filter @ke/server mcp:docs -- --check
```

新增工具必须通过注册表上限（40）、Schema 预算、50 条场景选择测试和 HTTP transport 测试。
