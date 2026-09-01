import { randomUUID } from "node:crypto";
import type { AiTaskContextSnapshot, AiTaskExecutor, AiTaskProfile, AiTaskRequest } from "../ai-tasks/types.js";
import type { ChatAttachmentsRepo } from "../repos/ChatAttachmentsRepo.js";
import type { ChatConversationsRepo } from "../repos/ChatConversationsRepo.js";

export interface ConversationPromotionInput {
  conversationId: string;
  scenario: string;
  target: { projectId: string; deliverableId: string };
  selectedMessageIds: string[];
  selectedAttachmentIds?: string[];
  executor: AiTaskExecutor;
  profile?: AiTaskProfile;
  instructions: string;
  acceptanceCriteria?: string[];
}

interface PendingPromotion { request: AiTaskRequest; publishing: boolean }

export class ConversationPromotionService {
  private readonly pending = new Map<string, PendingPromotion>();

  constructor(
    private readonly conversations: ChatConversationsRepo,
    private readonly attachments: ChatAttachmentsRepo | null,
    private readonly createContext: (projectId: string, deliverableId: string) => Promise<AiTaskContextSnapshot>,
    private readonly publishTask: (request: AiTaskRequest) => Promise<unknown>,
    private readonly validateTask: (request: unknown) => AiTaskRequest = request => request as AiTaskRequest,
    private readonly assertScenario: (scenario: string) => void = scenario => {
      if (scenario !== "deliverable_analysis") throw new Error(`Unknown task scenario: ${scenario}.`);
    },
  ) {}

  async preview(input: ConversationPromotionInput): Promise<{ confirmationToken: string; request: AiTaskRequest }> {
    this.assertScenario(input.scenario);
    const selectedIds = [...new Set(input.selectedMessageIds)];
    if (selectedIds.length === 0) throw new Error("At least one conversation message must be selected.");
    const allMessages = await this.conversations.listMessages(input.conversationId, await this.conversations.countMessages(input.conversationId));
    const byId = new Map(allMessages.map(message => [message.id, message]));
    const selectedMessages = selectedIds.map(id => byId.get(id));
    if (selectedMessages.some(message => !message)) throw new Error("A selected message does not belong to this conversation.");

    const selectedAttachmentIds = [...new Set(input.selectedAttachmentIds ?? [])];
    const attachmentRefs = await Promise.all(selectedAttachmentIds.map(async id => {
      const attachment = await this.attachments?.get(id);
      if (!attachment || !attachment.messageId || !selectedIds.includes(attachment.messageId)) {
        throw new Error("A selected attachment does not belong to the selected messages.");
      }
      return {
        id: attachment.id, messageId: attachment.messageId, kind: attachment.kind, mime: attachment.mime,
        sizeBytes: attachment.sizeBytes, caption: attachment.caption, sha256: attachment.sha256,
      };
    }));
    const summary = await this.conversations.getSummary(input.conversationId);
    const base = await this.createContext(input.target.projectId, input.target.deliverableId);
    const request: AiTaskRequest = {
      scenario: input.scenario,
      projectId: input.target.projectId,
      deliverableId: input.target.deliverableId,
      executor: input.executor,
      profile: input.profile ?? "analysis",
      instructions: input.instructions,
      acceptanceCriteria: input.acceptanceCriteria ?? [],
      contextSnapshot: {
        ...base,
        sourceConversationId: input.conversationId,
        conversationSummary: summary?.summary,
        selectedMessages: selectedMessages.map(message => ({ id: message!.id, role: message!.role, content: message!.content, createdAt: message!.createdAt })),
        attachmentRefs,
      },
      promotion: { sourceConversationId: input.conversationId, selectedMessageIds: selectedIds, selectedAttachmentIds },
    };
    const validated = this.validateTask(request);
    const confirmationToken = randomUUID();
    this.pending.set(confirmationToken, { request: structuredClone(validated), publishing: false });
    return { confirmationToken, request: structuredClone(validated) };
  }

  async publish(confirmationToken: string): Promise<unknown> {
    const pending = this.pending.get(confirmationToken);
    if (!pending || pending.publishing) throw new Error("Promotion preview is missing, expired, or already used.");
    pending.publishing = true;
    try {
      const task = await this.publishTask(structuredClone(pending.request));
      this.pending.delete(confirmationToken);
      return task;
    } catch (error) {
      pending.publishing = false;
      throw error;
    }
  }
}
