export interface GenerateImageArgs {
  /** Accessibility description of what the image should show. Always present. */
  alt: string;
  /** Optional one-line caption rendered below the image. */
  caption?: string;
  /** Optional English image prompt (hybrid mode). If absent, AI composes one
   *  from alt + caption + surroundingText. */
  imagePrompt?: string;
  /** Concatenated nearby text (lead / prose / section title) for context when
   *  no imagePrompt is supplied. Keep short — 200–500 chars. */
  surroundingText?: string;
}

/**
 * Image-generation prompt. Invokes Codex with its image_gen skill enabled.
 * Codex generates ONE high-quality image and returns a JSON object containing
 * the absolute path it wrote, the alt text, and the caption — the server side
 * then copies that file into the served /api/images/<elementId>/ directory.
 */
export function buildGenerateImagePrompt(args: GenerateImageArgs): string {
  return `你是 Rich——我的私人 AI 助理。本次任务你担任图像引擎，专职生成一张配图。

## 输入

- alt（必填）：${args.alt}
- caption（可选）：${args.caption ?? "（无）"}
- imagePrompt（可选，英文）：${args.imagePrompt ?? "（用户未给，请自行根据 alt + caption + 周围正文撰写）"}
${args.surroundingText ? `- 周围正文上下文：\n${args.surroundingText.slice(0, 600)}` : ""}

## 任务

1. **撰写图像提示词**：
   - 如果上面给了 \`imagePrompt\`，直接用它。
   - 如果没给，根据 alt + caption（+ 周围正文）写一段英文提示词，包含：
     - **主体**：图里有什么实物 / 场景 / 人物
     - **构图**：视角、镜头（wide shot / close-up / overhead）、画面层次
     - **光线**：自然 / 室内 / 黄昏 / 戏剧光
     - **风格**：photorealistic / cinematic / editorial photo / soft pastel illustration（默认 photorealistic）
     - **氛围词**：clean, modern, warm 等
   - **不要包含**：文字 / 水印 / logo / 抽象草图风。
2. **调用 image_gen 工具**生成一张图（按 imagegen skill）。
3. **输出 JSON**（且仅输出 JSON）：

\`\`\`json
{
  "src": "image_gen 工具返回的绝对路径，例如 /Users/binkerking/.codex/generated_images/<sid>/ig_xxx.png",
  "alt": "${args.alt}",
  "caption": ${JSON.stringify(args.caption ?? "")}
}
\`\`\`

## 强制约束

1. **只能输出 JSON**，不要 Markdown 围栏、解释、闲聊。
2. **src 必须是 image_gen 工具实际返回的真实文件路径**，不要编造。
3. **alt 原样回填**，caption 原样回填（如果输入有给 caption）。
4. 失败时不要返回任何 JSON —— 直接报错，后端会把这条 placeholder 标 failed。`;
}
