import { useEffect, useState, type ReactNode } from "react";
import { DeliverableCodexWorkbench } from "./DeliverableCodexWorkbench.js";
import type { CodexInitialAttachment } from "../../../lib/aiTaskCodexContext.js";

export type DeliverableCodexTarget = {
  projectId: string;
  deliverableId: string;
  deliverableTitle: string;
  resourceType?: "deliverable" | "flowchart" | "mindmap" | "deepmindmap" | "dictionary" | "report";
  conversationId?: string;
  initialPrompt?: string;
  initialAttachments?: CodexInitialAttachment[];
  executionTaskId?: string;
  initialConversationTitle?: string;
  onConversationCreated?: (conversationId: string) => void;
};

declare global {
  interface Window {
    __richOpenBoundCodex?: (target: DeliverableCodexTarget) => void;
    __richCloseBoundCodex?: () => void;
  }
}

const targetStorageKey = "rich.deliverable-codex.target";
const toggleEvent = "rich:toggle-deliverable-codex";
const closeEvent = "rich:close-deliverable-codex";
const openEvent = "rich:open-bound-codex";
const closeAiTaskCaptureEvent = "rich:close-ai-task-capture";
const generalTarget: DeliverableCodexTarget = {
  projectId: "__general__",
  deliverableId: "__general__",
  deliverableTitle: "通用任务",
};

function isValidTarget(value: unknown): value is DeliverableCodexTarget {
  if (!value || typeof value !== "object") return false;
  const target = value as Partial<DeliverableCodexTarget>;
  return typeof target.projectId === "string" && target.projectId.trim().length > 0
    && typeof target.deliverableId === "string" && target.deliverableId.trim().length > 0
    && typeof target.deliverableTitle === "string" && target.deliverableTitle.trim().length > 0;
}

function normalizeTarget(target?: DeliverableCodexTarget): DeliverableCodexTarget {
  return isValidTarget(target) ? target : generalTarget;
}

export function openBoundCodex(target?: DeliverableCodexTarget) {
  const next = normalizeTarget(target);
  setDeliverableCodexTarget(next);
  if (window.__richOpenBoundCodex) {
    window.__richOpenBoundCodex(next);
    return;
  }
  window.dispatchEvent(new CustomEvent(openEvent, { detail: next }));
}

function readTarget(): DeliverableCodexTarget | undefined {
  try {
    const value = JSON.parse(window.localStorage.getItem(targetStorageKey) ?? "null");
    if (isValidTarget(value)) return value;
    window.localStorage.removeItem(targetStorageKey);
    return undefined;
  } catch {
    return undefined;
  }
}

export function setDeliverableCodexTarget(target: DeliverableCodexTarget) {
  window.localStorage.setItem(targetStorageKey, JSON.stringify(normalizeTarget(target)));
}

export function showDeliverableCodex(target: DeliverableCodexTarget) {
  const next = normalizeTarget(target);
  setDeliverableCodexTarget(next);
  window.dispatchEvent(new CustomEvent<DeliverableCodexTarget>(toggleEvent, { detail: next }));
}

export function closeDeliverableCodex() {
  if (window.__richCloseBoundCodex) {
    window.__richCloseBoundCodex();
    return;
  }
  window.dispatchEvent(new Event(closeEvent));
}

export function DeliverableCodexLauncher(): ReactNode {
  const [target, setTarget] = useState<DeliverableCodexTarget | undefined>(readTarget);
  const [visible, setVisible] = useState(false);
  const [openSequence, setOpenSequence] = useState(0);

  useEffect(() => {
    const openTarget = (next: DeliverableCodexTarget) => {
      setTarget(normalizeTarget(next));
      window.dispatchEvent(new Event(closeAiTaskCaptureEvent));
      setVisible(true); setOpenSequence(value => value + 1);
    };
    const open = (event: Event) => openTarget((event as CustomEvent<DeliverableCodexTarget>).detail);
    const close = () => setVisible(false);
    window.__richOpenBoundCodex = openTarget;
    window.__richCloseBoundCodex = close;
    window.addEventListener(openEvent, open);
    return () => {
      if (window.__richOpenBoundCodex === openTarget) delete window.__richOpenBoundCodex;
      if (window.__richCloseBoundCodex === close) delete window.__richCloseBoundCodex;
      window.removeEventListener(openEvent, open);
    };
  }, []);

  useEffect(() => {
    const toggle = (event: Event) => {
      const requested = (event as CustomEvent<DeliverableCodexTarget>).detail;
      const next = normalizeTarget(requested ?? readTarget());
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
    const close = () => window.__richCloseBoundCodex?.();
    window.addEventListener(closeEvent, close);
    return () => window.removeEventListener(closeEvent, close);
  }, []);

  return target ? (
    <DeliverableCodexWorkbench
      key={`${target.resourceType ?? "deliverable"}:${target.projectId}:${target.deliverableId}`}
      projectId={target.projectId}
      deliverableId={target.deliverableId}
      deliverableTitle={target.deliverableTitle}
      resourceType={target.resourceType}
      visible={visible}
      requestedConversationId={target.conversationId}
      initialPrompt={target.initialPrompt}
      initialAttachments={target.initialAttachments}
      executionTaskId={target.executionTaskId}
      initialConversationTitle={target.initialConversationTitle}
      onConversationCreated={conversationId => {
        const next: DeliverableCodexTarget = {
          projectId: target.projectId,
          deliverableId: target.deliverableId,
          deliverableTitle: target.deliverableTitle,
          resourceType: target.resourceType,
          conversationId,
        };
        setDeliverableCodexTarget(next);
        setTarget(next);
        target.onConversationCreated?.(conversationId);
      }}
      openSequence={openSequence}
    />
  ) : null;
}
