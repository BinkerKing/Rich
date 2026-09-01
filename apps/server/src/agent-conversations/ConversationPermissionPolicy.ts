import type { AgentPermissionProfile } from "../repos/AgentConversationConfigRepo.js";
import type { AgentRuntimeCapabilities } from "./types.js";

export function assertRuntimeProfileSupported(
  capabilities: AgentRuntimeCapabilities,
  profile: AgentPermissionProfile,
): void {
  if (!capabilities.profiles.includes(profile)) {
    throw new Error(`Capability profile unavailable: ${profile}`);
  }
  if (profile !== "chat_only" && (
    !capabilities.enforcesToolSelection
    || !capabilities.enforcesWorkspaceRoot
    || !capabilities.supportsResumableToolCalls
  )) {
    throw new Error(`Capability profile unavailable: ${profile}`);
  }
}
