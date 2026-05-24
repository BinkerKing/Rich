# Hermes AI 语料模板接入

Rich 的 AI 语料模板是共享数据，后台页面、Hermes MCP tools、CLI 都读写同一份数据。

## Hermes 使用流程

1. 遇到风格敏感任务时，先查模板：
   - MCP: `corpus_list`
   - CLI: `pnpm corpus list 系统`
2. 选中匹配场景后，读取 prompt 片段：
   - MCP: `corpus_prompt`
   - CLI: `pnpm corpus prompt system-status-report`
3. 按模板里的 `必须包含`、`风格规则`、`答复模板` 组织回复。
4. 如果用户反馈“这里说法不对 / 风格不对 / 信息不完整”，更新模板：
   - MCP: `corpus_upsert`
   - CLI: `pnpm corpus patch system-status-report --field styleGuide --value "先给结论，再给风险，最后给下一步动作。"`

## CLI

```bash
pnpm corpus list
pnpm corpus get system-status-report
pnpm corpus prompt system-status-report
pnpm corpus patch system-status-report --field mustInclude --value "总体状态、关键指标、异常、风险、下一步动作"
pnpm corpus upsert --file template.json
pnpm corpus delete template-id
```

默认连接 `http://127.0.0.1:31515`。如果 Rich 运行在别的地址：

```bash
RICH_API_URL=http://127.0.0.1:31515 pnpm corpus list
```
