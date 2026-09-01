import { randomUUID } from "node:crypto";
import type { AiTaskContextSnapshot, AiTaskExecutor, AiTaskProfile, AiTaskRequest } from "../ai-tasks/types.js";
import type { ChatAttachmentsRepo } from "../repos/ChatAttachmentsRepo.js";
import type { ChatConversationsRepo } from "../repos/ChatConversationsRepo.js";
import { DeliverableAnalysisScenario } from "../agent-scenarios/deliverableAnalysisScenario.js";
import { ScenarioRegistry } from "../agent-scenarios/ScenarioRegistry.js";

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
export interface SaveToRichInput {
  conversationId: string;
  destination: { projectId: string; moduleKey: string; title: string };
  content: Record<string, unknown>;
}
interface PendingSave { input: SaveToRichInput; publishing: boolean }

export class ConversationPromotionService {
  private readonly pending = new Map<string, PendingPromotion>();
  private readonly pendingSaves = new Map<string, PendingSave>();

  constructor(
    private readonly conversations: ChatConversationsRepo,
    private readonly attachments: ChatAttachmentsRepo | null,
    private readonly createContext: (projectId: string, deliverableId: string) => Promise<AiTaskContextSnapshot>,
    private readonly publishTask: (request: AiTaskRequest) => Promise<unknown>,
    private readonly validateTask: (request: unknown) => AiTaskRequest = request => request as AiTaskRequest,
    private readonly assertScenario: (scenario: string) => void = scenario => new ScenarioRegistry([new DeliverableAnalysisScenario()]).get(scenario),
    private readonly saveToRich?: (input: SaveToRichInput) => Promise<unknown>,
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

  async previewSave(input: SaveToRichInput): Promise<{ confirmationToken: string; action: SaveToRichInput }> {
    if (!this.saveToRich) throw new Error("Save to Rich is unavailable.");
    if (!input.conversationId || !input.destination.projectId || !input.destination.moduleKey || !input.destination.title.trim()) {
      throw new Error("A conversation and exact Rich destination are required.");
    }
    const confirmationToken = randomUUID();
    const action = structuredClone(input);
    this.pendingSaves.set(confirmationToken, { input: action, publishing: false });
    return { confirmationToken, action: structuredClone(action) };
  }

  async publishSave(confirmationToken: string): Promise<unknown> {
    const pending = this.pendingSaves.get(confirmationToken);
    if (!pending || pending.publishing) throw new Error("Save preview is missing, expired, or already used.");
    if (!this.saveToRich) throw new Error("Save to Rich is unavailable.");
    pending.publishing = true;
    try {
      const result = await this.saveToRich(structuredClone(pending.input));
      this.pendingSaves.delete(confirmationToken);
      return result;
    } catch (error) {
      pending.publishing = false;
      throw error;
    }
  }
}
