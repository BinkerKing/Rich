import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AiTaskCapture.tsx", import.meta.url), "utf8");

describe("AiTaskCapture task list", () => {
  it("uses the active project-management menu in the quick task location", () => {
    expect(source).toContain('document.querySelector<HTMLElement>(".prj-ws__nav-btn[aria-selected=\\"true\\"]")');
    expect(source).toContain('return menu ? `${root} / ${menu}` : root;');
  });

  it("places a red BUG label and location before the task title", () => {
    expect(source).toContain('const taskListGridColumns = "64px 150px minmax(0, 1fr) 88px 72px 112px"');
    expect(source).toContain("<span>定位</span><span>任务</span>");
    expect(source).toContain('task.sceneId === "bug_fix" ? "#ff6269"');
  });

  it("offers inline accept and continue actions before a completed Rich Codex bug's bound conversation", () => {
    expect(source).toContain('aria-label="验收完成"');
    expect(source).toContain('aria-label="继续处理"');
    expect(source).toContain("api.resolveAiManagedTask(task.id)");
    expect(source).toContain("api.continueAiManagedTask(task.id)");
    expect(source).toContain('task.status !== "needs_review" && task.claimedBy === "Rich·Codex" && task.sourceConversationId');
  });

  it("keeps pending claim as a status and uses the operation column for Rich Codex or its bound conversation", () => {
    expect(source).toContain('<small style={{ color: task.status === "draft" ? "#d7aa55" : "#aab6ba" }}>{taskStatusLabel[task.status]}</small>');
    expect(source).toContain('>Rich · Codex</button>');
    expect(source).toContain('>对话框</button>');
    expect(source).toContain('conversationId: task.sourceConversationId');
  });

  it("reopens the original Rich Codex conversation instead of creating a continuation task", () => {
    expect(source).toContain('if (action === "continue" && task.claimedBy === "Rich·Codex" && task.sourceConversationId)');
    expect(source).toContain('openBoundCodex({ projectId: "__general__", deliverableId: "__general__", deliverableTitle: "Rich BUG 任务", conversationId: task.sourceConversationId });');
  });

  it("records bug tasks without a redeploy request by default", () => {
    expect(source).toContain('gitDeployLatest: false');
  });

  it("opens in list mode with an empty search field and archives an accepted Rich Codex conversation", () => {
    expect(source).toContain('const [listMode, setListMode] = useState(true)');
    expect(source).toContain('const [text, setText] = useState("")');
    expect(source).toContain('`/api/deliverable-codex/conversations/${encodeURIComponent(task.sourceConversationId)}/archive`');
  });

  it("keeps the executor column visible and makes the recorded location navigable", () => {
    expect(source).toContain('minmax(0, 1fr) 88px 72px 112px');
    expect(source).toContain('title={`跳转至 ${taskPageLocation(task)}`}');
    expect(source).toContain('if (location.startsWith("项目管理")) setAppView("projects")');
  });
});
