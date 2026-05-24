/**
 * Rich 首页动画展示系统 v0.1 —— Box-drawing 字符 → ASCII 7-bit 降级映射（T23）。
 *
 * 不是所有系统 / 所有字体都覆盖完整的 Unicode Box-drawing 范围（U+2500-U+257F）。
 * 检测到当前字体不支持时，把视觉块里的 box-drawing 字符替换成 7-bit ASCII
 * 等价物（+ - | > 等）。这样在最差情况下视觉块依然能呈现结构，只是「粗糙」一些。
 *
 * 检测逻辑：用 canvas measureText 测一个 box-drawing 字符的宽度 vs 'M' 的宽度，
 * 差 > 15% 视为字体不支持（fallback 字体在缺字符时通常宽度异常）。
 */

/** Box-drawing → ASCII 7-bit 降级表 */
const FALLBACK_MAP: Record<string, string> = {
  // 水平 / 垂直 / 折角
  "─": "-", "━": "=",
  "│": "|", "┃": "|",
  "┌": "+", "┐": "+", "└": "+", "┘": "+",
  "├": "+", "┤": "+", "┬": "+", "┴": "+", "┼": "+",
  "╔": "+", "╗": "+", "╚": "+", "╝": "+",
  "╠": "+", "╣": "+", "╦": "+", "╩": "+", "╬": "+",
  "═": "=", "║": "|",
  // 虚线
  "┄": "-", "┅": "-", "┈": ".",
  // 箭头
  "→": "->", "←": "<-", "↑": "^", "↓": "v",
  "▶": ">", "◀": "<", "▲": "^", "▼": "v",
  "⇒": "=>", "⇐": "<=", "⤳": "~>",
  // 实心方块（图表用）
  "█": "#", "▆": "#", "▄": "_", "▂": ".", "▁": ".",
  // 圆 / 饼
  "●": "*", "○": "o", "◔": "1", "◑": "2", "◕": "3",
  // 标记
  "✓": "v", "✗": "x", "⚠": "!",
};

let cachedSupport: boolean | null = null;

/**
 * 检测当前环境是否支持 Box-drawing 字符。结果缓存（启动时检测一次）。
 * 用 canvas measureText 比较宽度。
 */
export function checkBoxDrawingSupport(): boolean {
  if (cachedSupport !== null) return cachedSupport;
  if (typeof document === "undefined") {
    cachedSupport = true;
    return true;
  }
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) { cachedSupport = true; return true; }
    ctx.font = "16px 'SF Mono', 'JetBrains Mono', Monaco, monospace";
    const widthM = ctx.measureText("M").width;
    const widthBox = ctx.measureText("─").width;
    if (widthM === 0) { cachedSupport = true; return true; }
    const ratio = widthBox / widthM;
    // 等宽字体里 box-drawing 应该跟 'M' 等宽 (ratio ≈ 1.0)
    // 不支持时通常 fallback 字体的字符宽度异常（< 0.85 或 > 1.15）
    cachedSupport = ratio >= 0.85 && ratio <= 1.15;
    return cachedSupport;
  } catch {
    cachedSupport = true;
    return true;
  }
}

/** 把字符串里的 box-drawing 字符替换成 7-bit ASCII 等价物。 */
export function asciiFallback(input: string): string {
  let out = "";
  for (const ch of input) {
    out += FALLBACK_MAP[ch] ?? ch;
  }
  return out;
}

/** 调用方便函数：当环境不支持 box-drawing 时 fallback，否则原样返回。 */
export function maybeFallback(input: string): string {
  return checkBoxDrawingSupport() ? input : asciiFallback(input);
}

/** 测试用：手动重置 cached support（生产代码别用） */
export function _resetBoxDrawingCache(): void {
  cachedSupport = null;
}
