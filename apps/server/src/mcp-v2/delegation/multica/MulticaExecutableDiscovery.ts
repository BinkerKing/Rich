import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";

export const MULTICA_DESKTOP_CLI = "/Applications/Multica.app/Contents/Resources/app.asar.unpacked/resources/bin/multica";

interface DiscoveryOptions {
  env?: NodeJS.ProcessEnv;
  desktopPath?: string;
}

export function discoverMulticaExecutable(options: DiscoveryOptions = {}): string {
  const env = options.env ?? process.env;
  const explicit = env.RICH_MULTICA_CLI_PATH?.trim();
  if (explicit) {
    if (isExecutable(explicit)) return explicit;
    throw new Error(`Configured Multica CLI is not executable: ${explicit}`);
  }

  for (const directory of (env.PATH ?? "").split(delimiter).filter(Boolean)) {
    const candidate = join(directory, "multica");
    if (isExecutable(candidate)) return candidate;
  }

  const desktopPath = options.desktopPath ?? MULTICA_DESKTOP_CLI;
  if (isExecutable(desktopPath)) return desktopPath;
  throw new Error("Multica CLI was not found in RICH_MULTICA_CLI_PATH, PATH, or the Multica Desktop bundle.");
}

export interface MulticaVersion {
  major: number;
  minor: number;
  patch: number;
}

export function parseSupportedMulticaVersion(output: string): MulticaVersion {
  const match = output.match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error("Could not parse the Multica CLI version.");
  const version = { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
  const supported = version.major === 0 && version.minor === 4 && version.patch >= 35;
  if (!supported) {
    throw new Error(`Unsupported Multica CLI ${version.major}.${version.minor}.${version.patch}; Rich requires >=0.4.35 <0.5.0.`);
  }
  return version;
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
