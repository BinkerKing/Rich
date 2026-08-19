import { OpenAICompatibleAdapter } from "./openaiCompatible.js";

export class BailianAdapter extends OpenAICompatibleAdapter {
  constructor() {
    super({
      name: "bailian",
      baseUrl: (process.env.BAILIAN_BASE_URL || process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/$/, ""),
      apiKey: process.env.BAILIAN_API_KEY || process.env.DASHSCOPE_API_KEY,
      model: process.env.BAILIAN_MODEL || process.env.DASHSCOPE_MODEL || "qwen-plus",
    });
  }
}
