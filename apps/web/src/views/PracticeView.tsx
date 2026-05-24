import { useState, type ReactNode } from "react";
import { PracticeListView } from "./PracticeListView.js";
import { PracticeWorkspace } from "./PracticeWorkspace.js";
import "./PracticeView.css";

/**
 * 项目实战 顶级视图入口。
 * - 无 selectedId：列表页（所有 practice 元素的卡片）
 * - 有 selectedId：进入工作空间（3 个 tab：总览 / 拆解 / 效果图）
 */
export function PracticeView(): ReactNode {
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);

  if (selectedPracticeId) {
    return (
      <PracticeWorkspace
        practiceId={selectedPracticeId}
        onBack={() => setSelectedPracticeId(null)} />
    );
  }

  return <PracticeListView onPickPractice={setSelectedPracticeId} />;
}
