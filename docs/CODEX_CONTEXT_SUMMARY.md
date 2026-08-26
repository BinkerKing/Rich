# Codex Context Summary

## Current Focus

Rich 项目管理里的数据字典正在围绕 Mapping、测试数据、实体表、SQL 抽取流程持续调整。

最新关注点：
- 测试数据页点击“抽数准备”后，进入“抽数SQL准备”阶段。
- “抽数SQL准备”必须展示即将执行的完整抽取 SQL，通常是 `INSERT ... SELECT ... FROM ...`，SQL 较长时展示框内部滚动。
- 口径 SQL 有问题时，准备阶段应阻止继续执行，并展示口径错误。
- 字段 Mapping SQL 无法转换时，完整抽取 SQL 仍应继续组装，该字段按 `NULL` 或默认值抽取，同时在“抽取逻辑问题”里列出字段问题。
- 用户填写运行参数后，再点击“数据抽取”，才真正执行 SQL。

## Mapping Rules Direction

- Mapping 逻辑以标准 JSON 动作为主，尽量不用自由 SQL。
- SQL 动作可以保留，但需要校验，不能无脑转换。
- SQL 展示要贴近真实 SQL，不随意加多余引号。
- 表别名优先使用原表名；重复时再加数字或后缀。
- 运行参数需要有明确参数表达式，例如 `:importDate`，测试数据抽取前由用户填写后替换。
- 备注列在 Mapping 表格里只显示 Mapping 备注；标准逻辑 JSON 只在悬浮框中追加展示，不写回数据库。

## Recent Implementation Notes

- 后端新增抽数 SQL 准备接口：
  `POST /api/project-management/:projectId/dictionary/tables/:tableId/entity/extract/prepare`
- 前端 `prepareMappingExtraction` 已改为调用实体抽取准备接口，而不是只调用 Mapping SQL 校验接口。
- 后端 `prepareDictionaryEntityExtractionSql` 返回完整抽取 SQL、口径状态、字段转换问题和最终 SQL 校验错误。
- CSS 已为抽数 SQL 展示框设置较高高度和内部滚动。
- 前后端 typecheck 已通过：
  `pnpm --filter @ke/server typecheck`
  `pnpm --filter @ke/web typecheck`

## Restart Convention

用户要求启动方式是 APP，并且只保留最新 APP，不存多个版本。

常用重启步骤：
1. 打包桌面端：
   `pnpm --filter @ke/desktop package`
2. 关闭 Rich：
   `osascript -e 'tell application "Rich" to quit' || true`
3. 覆盖 `/Applications/Rich.app`：
   `rsync -a --delete apps/desktop/release/mac-arm64/Rich.app/ /Applications/Rich.app/`
4. 启动 APP：
   `open /Applications/Rich.app`

## Caution

- 当前工作区有大量历史改动和未跟踪文件，不能随意 reset 或 revert。
- 改动前要聚焦当前需求对应文件，避免把已修好的功能改坏。
