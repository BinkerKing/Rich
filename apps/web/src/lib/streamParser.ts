/**
 * Rich 首页动画展示系统 v0.1 —— SSE 字符流式解析器。
 *
 * AI 用 Markdown ```ascii ... ``` 围栏标视觉块；前端边收 SSE chunk 边
 * 逐字符判断当前字符属于 text 通道还是 visual 通道，分别 emit。
 *
 * 状态机：
 *   IN_TEXT          普通文字
 *   SEEKING_FENCE    遇到 ``` 开始期待 fence 后续字符
 *   IN_VISUAL        围栏内（含 ascii / 任意 lang 都视为 visual）
 *
 * 设计选择：
 * - **任何 ``` 围栏都进 visual**（不强求是 ```ascii）。AI 偶尔写 ```mermaid
 *   或 ``` 裸围栏，前端也按 visual 渲染（VisualBlockRenderer 内部再判）
 * - 跨 chunk 的 ``` 通过 internal buffer 等齐 3 个 backtick 再判
 * - 解析器宽容：永远不抛错；未闭合的围栏在 flush() 时按 visual 收尾
 * - emit 时机：每个字符一旦确定通道就立即 onVisualChar / onTextChar；
 *   onBlockStart / onBlockEnd 在围栏边界 emit（含 blockType hint）
 */

export interface StreamParserCallbacks {
  /** 文字通道字符（不含围栏）。可能批量 emit。 */
  onTextChar?: (char: string) => void;
  /** 视觉通道字符（围栏内）。可能批量 emit。 */
  onVisualChar?: (char: string) => void;
  /** 视觉块开始（围栏第一个 ` 后）。hint 是围栏后跟的 lang 标签（如 "ascii" / "mermaid" / 空字符串）。 */
  onBlockStart?: (hint: string) => void;
  /** 视觉块结束（关闭的 ``` 后）。 */
  onBlockEnd?: () => void;
}

type State = "IN_TEXT" | "SEEKING_FENCE_OPEN" | "READING_LANG" | "IN_VISUAL" | "SEEKING_FENCE_CLOSE";

export class StreamParser {
  private state: State = "IN_TEXT";
  /** 待消化的字符缓冲（处理跨 chunk 的 ``` 边界） */
  private pending = "";
  /** 当前围栏的 lang hint（"ascii" / "mermaid" / ""） */
  private currentLang = "";
  /** 已收到的 backtick 连续计数（用于识别 ``` 三连） */
  private tickRun = 0;

  constructor(private cb: StreamParserCallbacks = {}) {}

  /** 喂入一段任意长度的字符串（SSE chunk）。可以多次调用。 */
  push(chunk: string): void {
    for (const ch of chunk) {
      this.feed(ch);
    }
  }

  /** 流结束时调用：刷出残留缓冲；如果还在围栏内，按 visual 收尾不抛错。 */
  flush(): void {
    // 残留的 pending（如 "``" 没等到第三个） —— 按当前状态决定通道
    if (this.pending.length > 0) {
      const emit = this.state === "IN_VISUAL" || this.state === "READING_LANG" || this.state === "SEEKING_FENCE_CLOSE"
        ? (c: string) => this.cb.onVisualChar?.(c)
        : (c: string) => this.cb.onTextChar?.(c);
      for (const c of this.pending) emit(c);
      this.pending = "";
    }
    // 未闭合的围栏 —— emit block end 以保证消费方状态平衡
    if (this.state === "IN_VISUAL" || this.state === "READING_LANG" || this.state === "SEEKING_FENCE_CLOSE") {
      this.cb.onBlockEnd?.();
    }
    this.state = "IN_TEXT";
    this.tickRun = 0;
    this.currentLang = "";
  }

  private feed(ch: string): void {
    switch (this.state) {
      case "IN_TEXT": {
        if (ch === "`") {
          this.tickRun++;
          this.pending += ch;
          if (this.tickRun === 3) {
            // 进入 fence open，等下一字符决定 lang
            this.state = "READING_LANG";
            this.pending = "";
            this.tickRun = 0;
            this.currentLang = "";
          }
          return;
        }
        // 之前积压的 1-2 个 backtick 不是围栏，flush 成 text
        if (this.tickRun > 0) {
          for (const c of this.pending) this.cb.onTextChar?.(c);
          this.pending = "";
          this.tickRun = 0;
        }
        this.cb.onTextChar?.(ch);
        return;
      }

      case "READING_LANG": {
        // 围栏后续到换行前的所有字符 = lang hint（如 "ascii"）
        if (ch === "\n") {
          this.cb.onBlockStart?.(this.currentLang.trim());
          this.state = "IN_VISUAL";
          this.currentLang = "";
          return;
        }
        this.currentLang += ch;
        return;
      }

      case "IN_VISUAL": {
        if (ch === "`") {
          this.tickRun++;
          this.pending += ch;
          if (this.tickRun === 3) {
            // 关闭围栏
            this.cb.onBlockEnd?.();
            this.state = "IN_TEXT";
            this.pending = "";
            this.tickRun = 0;
          }
          return;
        }
        // 之前积压的 1-2 个 backtick 不是 close fence，flush 成 visual
        if (this.tickRun > 0) {
          for (const c of this.pending) this.cb.onVisualChar?.(c);
          this.pending = "";
          this.tickRun = 0;
        }
        this.cb.onVisualChar?.(ch);
        return;
      }

      case "SEEKING_FENCE_OPEN":
      case "SEEKING_FENCE_CLOSE":
        // 当前实现没用这两个 state（合并到 IN_TEXT/IN_VISUAL 的 tickRun 里），
        // 留着是为了将来扩展 / 测试可读性。直接当 IN_TEXT 兜底。
        this.cb.onTextChar?.(ch);
        return;
    }
  }

  /** 当前状态（测试 / 调试用） */
  get currentState(): State { return this.state; }
}
