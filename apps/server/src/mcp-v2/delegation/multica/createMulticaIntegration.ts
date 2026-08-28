import type { WorkDelegationPort } from "../WorkDelegationPort.js";
import { RichMcpError } from "../../registry/errors.js";
import type { ExecutionTeamAdministrationPort } from "../../scenarios/manageExecutionTeam.js";
import type { MulticaBindingRepo } from "./MulticaBindingRepo.js";
import { MulticaAdministrationService } from "./MulticaAdministrationService.js";
import { MulticaCliAdapter } from "./MulticaCliAdapter.js";
import { MulticaCommandRunner } from "./MulticaCommandRunner.js";
import { MulticaProjectWorkbenchService } from "./MulticaProjectWorkbenchService.js";
import { discoverMulticaExecutable, parseSupportedMulticaVersion } from "./MulticaExecutableDiscovery.js";
import { multicaCliConfigFromEnv } from "./config.js";
import type { MulticaCommandPort } from "./types.js";
import type { MulticaWorkbenchSnapshotRepo } from "./MulticaWorkbenchSnapshotRepo.js";

interface IntegrationOptions {
  commands?: MulticaCommandPort;
  discoverExecutable?: () => string;
  env?: NodeJS.ProcessEnv;
  snapshots?: MulticaWorkbenchSnapshotRepo;
  syncIntervalMs?: number;
}

export interface MulticaIntegration {
  commands: MulticaCommandPort;
  executionTeams: ExecutionTeamAdministrationPort;
  delegationAdapter: WorkDelegationPort;
  workbench: MulticaProjectWorkbenchService;
}

export function createMulticaIntegration(
  bindings: MulticaBindingRepo,
  options: IntegrationOptions = {},
): MulticaIntegration {
  const commands = options.commands ?? new LazyMulticaCommandPort(
    options.discoverExecutable ?? discoverMulticaExecutable,
    options.env ?? process.env,
  );
  return {
    commands,
    executionTeams: new MulticaAdministrationService(commands, bindings),
    delegationAdapter: new MulticaCliAdapter(commands, bindings),
    workbench: new MulticaProjectWorkbenchService(commands, bindings, {
      snapshots: options.snapshots,
      syncIntervalMs: options.syncIntervalMs,
    }),
  };
}

class LazyMulticaCommandPort implements MulticaCommandPort {
  private runnerPromise?: Promise<MulticaCommandRunner>;

  constructor(
    private readonly discoverExecutable: () => string,
    private readonly env: NodeJS.ProcessEnv,
  ) {}

  async runJson<T = unknown>(args: string[], options?: { stdin?: string; includeWorkspace?: boolean }): Promise<T> {
    try {
      return await (await this.runner()).runJson<T>(args, options);
    } catch (error) {
      if (error instanceof RichMcpError) throw error;
      throw new RichMcpError("TASK_FAILED", `Multica CLI ${args.slice(0, 2).join(" ")} failed.`, {
        retryable: true,
        details: { cause: error instanceof Error ? error.message : "Unknown Multica CLI failure" },
      });
    }
  }

  async runText(args: string[], options?: { stdin?: string; includeWorkspace?: boolean }): Promise<string> {
    try {
      return await (await this.runner()).runText(args, options);
    } catch (error) {
      if (error instanceof RichMcpError) throw error;
      throw new RichMcpError("TASK_FAILED", `Multica CLI ${args.slice(0, 2).join(" ")} failed.`, { retryable: true });
    }
  }

  private runner(): Promise<MulticaCommandRunner> {
    this.runnerPromise ??= this.initialize().catch(error => {
      this.runnerPromise = undefined;
      if (error instanceof RichMcpError) throw error;
      throw new RichMcpError("DEPENDENCY_UNAVAILABLE", "Multica CLI is unavailable or incompatible.", {
        retryable: true,
        details: { cause: error instanceof Error ? error.message : "Unknown Multica setup failure" },
      });
    });
    return this.runnerPromise;
  }

  private async initialize(): Promise<MulticaCommandRunner> {
    const executable = this.discoverExecutable();
    const runner = new MulticaCommandRunner(multicaCliConfigFromEnv(executable, this.env));
    parseSupportedMulticaVersion(await runner.runText(["--version"], { includeWorkspace: false }));
    return runner;
  }
}
