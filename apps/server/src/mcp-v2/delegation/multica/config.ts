export interface MulticaCliConfig {
  executable: string;
  profile?: string;
  workspaceId?: string;
  timeoutMs: number;
  maxOutputBytes: number;
}

export function multicaCliConfigFromEnv(
  executable: string,
  env: NodeJS.ProcessEnv = process.env,
): MulticaCliConfig {
  return {
    executable,
    profile: env.RICH_MULTICA_PROFILE?.trim() || "desktop-api.multica.ai",
    workspaceId: env.RICH_MULTICA_WORKSPACE_ID?.trim() || undefined,
    timeoutMs: positiveInteger(env.RICH_MULTICA_TIMEOUT_MS, 30_000),
    maxOutputBytes: positiveInteger(env.RICH_MULTICA_MAX_OUTPUT_BYTES, 2_000_000),
  };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
