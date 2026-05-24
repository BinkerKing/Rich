/**
 * Rich 首页动画展示系统 v0.1 —— Visual block 类型自动识别 (T09 一部分)。
 *
 * 扫前几行特征猜 blockType；AI 提供 hint 时优先用 hint。
 * 提取到独立文件方便单元测试（VisualBlockRenderer.tsx 含 JSX 不能用 node --test 直接跑）。
 */

export type DetectedBlockType =
  | "flowchart" | "tree" | "table" | "sequence"
  | "architecture" | "concept" | "chart" | "sketch" | "raw";

export function detectBlockType(ascii: string): DetectedBlockType {
  const sample = ascii.split("\n").slice(0, 8).join("\n");
  // 时序图特征：顶部 actor 名 + 多条 | 竖虚线 + 横箭头
  if (
    /^[\w一-鿿\s]+(?:\s{2,}[\w一-鿿\s]+){1,}/.test(sample) &&
    /[│|]/.test(sample) &&
    /(→|->|<-)/.test(sample)
  ) {
    return "sequence";
  }
  // 树状图：├ 是树状图独有的分叉符号；┬ 也常见。
  // 仅 └ 不算（└┘ 配对是普通方框的左下角）
  if (/[├┬]/.test(sample)) {
    return "tree";
  }
  // 表格：多列分隔（│ 在多行）+ 横线分隔 + 单元格里有真实文字内容
  // （仅有 │ 和 ─ 没有内容 = 纯网格 = sketch，不是表）
  const tableRows = sample.split("\n").filter(l => {
    // 行里至少有两个竖线，且其间至少有一个非空白非竖线非短横的字符
    return /[│|][^│|]*[\p{L}\p{N}][^│|]*[│|]/u.test(l);
  }).length;
  if (tableRows >= 3 && /─{3,}|-{3,}/.test(sample)) {
    return "table";
  }
  // 架构图：嵌套方框 (═ 强调层)
  if (/[╔╗╚╝═]/.test(sample)) {
    return "architecture";
  }
  // 字符图表：高度字符列（连续 ≥2 个 █/▆/▄）
  if (/█{2,}/.test(sample) || /▆{2,}/.test(sample) || /▄{2,}/.test(sample)) {
    return "chart";
  }
  // 流程图：方框 + 箭头
  if (/[┌┐└┘]/.test(sample) && /(→|↓|->)/.test(sample)) {
    return "flowchart";
  }
  // Sketch（ASCII art / 山水画 / 场景画 / 手绘草图）：
  //   特征字符：山 ▲△▼▽ / 星 ★☆ ✦✧✩❋ ✱✲✳ / 花瓣 ♦◆◇♥♣♠ /
  //   绘图斜线 /\ \/ ╱╲ / 波浪 ~ / 散点 · • ◦ * /
  //   出现 ≥2 个特征字符，或斜线对组合，或多 ~，认为是 sketch
  const sketchChars = /[▲△▼▽☆★♦◆◇♥♣♠✦✧✩❋✱✲✳·•◦*※❄❅❆]/g;
  const sketchMatches = (sample.match(sketchChars) || []).length;
  if (sketchMatches >= 2 || /\/\\|\\\/|╱|╲/.test(sample) || /~{2,}/.test(sample)) {
    return "sketch";
  }
  // 线条网格 / 纯几何图形 = sketch（很多 │ ─ ━ + 等线条字符，但几乎没文字内容）
  // 比如用户要的"高密度十字线"、坐标系网格、方格纸图样、+ 号阵列 —— 都属于 art 而非表
  const lineChars = (sample.match(/[│|─━╋┃═╪╫┼├┤┬┴+]/g) || []).length;
  const textChars = (sample.match(/[\p{L}\p{N}]/gu) || []).length;
  if (lineChars >= 20 && textChars < lineChars / 4) {
    return "sketch";
  }
  // 重复几何纹理 = sketch：内容里非空白字符 ≥30 个，且只有 ≤5 种 unique 字符、几乎无文字
  // 兜底覆盖任何 AI 用 + - * o . 等单字符画的"纹理 / 阵列 / 几何图样"
  const compact = sample.replace(/\s/g, "");
  if (compact.length >= 30) {
    const unique = new Set(compact).size;
    const hasText = /[\p{L}\p{N}]/u.test(compact);
    if (unique <= 5 && !hasText) {
      return "sketch";
    }
  }
  // 兜底：低文字密度的 ascii block —— 大量空白 + 少量字符，几乎肯定是 art
  // 判定：行 ≥ 3 且 每行非空白字符 / 总字符 比例 < 35%（典型 ASCII 画的稀疏特征）
  const lines = ascii.split("\n").filter(l => l.trim().length > 0);
  if (lines.length >= 3) {
    const nonSpace = lines.join("").replace(/\s/g, "").length;
    const total = lines.join("").length;
    if (total > 0 && nonSpace / total < 0.35) {
      return "sketch";
    }
  }
  // 默认 concept（基本方框）/ raw
  if (/[┌┐└┘│─]/.test(sample)) return "concept";
  return "raw";
}
