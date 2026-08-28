import { RichMcpError } from "../registry/errors.js";
import type { WorkDelegationPort, WorkDelegationReceipt, WorkDelegationRequest, WorkDelegationStatus } from "./WorkDelegationPort.js";

export class UnavailableDelegationAdapter implements WorkDelegationPort {
  readonly backend = "unavailable";
  constructor(private readonly reason = "No work delegation adapter is configured.") {}

  async delegate(_request: WorkDelegationRequest): Promise<WorkDelegationReceipt> { throw this.error(); }
  async getStatus(_externalTaskId: string): Promise<WorkDelegationStatus> { throw this.error(); }
  async cancel(_externalTaskId: string): Promise<void> { throw this.error(); }

  private error(): RichMcpError {
    return new RichMcpError("DEPENDENCY_UNAVAILABLE", this.reason, { retryable: true });
  }
}
