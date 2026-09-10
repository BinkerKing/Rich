import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readGeneratedImage } from "./AgentConversationService.js";

describe("readGeneratedImage", () => {
  it("reads a Codex-generated PNG as a chat attachment payload", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rich-codex-image-"));
    const file = join(directory, "preview.png");
    const data = Buffer.from("89504e470d0a1a0a", "hex");
    await writeFile(file, data);

    try {
      await expect(readGeneratedImage(file)).resolves.toMatchObject({
        mime: "image/png",
        data: new Uint8Array(data),
        sha256: "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
