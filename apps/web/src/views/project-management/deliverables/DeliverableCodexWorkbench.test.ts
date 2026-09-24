import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DeliverableCodexWorkbench", () => {
  it("reports the bound conversation after creating a task-startup conversation", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain("onConversationCreated?.(payload.conversation.id)");
  });

  it("shows a first-binding card with scope, available MCP tools, and AI rules before the first turn", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./DeliverableCodexWorkbench.css", import.meta.url), "utf8");
    expect(source).toContain("function resourceBindingInfo");
    expect(source).toContain("const showBindingInfo = Boolean(active && messages[active.id] && displayedMessages.length === 0)");
    expect(source).toContain("首次绑定说明");
    expect(source).toContain("整体信息");
    expect(source).toContain("可用 MCP");
    expect(source).toContain("AI 操作规定");
    expect(source).toContain("rich_mindmap_manage");
    expect(source).toContain("rich_flowchart_manage");
    expect(source).toContain("rich_deliverable_get");
    expect(css).toContain(".deliverable-codex-workbench__binding-card>p");
  });

  it("labels mindmap Codex conversations with the mindmap prefix, including existing bindings", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain("function displayConversationTitle");
    expect(source).toContain('`[思维导图] ${conversation.title}`');
    expect(source).toContain("displayConversationTitle(conversation, resourceType)");
    expect(source).toContain("displayConversationTitle(active, resourceType)");
  });

  it("sends each newly assigned bug prompt even while another Codex conversation is streaming", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain("if (startup?.prompt) void sendMessage(payload.conversation, startup.prompt, [], false, undefined, true);");
  });

  it("marks a bug for redeployment only when the conversation requests deployment or restart", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain('gitDeployLatest: shouldRedeployLatestApp(draft)');
  });

  it("uses the native context menu for selected message text", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./DeliverableCodexWorkbench.css", import.meta.url), "utf8");
    expect(source).not.toContain("openMessageContextMenu");
    expect(source).not.toContain("messageContextMenu");
    expect(css).not.toContain("message-context-menu");
  });

  it("copies selected message text before the whole message", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain("function selectedTextInMessage");
    expect(source).toContain("copyMessage(selectedText || message.content)");
    expect(source).toContain("document.execCommand(\"copy\")");
  });

  it("keeps the actual duration after an assistant reply completes", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain("const startedAt = Date.now();");
    expect(source).toContain("const durationMs = Date.now() - startedAt;");
    expect(source).not.toContain("const durationMs = 1_000;");
  });

  it("keeps the Codex reply status visible beside the composer", () => {
    const css = readFileSync(new URL("./DeliverableCodexWorkbench.css", import.meta.url), "utf8");
    expect(css).toContain(".deliverable-codex-workbench__turn-status { display:flex;");
    expect(css).not.toContain(".deliverable-codex-workbench__turn-status { display:none; }");
  });

  it("does not pull a reader back to the bottom when background message polling refreshes", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain("const shouldFollowMessagesRef = useRef(true)");
    expect(source).toContain("const isNearMessagesBottom");
    expect(source).toContain("onScroll={updateMessageFollowState}");
    expect(source).toContain("shouldFollowMessagesRef.current = isNearMessagesBottom(element)");
    expect(source).toContain("if (visible && element && shouldFollowMessagesRef.current)");
    expect(source).not.toContain("if (visible && element) element.scrollTop = element.scrollHeight;");
  });

  it("creates an immutable-mode conversation and provides archive rather than a tab close action", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain('type Mode = "free"');
    expect(source).toContain('role="menuitem" onClick={() => { setConversationMenuOpen(false); void archive(); }}');
    expect(source).toContain('setCreating(current => !current)');
    expect(source).toContain('setTitle("")');
    expect(source).not.toContain("关闭会话");
    expect(source).not.toContain("BUG 模式");
    expect(source).toContain('type TaskMode = { id: string; label: string; hint: string }');
  });

  it("puts the current Rich view location in the composer only when the location button is used", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).not.toContain('className="deliverable-codex-workbench__scope"');
    expect(source).toContain("function currentPageLocation(appView: string): string[]");
    expect(source).toContain("formatCodexLocationContext({");
    expect(source).toContain('business: { kind: "交付物", id: deliverableId, title: deliverableTitle }');
    expect(source).toContain('locationContext ? `${locationContext}\\n\\n${draft}` : draft');
    expect(source).toContain('.filter(message => message.role !== "system" || message.kind === "task-mode-started" || message.kind === "task-mode-policy-updated")');
    expect(source).toContain('aria-label="打开附加功能"');
    expect(source).toContain('role="menuitem"');
    expect(source).toContain("<b>添加</b>");
    expect(source).toContain('className="is-file"');
    expect(source).toContain('className="is-location"');
    expect(source).toContain("composerFilePickerRef.current?.click()");
    expect(source).toContain('document.addEventListener("pointerdown", close)');
    expect(source).toContain('ref={composerMenuRef}');
    expect(source).toContain("定位 <small>附加页面和业务定位</small>");
    expect(source).toContain("页面定位");
    expect(source).toContain("业务定位");
    const css = readFileSync(new URL("./DeliverableCodexWorkbench.css", import.meta.url), "utf8");
    expect(css).toContain(".deliverable-codex-workbench__composer { position:relative;");
    expect(css).toContain("bottom:calc(100% + 10px)");
    expect(css).toContain("width:238px");
    expect(css).toContain("i.is-location::before");
    expect(css).toContain("background:var(--cw-panel-raised)");
  });

  it("uses a left conversation list and persists title edits", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain('className="deliverable-codex-workbench__sidebar"');
    expect(source).toContain('＋ 新对话');
    expect(source).not.toContain('>取消</button>');
    expect(source).toContain('aria-label="会话标题"');
    expect(source).toContain('onDoubleClick={() => { if (active) setEditingTitle(true); }}');
    expect(source).toContain('title="双击编辑标题"');
    expect(source).toContain('aria-label="更多会话操作"');
    expect(source).toContain('setConversationMenuOpen(false); setEditingTitle(true);');
    expect(source).toContain(">重命名</button><button");
    expect(source).toContain('document.addEventListener("pointerdown", close)');
    expect(source).toContain('ref={conversationMenuRef}');
    expect(source).toContain('role="menuitem" onClick={() => { setConversationMenuOpen(false); void archive(); }}');
    expect(source).toContain('method: "PATCH"');
    expect(source).toContain('"/api/deliverable-codex/conversations"');
    expect(source).toContain('const conversationOrderStorageKey = "rich.deliverable-codex.conversation-order"');
    expect(source).toContain("draggable type=\"button\"");
    expect(source).toContain('onDrop={event =>');
    expect(source).toContain("saveConversationOrder(next)");
  });

  it("marks only the disconnected conversation with a flashing red outline", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./DeliverableCodexWorkbench.css", import.meta.url), "utf8");
    expect(source).toContain("const [lostConversationIds, setLostConversationIds] = useState<Set<string>>(() => new Set())");
    expect(source).toContain("setLostConversationIds(current => new Set(current).add(target.id))");
    expect(source).toContain('" is-connection-lost"');
    expect(css).toContain(".deliverable-codex-workbench__sidebar nav button.is-connection-lost");
    expect(css).toContain("animation:deliverable-codex-connection-lost");
  });

  it("clears transient errors when switching conversations or after a brief display", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain("useEffect(() => { setError(\"\"); }, [activeId]);");
    expect(source).toContain("const timeout = window.setTimeout(() => setError(\"\"), 3_000);");
    expect(source).toContain("return () => window.clearTimeout(timeout);");
  });

  it("shows message content without sender-name labels", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./DeliverableCodexWorkbench.css", import.meta.url), "utf8");
    expect(source).not.toContain('message.role === "user" ? "你" : "Codex"');
    expect(source).toContain('event.key === "Enter" && !event.shiftKey');
    expect(source).toContain("event.preventDefault(); queueOrSend();");
    expect(css).toContain(".deliverable-codex-workbench__messages article { width:100%; max-width:760px; padding:0;");
    expect(css).not.toContain(".deliverable-codex-workbench__messages article { max-width:76%; border-radius:10px;");
    expect(css).toContain("-webkit-app-region:no-drag; user-select:text; -webkit-user-select:text;");
    expect(css).toContain(".deliverable-codex-workbench__messages p { margin:0; white-space:pre-wrap; line-height:1.65; user-select:text;");
  });

  it("renders persisted assistant image attachments as expandable previews", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./DeliverableCodexWorkbench.css", import.meta.url), "utf8");
    expect(source).toContain('className="deliverable-codex-workbench__message-images"');
    expect(source).toContain('alt={message.role === "assistant" ? "Codex 生成图片" : "已发送图片"}');
    expect(source).toContain("onClick={() => setPreviewUrl");
    expect(source).toContain("void loadMessages(target.id)");
    expect(css).toContain(".deliverable-codex-workbench__message-images");
    expect(css).toContain("max-width:min(100%,560px)");
  });

  it("keeps the composer in the bottom grid row when the create form is closed", () => {
    const css = readFileSync(new URL("./DeliverableCodexWorkbench.css", import.meta.url), "utf8");
    expect(css).toContain(".deliverable-codex-workbench__composer { position:relative; grid-row:5;");
    expect(css).toContain(".deliverable-codex-workbench__messages { grid-row:3;");
  });

  it("queues new prompts while a response is streaming and lets the user manage them", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./DeliverableCodexWorkbench.css", import.meta.url), "utf8");
    expect(source).toContain("const [queuedMessages, setQueuedMessages]");
    expect(source).toContain("const queueOrSend");
    expect(source).toContain('aria-label="排队消息"');
    expect(source).toContain("中断当前回复并调整");
    expect(source).toContain("移到队首");
    expect(css).toContain(".deliverable-codex-workbench__queue { grid-row:4;");
  });

  it("interrupts the active Codex turn and sends an adjustment in the same conversation", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain("const interruptAndSend = async");
    expect(source).toContain('/conversations/${encodeURIComponent(message.conversation.id)}/interrupt');
    expect(source).toContain('void interruptAndSend(message)');
  });

  it("defaults to a dark Codex-style theme and lets the user choose another saved theme", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./DeliverableCodexWorkbench.css", import.meta.url), "utf8");
    expect(source).toContain('type Theme = "obsidian" | "graphite"');
    expect(source).toContain('const themeStorageKey = "rich.deliverable-codex.theme"');
    expect(source).toContain('is-theme-${theme}');
    expect(source).toContain('aria-label="选择主题"');
    expect(source).toContain('title="主题"');
    expect(source).not.toContain(">◐ 主题</button>");
    expect(source).toContain("曜黑");
    expect(source).toContain("石墨灰");
    expect(css).toContain("--cw-shell:#09090a");
    expect(css).toContain("box-shadow:0 0 0 1px rgb(255 255 255 / .22)");
    expect(css).toContain(".deliverable-codex-workbench.is-theme-graphite");
  });

  it("keeps the bright border when the workbench is maximized", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).not.toContain('border: 0, borderRadius: 0, boxShadow: "none"');
  });

  it("opens a Codex tool chooser from a leading slash in the composer", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("./DeliverableCodexWorkbench.css", import.meta.url), "utf8");
    expect(source).toContain('parseCodexSlashInput(input)');
    expect(source).toContain('filterCodexSlashTools(codexSlash.query)');
    expect(source).toContain('aria-label="Codex 工具列表"');
    expect(source).toContain('if (tool.id === "image") composerFilePickerRef.current?.click()');
    expect(source).toContain('if (tool.id === "location") setLocationAttached(true)');
    expect(source).toContain('if (tool.id === "location-screenshot") void attachCurrentViewScreenshot()');
    expect(source).toContain('if (tool.id === "task-mode") {');
    expect(source).toContain('setTaskModePickerOpen(true)');
    expect(source).toContain('content: "任务模式已启动"');
    expect(source).toContain('kind: "task-mode-started"');
    expect(source).toContain('readJson<{ instruction: string }>(');
    expect(source).toContain("await sendMessage(active, payload.instruction, [], false, session, true)");
    expect(source).toContain('taskMode ? "task-mode-instruction" : undefined');
    expect(source).toContain('className="deliverable-codex-workbench__instruction-card"');
    expect(source).toContain('const startedAt = new Date().toISOString()');
    expect(source).toContain('const displayedMessages: Message[] = active');
    expect(source).toContain('/events/task-mode-started');
    expect(source).not.toContain('taskModeLabel: activeTaskMode.label, content: "任务模式已启动"');
    expect(source).toContain('className="deliverable-codex-workbench__event-card"');
    expect(source).toContain('任务模式已启动');
    expect(source).toContain('<RichContent text={message.content}/>');
    expect(source).toContain('当前页面没有可用的任务模式');
    expect(source).toContain('window.addEventListener("keydown", handleTaskModeKey, true)');
    expect(source).toContain('const taskModeStorageKey = "rich.deliverable-codex.task-modes"');
    expect(source).toContain('const taskModeAvailable = true');
    expect(source).toContain('[generalTaskMode, ...deliverableTaskModes] : [generalTaskMode]');
    expect(source).toContain('if (!active || !mode || !taskModeAvailable)');
    expect(source).toContain('type TaskModeSession = TaskMode & { location: CodexLocationContextInput; startedAt: string }');
    expect(source).toContain('page: currentPageLocation(appView)');
    expect(source).toContain('任务模式：{activeTaskMode.label}');
    expect(source).toContain('activeTaskMode.id === "general-task" ? "任务：" : "交付物："');
    expect(source).toContain('requestDeliverableItemFocus(location.project.id, location.business.id)');
    expect(source).toContain('window.requestAnimationFrame(() => requestDeliverableItemFocus');
    expect(source).toContain('requestShortcutOpen({ kind: "project", id: location.project.id })');
    expect(source).toContain('setAppView("projects")');
    expect(source).toContain('className={`deliverable-codex-workbench is-theme-${theme}${activeTaskMode ? " is-task-mode" : ""}');
    expect(source).toContain('className="deliverable-codex-workbench__task-mode-bar"');
    expect(css).toContain('.deliverable-codex-workbench__tool-menu');
    expect(css).toContain('.deliverable-codex-workbench.is-task-mode .deliverable-codex-workbench__sidebar nav button.is-active');
    expect(css).toContain('.deliverable-codex-workbench.is-task-mode .deliverable-codex-workbench__composer');
    expect(css).toContain('.deliverable-codex-workbench__instruction-card');
    expect(css).toContain('.deliverable-codex-workbench__tabs>button { margin-left:auto; }');
  });

  it("closes the task-mode picker before waiting for Codex to receive its startup context", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    const start = source.indexOf("const startTaskMode = async");
    const end = source.indexOf("  const jumpToTaskBusiness", start);
    const startTaskMode = source.slice(start, end);
    expect(startTaskMode.indexOf("setTaskModePickerOpen(false)")).toBeLessThan(startTaskMode.indexOf("await readJson"));
  });

  it("sends task-mode startup context even when a stale local streaming marker remains", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain("clearComposer: boolean, taskMode?: TaskModeSession, force = false");
    expect(source).toContain("if (streamingRef.current && !force) return;");
    expect(source).toContain("await sendMessage(active, payload.instruction, [], false, session, true);");
  });

  it("shows Codex turn completion status for every conversation", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain("const [runningByConversation, setRunningByConversation]");
    expect(source).toContain("/status");
    expect(source).toContain("Codex 正在回复…");
    expect(source).toContain("Codex 已完成，可继续提问");
  });

  it("uses a stop action instead of queueing while Codex is replying", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain("const interruptCurrentTurn");
    expect(source).toContain('className="deliverable-codex-workbench__turn-stop"');
    expect(source).toContain('aria-label="停止回复"');
    expect(source).toContain('onClick={() => void interruptCurrentTurn()}');
    expect(source).toContain('if (isResponding) return;');
  });

  it("lets the user ask Codex to reformat an existing long reply", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain("const reformatAssistantMessage");
    expect(source).toContain("整理排版");
    expect(source).toContain("不重新研究、不新增事实、不改变链接、路径、代码或结论");
  });

  it("focuses the composer input whenever the Codex dialog opens", () => {
    const source = readFileSync(new URL("./DeliverableCodexWorkbench.tsx", import.meta.url), "utf8");
    expect(source).toContain("composerTextareaRef.current?.focus()");
    expect(source).not.toContain("workbenchRef.current?.focus()");
  });
});
