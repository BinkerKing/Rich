import { useEffect, useState, type ReactNode } from "react";
import { DeliverableCodexWorkbench } from "./DeliverableCodexWorkbench.js";

export type DeliverableCodexTarget = {
  projectId: string;
  deliverableId: string;
  deliverableTitle: string;
  conversationId?: string;
  initialPrompt?: string;
  executionTaskId?: string;
  initialConversationTitle?: string;
  onConversationCreated?: (conversationId: string) => void;
};

const targetStorageKey = "rich.deliverable-codex.target";
const toggleEvent = "rich:toggle-deliverable-codex";
const closeEvent = "rich:close-deliverable-codex";
const openEvent = "rich:open-bound-codex";
const closeAiTaskCaptureEvent = "rich:close-ai-task-capture";

export function openBoundCodex(target?: DeliverableCodexTarget) {
  const next = target ?? { projectId: "__general__", deliverableId: "__general__", deliverableTitle: "通用任务" };
  setDeliverableCodexTarget(next);
  window.dispatchEvent(new CustomEvent(openEvent, { detail: next }));
}

function readTarget(): DeliverableCodexTarget | undefined {
  try {
    const value = JSON.parse(window.localStorage.getItem(targetStorageKey) ?? "null");
    return value && typeof value.projectId === "string" && typeof value.deliverableId === "string" && typeof value.deliverableTitle === "string"
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

export function setDeliverableCodexTarget(target: DeliverableCodexTarget) {
  window.localStorage.setItem(targetStorageKey, JSON.stringify(target));
}

export function showDeliverableCodex(target: DeliverableCodexTarget) {
  setDeliverableCodexTarget(target);
  window.dispatchEvent(new CustomEvent<DeliverableCodexTarget>(toggleEvent, { detail: target }));
}

export function closeDeliverableCodex() {
  window.dispatchEvent(new Event(closeEvent));
}

export function DeliverableCodexLauncher(): ReactNode {
  const [target, setTarget] = useState<DeliverableCodexTarget | undefined>(readTarget);
  const [visible, setVisible] = useState(false);
  const [openSequence, setOpenSequence] = useState(0);

  useEffect(() => {
    const open = (event: Event) => {
      setTarget((event as CustomEvent<DeliverableCodexTarget>).detail);
      window.dispatchEvent(new Event(closeAiTaskCaptureEvent));
      setVisible(true); setOpenSequence(value => value + 1);
    };
    window.addEventListener(openEvent, open);
    return () => window.removeEventListener(openEvent, open);
  }, []);

  useEffect(() => {
    const toggle = (event: Event) => {
      const requested = (event as CustomEvent<DeliverableCodexTarget>).detail;
      const next = requested?.projectId ? requested : readTarget() ?? { projectId: "__general__", deliverableId: "__general__", deliverableTitle: "通用任务" };
      if (!next) return;
      setTarget(next);
      setVisible(current => {
        const visible = !current;
        if (visible) window.dispatchEvent(new Event(closeAiTaskCaptureEvent));
        return visible;
      });
    };
    window.addEventListener(toggleEvent, toggle);
    return () => window.removeEventListener(toggleEvent, toggle);
  }, []);
  useEffect(() => {
    const close = () => setVisible(false);
    window.addEventListener(closeEvent, close);
    return () => window.removeEventListener(closeEvent, close);
  }, []);

  return target ? (
    <DeliverableCodexWorkbench
      projectId={target.projectId}
      deliverableId={target.deliverableId}
      deliverableTitle={target.deliverableTitle}
      visible={visible}
      requestedConversationId={target.conversationId}
      initialPrompt={target.initialPrompt}
      executionTaskId={target.executionTaskId}
      initialConversationTitle={target.initialConversationTitle}
      onConversationCreated={target.onConversationCreated}
      openSequence={openSequence}
    />
  ) : null;
}
