import { useEffect, useState } from "react";
import { requirementFields, type WorkbenchRequirementVersion } from "@ke/domain";

import { RequirementDocument } from "./RequirementDocument.js";

const labels = { title: "需求标题", requirement: "当前理解", acceptance: "完成条件", openQuestions: "尚待明确", outputTarget: "交付目标", prd: "PRD 正文" };
export function RequirementHistory({ taskId, version, confirmed }: { taskId: string; version: number; confirmed: boolean }) {
  const [versions, setVersions] = useState<WorkbenchRequirementVersion[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/workbench/${taskId}/requirement-history`, { signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "读取变更记录失败");
      if (!controller.signal.aborted) { setVersions(data.versions); setError(""); }
    }).catch(reason => { if (!controller.signal.aborted) setError(String(reason)); });
    return () => controller.abort();
  }, [taskId, version]);
  if (error) return <p className="tw-error-text" role="alert">{error}</p>;
  if (!versions) return <p className="tw-empty-note">正在读取变更记录…</p>;
  return <section className="tw-requirement-history" aria-label="需求变更记录">
    <p className="tw-empty-note">{!versions.length ? "当前需求尚未确认，确认后生成需求 v1。草稿调整不计入变更记录。" : !confirmed ? `需求调整中，等待确认。再次确认后生成需求 v${versions.length + 1}，以下保留已确认版本。` : versions.length > 1 ? `已确认 ${versions.length} 个需求版本，展开查看版本间的变更。` : "需求 v1 已确认，暂无后续变更。"}</p>
    {versions.map((current, index) => {
      const previous = versions[index - 1];
      const fields = requirementFields.filter(field => previous ? previous[field] !== current[field] : current[field]);
      return <details key={current.version}>
        <summary><span>{previous ? fields.map(field => labels[field]).join("、") || "重新确认（内容未变）" : "首次确认"}</span><small>需求 v{current.version} · {new Date(current.updatedAt).toLocaleString("zh-CN")}</small></summary>
        {previous && <p className="tw-prd-change"><b>本版改动：</b>{current.requirementChangeSummary || fields.map(field => labels[field]).join("、") || "重新确认，内容未变"}</p>}
        <RequirementDocument task={current} />
      </details>;
    }).reverse()}
  </section>;
}
