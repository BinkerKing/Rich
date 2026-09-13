/**
 * useChatComposer —— 首页和快捷键聊天框共用的"输入框 + 附件"状态机。
 *
 * 职责：
 *   - 维护已附加的图片列表（含上传中状态）
 *   - 暴露 attach(file) / detach(id) / clear() / submit()
 *   - 处理拖拽 / 粘贴 / 选择 三种入口（dropProps / pasteHandler / picker 都用 attach）
 *   - 客户端预处理（resize / EXIF strip）→ 上传 → 拿到 attachment id
 *
 * 不管：发送的实际 chat 协议（由调用方实现 send 函数）；composer 只负责附件状态。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { preprocessImage } from "./imagePreprocess.js";

export type AttachState = "uploading" | "ready" | "failed";

export interface ComposerAttachment {
  /** 客户端临时 id（上传完成后由服务端 id 覆盖；前端始终用 clientId 做 key） */
  clientId: string;
  /** 服务端返回的 attachment id —— uploading 状态下为空 */
  serverId?: string;
  state: AttachState;
  /** Object URL 用于缩略图预览（detach 时 revoke） */
  previewUrl: string;
  /** 上传后的可访问 URL（一般是 /api/chat/attachments/:id/data） */
  remoteUrl?: string;
  mime: string;
  width?: number;
  height?: number;
  sizeBytes: number;
  error?: string;
}

export interface UseChatComposerOptions {
  /** 单次最多附几张图（V0.1 = 1，V1 改 4） */
  maxAttachments?: number;
  /** 调用方在发送时拿这个 ref 数组（无图就空数组） */
  // (no onSubmit; the caller reads via getAttachmentRefs)
}

export interface UseChatComposerReturn {
  attachments: ComposerAttachment[];
  /** 上传一个 file → 进 attachments；返回 clientId */
  attach: (file: File) => Promise<string>;
  /** 删除一个附件（无论上传是否完成）。会 revoke object url */
  detach: (clientId: string) => void;
  /** 清空（发送成功后调用） */
  clear: () => void;
  /** 恢复已经上传的图片引用，用于继续编辑暂存任务。 */
  restore: (refs: Array<{ id: string; path?: string; mime?: string }>) => void;
  /** 拿到 ChatAttachmentRef[]（只取 state=ready 且 serverId 存在的） */
  getAttachmentRefs: () => Array<{ id: string; mime: string; url: string; width?: number; height?: number }>;
  /** 是否有任何上传中 —— 调用方可禁用 send */
  isUploading: boolean;
  /** 是否已达到上限 */
  isFull: boolean;
}

function newClientId(): string {
  return `cli-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function useChatComposer(opts: UseChatComposerOptions = {}): UseChatComposerReturn {
  const maxAttachments = opts.maxAttachments ?? 1;
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);

  // 卸载时只 revoke object urls 防泄漏（不再 setAttachments —— 组件已卸载，
  // 在卸载 cleanup 里 setState 会触发警告，且 Strict Mode 下双跑可能添乱）。
  // 用 ref 拿最新值。
  const attachmentsRef = useRef<ComposerAttachment[]>([]);
  attachmentsRef.current = attachments;
  useEffect(() => () => {
    attachmentsRef.current.forEach(a => {
      try { URL.revokeObjectURL(a.previewUrl); } catch { /* idempotent */ }
    });
  }, []);

  const attach = useCallback(async (file: File): Promise<string> => {
    if (!file.type.startsWith("image/")) {
      console.warn(`[composer] 不支持的文件类型: ${file.type || "未知"}`);
      return "";
    }
    // 满了 → 直接拒绝（不替换、不抛错）。前端 📎 按钮已经 disabled，
    // 拖拽 / 粘贴时若还是塞进来，就在这里默默 no-op。
    if (attachmentsRef.current.length >= maxAttachments) {
      console.warn(`[composer] 已达上限 ${maxAttachments} 张，新图被忽略`);
      return "";
    }
    const clientId = newClientId();
    let previewUrl: string;
    try {
      previewUrl = URL.createObjectURL(file);
    } catch (err) {
      console.warn("[composer] createObjectURL failed:", err);
      return "";
    }

    setAttachments(prev => {
      // 二次防御：updater 跑的时刻可能已经满（短时间内多次 attach 并发）
      if (prev.length >= maxAttachments) return prev;
      return [...prev, {
        clientId,
        state: "uploading" as AttachState,
        previewUrl,
        mime: file.type,
        sizeBytes: file.size,
      }];
    });

    // 预处理 + 上传
    try {
      const processed = await preprocessImage(file);
      const form = new FormData();
      form.append("file", new File([processed.blob], "image", { type: processed.mime }));
      if (processed.width) form.append("width", String(processed.width));
      if (processed.height) form.append("height", String(processed.height));
      const res = await fetch("/api/chat/attachments", { method: "POST", body: form });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`上传失败: ${res.status} ${errText.slice(0, 200)}`);
      }
      const meta = await res.json() as { id: string; mime: string; url: string; width?: number; height?: number; sizeBytes: number };
      setAttachments(prev => prev.map(a => a.clientId === clientId ? {
        ...a,
        state: "ready" as AttachState,
        serverId: meta.id,
        remoteUrl: meta.url,
        mime: meta.mime,
        width: meta.width,
        height: meta.height,
        sizeBytes: meta.sizeBytes,
      } : a));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAttachments(prev => prev.map(a => a.clientId === clientId
        ? { ...a, state: "failed" as AttachState, error: msg }
        : a));
    }

    return clientId;
  }, [maxAttachments]);

  const detach = useCallback((clientId: string) => {
    setAttachments(prev => {
      const target = prev.find(a => a.clientId === clientId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(a => a.clientId !== clientId);
    });
  }, []);

  const clear = useCallback(() => {
    setAttachments(prev => {
      prev.forEach(a => URL.revokeObjectURL(a.previewUrl));
      return [];
    });
  }, []);
  const restore = useCallback((refs: Array<{ id: string; path?: string; mime?: string }>) => {
    setAttachments(previous => {
      previous.forEach(item => URL.revokeObjectURL(item.previewUrl));
      return refs.slice(0, maxAttachments).map((ref, index) => {
        const url = ref.path ?? `/api/chat/attachments/${encodeURIComponent(ref.id)}/data`;
        return { clientId: `saved-${ref.id}-${index}`, serverId: ref.id, state: "ready" as AttachState, previewUrl: url, remoteUrl: url, mime: ref.mime ?? "image/png", sizeBytes: 0 };
      });
    });
  }, [maxAttachments]);

  const getAttachmentRefs = useCallback(() => {
    return attachments
      .filter(a => a.state === "ready" && a.serverId)
      .map(a => ({
        id: a.serverId!,
        mime: a.mime,
        url: a.remoteUrl ?? `/api/chat/attachments/${a.serverId}/data`,
        width: a.width,
        height: a.height,
      }));
  }, [attachments]);

  const isUploading = useMemo(
    () => attachments.some(a => a.state === "uploading"),
    [attachments],
  );
  const isFull = attachments.length >= maxAttachments;

  return { attachments, attach, detach, clear, restore, getAttachmentRefs, isUploading, isFull };
}
