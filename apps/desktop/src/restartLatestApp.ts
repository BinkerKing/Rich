import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

type FindRichProjectRootOptions = {
  cwd: string;
  home: string;
  environment?: Record<string, string | undefined>;
  exists?: (path: string) => boolean;
};

export function findRichProjectRoot({ cwd, home, environment = process.env, exists = existsSync }: FindRichProjectRootOptions): string | undefined {
  const candidates = [
    environment.RICH_APP_PROJECT_ROOT,
    cwd,
    resolve(home, "Documents", "Ai-WorkSpace", "Rich"),
  ].filter((path): path is string => Boolean(path));
  return candidates.find(root => exists(join(root, "scripts", "rich-deploy.mjs")));
}
