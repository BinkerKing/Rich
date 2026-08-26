import fs from "node:fs/promises";

const out = "/Users/binkerking/Documents/Ai-WorkSpace/Rich/outputs/vtb-safe2-mapping-20260821/flowchart_preview/vtb_safe2_etl_flowchart_v8.svg";

const W = 2700;
const H = 2620;
const C = {
  bg: "#FFFFFF",
  lane: "#F8FAFC",
  text: "#0F172A",
  sub: "#475569",
  border: "#334155",
  source: "#E8F3FF",
  stage: "#EAF7EA",
  input: "#F1F5F9",
  middle: "#FFF3C4",
  report: "#F0E7FF",
  message: "#FFE8E8",
  acc: "#2563EB",
  bop: "#7C3AED",
  cfa: "#059669",
  exd: "#0891B2",
  fal: "#D97706",
  jsh: "#DC2626",
  muted: "#64748B",
};

const nodes = {
  AIF2: [90, 175, 220, 64, "AIF2.TXT", "账户源文件", "source"],
  BLN2: [90, 260, 220, 64, "BLN2.TXT", "余额源文件", "source"],
  CIF2: [90, 345, 220, 64, "CIF2.TXT", "客户源文件", "source"],
  TRN2: [90, 430, 220, 64, "TRN2.TXT", "交易源文件", "source"],
  AifTab: [460, 175, 240, 64, "AifTab", "账户贴源表", "stage"],
  BlnTab: [460, 260, 240, 64, "BlnTab", "余额贴源表", "stage"],
  CifTab: [460, 345, 240, 64, "CifTab", "客户贴源表", "stage"],
  TransactionTab: [460, 430, 240, 64, "TransactionTab", "交易贴源表", "stage"],

  ACCIn: [90, 665, 300, 76, "贴源输入", "AIF + BLN + CIF + TRN", "input"],
  ACCProc: [560, 665, 360, 76, "ACC 加工过程", "账户/余额报表抽取", "middle"],
  ACCCA: [1140, 625, 310, 70, "T_SAFE_ACCCA", "账户开关户信息", "report"],
  ACCCB: [1140, 710, 310, 70, "T_SAFE_ACCCB", "账户收支余信息", "report"],
  MACCCA: [2260, 625, 230, 70, "ACCCA", "账户开关户 XML", "message"],
  MACCCB: [2260, 710, 230, 70, "ACCCB", "账户收支余 XML", "message"],

  BOPIn: [90, 910, 300, 76, "贴源输入", "TRN + AIF + CIF", "input"],
  BOPMid: [560, 910, 360, 76, "BopTransaction", "涉外收支待判定前置", "middle"],
  BOPRpt: [1140, 895, 350, 106, "BOPA/BOPB/BOPC\nBOPD/BOPE/BOPF", "当前未确认 VTB 自动生成正式报表", "report"],
  MBOP: [2260, 910, 250, 76, "BOP XML", "当前未纳入 VTB 自动报送", "message"],

  CFAIn: [90, 1160, 300, 76, "贴源输入", "TRN + AIF + CIF + BLN", "input"],
  CFACATab: [560, 1070, 360, 70, "CFACATab", "国内外汇贷款签约前置", "middle"],
  CFACBTab: [560, 1155, 360, 70, "CFACBTab", "国内外汇贷款变动前置", "middle"],
  CFADATab: [560, 1240, 360, 70, "CFADATab", "外保内贷签约前置", "middle"],
  CFADBTab: [560, 1325, 360, 70, "CFADBTab", "外保内贷变动前置", "middle"],
  Fogu: [965, 1240, 330, 70, "fogu_code_infos_tab", "境外担保人明细前置", "middle"],
  CFACA: [1460, 1070, 310, 70, "T_SAFE_CFAC_A", "国内外汇贷款签约", "report"],
  CFACB: [1460, 1155, 310, 70, "T_SAFE_CFAC_B", "国内外汇贷款变动", "report"],
  CFADA: [1460, 1240, 310, 70, "T_SAFE_CFAD_A", "外保内贷签约", "report"],
  CFADB: [1460, 1325, 310, 70, "T_SAFE_CFAD_B", "外保内贷变动/履约", "report"],
  CFADFogu: [1460, 1410, 310, 70, "T_SAFE_CFADA_FOGUCODEINFO", "境外担保人信息子表", "report"],
  MCFACA: [2260, 1070, 230, 70, "CFACA", "国内外汇贷款签约 XML", "message"],
  MCFACB: [2260, 1155, 230, 70, "CFACB", "国内外汇贷款变动 XML", "message"],
  MCFADA: [2260, 1240, 230, 70, "CFADA", "外保内贷签约 XML", "message"],
  MCFADB: [2260, 1325, 230, 70, "CFADB", "外保内贷变动 XML", "message"],

  EXDIn: [90, 1585, 300, 76, "贴源输入", "AIF + BLN + CIF", "input"],
  EXDProc: [560, 1585, 420, 76, "EXD N/S 加工过程", "二代替代一代 CFAAN/CFAAS 承载角色", "middle"],
  EXDN: [1460, 1545, 330, 70, "T_SAFE_EXDA_N", "替代一代 CFAAN，生成 EXDAN", "report"],
  EXDS: [1460, 1630, 330, 70, "T_SAFE_EXDA_S", "替代一代 CFAAS，生成 EXDAS", "report"],
  MEXDAN: [2260, 1545, 230, 70, "EXDAN", "外债签约 XML", "message"],
  MEXDAS: [2260, 1630, 230, 70, "EXDAS", "外债变动 XML", "message"],

  FALIn: [90, 1860, 300, 76, "贴源/报表输入", "TRN + AIF + CIF + BLN\nEXD N/S + CFA 支撑", "input"],
  FalWarehouse: [560, 1860, 360, 76, "FalWarehouse", "FAL 白名单加工仓", "middle"],
  FALZB: [1460, 1775, 310, 70, "T_SAFE_FAL_Z02", "Z02 业务概览", "report"],
  FALDB: [1460, 1860, 310, 70, "T_SAFE_FALD_02", "D02 贷款", "report"],
  FALDE: [1460, 1945, 310, 70, "T_SAFE_FALD_0501", "D05-1 境外机构存款", "report"],
  FALDK: [1460, 2030, 310, 70, "T_SAFE_FALD_09", "D09 减值准备余额", "report"],
  FALFA: [1460, 2115, 310, 70, "T_SAFE_FALF_01", "F01 出口票据单证", "report"],
  MFALZB: [2260, 1775, 230, 70, "FALZB", "Z02 XML", "message"],
  MFALDB: [2260, 1860, 230, 70, "FALDB", "D02 XML", "message"],
  MFALDE: [2260, 1945, 230, 70, "FALDE", "D05-1 XML", "message"],
  MFALDK: [2260, 2030, 230, 70, "FALDK", "D09 XML", "message"],
  MFALFA: [2260, 2115, 230, 70, "FALFA", "F01 XML", "message"],

  JSHIn: [90, 2330, 300, 76, "贴源输入", "TRN + AIF + CIF", "input"],
  FAEBaseInfo: [560, 2288, 360, 70, "FAEBaseInfo", "结售汇基础前置", "middle"],
  FAEManage: [560, 2373, 360, 70, "FAEManage", "结汇资金用途明细", "middle"],
  JSHD: [1460, 2245, 310, 70, "T_SAFE_JSHD", "结汇基础信息", "report"],
  JSHF: [1460, 2330, 310, 70, "T_SAFE_JSHD_F", "结汇管理信息", "report"],
  JSHE: [1460, 2415, 310, 70, "T_SAFE_JSHE", "购汇基础信息", "report"],
  MJSHD: [2260, 2245, 230, 70, "JSHD", "结汇基础 XML", "message"],
  MJSHF: [2260, 2330, 230, 70, "JSHF", "结汇管理 XML", "message"],
  MJSHE: [2260, 2415, 230, 70, "JSHE", "购汇基础 XML", "message"],
};

const lanes = [
  ["源文件入库", 145, 395, C.muted],
  ["ACC", 595, 230, C.acc],
  ["BOP", 850, 200, C.bop],
  ["CFA", 1025, 510, C.cfa],
  ["EXD", 1530, 220, C.exd],
  ["FAL", 1745, 465, C.fal],
  ["JSH", 2205, 290, C.jsh],
];

const edges = [
  ["AIF2", "AifTab", "1:1 入库", C.muted],
  ["BLN2", "BlnTab", "1:1 入库", C.muted],
  ["CIF2", "CifTab", "1:1 入库", C.muted],
  ["TRN2", "TransactionTab", "1:1 入库", C.muted],

  ["ACCIn", "ACCProc", "输入贴源表", C.acc],
  ["ACCProc", "ACCCA", "AIF+CIF", C.acc],
  ["ACCProc", "ACCCB", "BLN+TRN+ACCCA", C.acc],
  ["ACCCA", "MACCCA", "XML", C.acc],
  ["ACCCB", "MACCCB", "XML", C.acc],

  ["BOPIn", "BOPMid", "TRN加工", C.bop],
  ["BOPMid", "BOPRpt", "待确认", C.bop, true],
  ["BOPRpt", "MBOP", "未纳入", C.bop, true],

  ["CFAIn", "CFACATab", "贷款签约", C.cfa],
  ["CFAIn", "CFACBTab", "贷款变动", C.cfa],
  ["CFAIn", "CFADATab", "外保内贷签约", C.cfa],
  ["CFAIn", "CFADBTab", "外保内贷变动", C.cfa],
  ["CFADATab", "Fogu", "担保人明细", C.cfa],
  ["CFACATab", "CFACA", "前置转正式", C.cfa],
  ["CFACBTab", "CFACB", "前置转正式", C.cfa],
  ["CFADATab", "CFADA", "前置转正式", C.cfa],
  ["CFADBTab", "CFADB", "前置转正式", C.cfa],
  ["Fogu", "CFADFogu", "明细转正式", C.cfa],
  ["CFACA", "MCFACA", "XML", C.cfa],
  ["CFACB", "MCFACB", "XML", C.cfa],
  ["CFADA", "MCFADA", "XML", C.cfa],
  ["CFADFogu", "MCFADA", "子节点", C.cfa],
  ["CFADB", "MCFADB", "XML", C.cfa],

  ["EXDIn", "EXDProc", "迁移CFAAN/CFAAS逻辑", C.exd],
  ["EXDProc", "EXDN", "N: CFAAN角色", C.exd],
  ["EXDProc", "EXDS", "S: CFAAS角色", C.exd],
  ["EXDN", "MEXDAN", "XML", C.exd],
  ["EXDS", "MEXDAS", "XML", C.exd],

  ["FALIn", "FalWarehouse", "白名单加工", C.fal],
  ["FalWarehouse", "FALZB", "Z02", C.fal],
  ["FalWarehouse", "FALDB", "D02", C.fal],
  ["FalWarehouse", "FALDE", "D05-1", C.fal],
  ["FalWarehouse", "FALDK", "D09", C.fal],
  ["FalWarehouse", "FALFA", "F01", C.fal],
  ["FALZB", "MFALZB", "XML", C.fal],
  ["FALDB", "MFALDB", "XML", C.fal],
  ["FALDE", "MFALDE", "XML", C.fal],
  ["FALDK", "MFALDK", "XML", C.fal],
  ["FALFA", "MFALFA", "XML", C.fal],

  ["JSHIn", "FAEBaseInfo", "基础信息", C.jsh],
  ["JSHIn", "FAEManage", "用途明细", C.jsh],
  ["FAEBaseInfo", "JSHD", "基础信息", C.jsh],
  ["FAEManage", "JSHF", "管理信息", C.jsh],
  ["FAEBaseInfo", "JSHE", "购汇基础", C.jsh],
  ["JSHD", "MJSHD", "XML", C.jsh],
  ["JSHF", "MJSHF", "XML", C.jsh],
  ["JSHE", "MJSHE", "XML", C.jsh],
];

function esc(s) {
  return String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]);
}

function marker(color) {
  return `arrow-${color.slice(1)}`;
}

function right(id) {
  const [x, y, w, h] = nodes[id];
  return [x + w, y + h / 2];
}

function left(id) {
  const [x, y, , h] = nodes[id];
  return [x, y + h / 2];
}

function box(id, [x, y, w, h, title, sub, kind]) {
  const titleLines = String(title).split("\n");
  const subLines = String(sub).split("\n");
  return `
  <g id="${id}">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${C[kind]}" stroke="${C.border}" stroke-width="1.35"/>
    <text x="${x + 15}" y="${y + 27}" font-size="18" font-weight="850" fill="${C.text}">
      ${titleLines.map((t, i) => `<tspan x="${x + 15}" dy="${i ? 21 : 0}">${esc(t)}</tspan>`).join("")}
    </text>
    <text x="${x + 15}" y="${y + 30 + titleLines.length * 20}" font-size="13" fill="${C.sub}">
      ${subLines.map((t, i) => `<tspan x="${x + 15}" dy="${i ? 17 : 0}">${esc(t)}</tspan>`).join("")}
    </text>
  </g>`;
}

function lane([name, y, h, color]) {
  return `
  <g>
    <rect x="48" y="${y}" width="${W - 96}" height="${h}" rx="18" fill="${C.lane}" stroke="#CBD5E1"/>
    <rect x="48" y="${y}" width="56" height="${h}" rx="18" fill="${color}" opacity="0.94"/>
    <text transform="translate(82 ${y + h / 2}) rotate(-90)" text-anchor="middle" font-size="18" font-weight="900" fill="#FFF">${esc(name)}</text>
  </g>`;
}

function edge([from, to, label, color, dashed]) {
  const [x1, y1] = right(from);
  const [x2, y2] = left(to);
  const endX = x2 - 18;
  const gap = x2 - x1;
  const mid = x1 + Math.max(46, Math.min(180, gap * 0.5));
  const d = Math.abs(y1 - y2) < 2
    ? `M ${x1} ${y1} L ${endX} ${y2}`
    : `M ${x1} ${y1} L ${mid} ${y1} L ${mid} ${y2} L ${endX} ${y2}`;
  const labelWidth = Math.max(50, Math.min(190, label.length * 8.8));
  const lx = Math.max(x1 + 12, x2 - labelWidth - 20);
  const ly = y2 - 15;
  return `
  <path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" marker-end="url(#${marker(color)})" ${dashed ? 'stroke-dasharray="8 7"' : ""}/>
  <rect x="${lx - 5}" y="${ly - 14}" width="${labelWidth + 10}" height="22" rx="5" fill="#FFFFFF" opacity="0.96"/>
  <text x="${lx}" y="${ly}" font-size="11.5" font-weight="850" fill="${color}">${esc(label)}</text>`;
}

const markers = Array.from(new Set(edges.map((e) => e[3])))
  .map((color) => `<marker id="${marker(color)}" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="${color}"/></marker>`)
  .join("\n");

const columns = [
  [88, "源文件层"],
  [458, "贴源层"],
  [558, "中间/过程层"],
  [1458, "报表层"],
  [2258, "报文层"],
];

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    ${markers}
    <style>text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans CJK SC", "Microsoft YaHei", Arial, sans-serif; }</style>
  </defs>
  <rect width="100%" height="100%" fill="${C.bg}"/>
  <text x="72" y="60" font-size="32" font-weight="900" fill="${C.text}">VTB 二代 SAFE 数据自动化 ETL 血缘流程图 v8</text>
  <text x="72" y="90" font-size="16" fill="${C.sub}">二代 EXD 用 T_SAFE_EXDA_N / T_SAFE_EXDA_S 替代一代 CFAAN / CFAAS 的数据承载角色，并生成 EXDAN / EXDAS 报文。</text>
  ${columns.map(([x, title]) => `<rect x="${x}" y="108" width="250" height="42" rx="9" fill="#0F172A"/><text x="${x + 18}" y="136" font-size="18" font-weight="800" fill="#FFF">${esc(title)}</text>`).join("\n")}
  ${lanes.map(lane).join("\n")}
  ${edges.map(edge).join("\n")}
  ${Object.entries(nodes).map(([id, spec]) => box(id, spec)).join("\n")}
  <g transform="translate(72,2520)">
    <rect x="0" y="0" width="1890" height="64" rx="12" fill="#F8FAFC" stroke="#CBD5E1"/>
    <text x="18" y="27" font-size="16" font-weight="800" fill="${C.text}">说明</text>
    <text x="18" y="50" font-size="14" fill="${C.sub}">上方保留四个源文件到四个贴源表的一对一入库；业务泳道内的“贴源输入”是对对应贴源表的引用，用于减少长线交叉和穿表。</text>
  </g>
</svg>`;

await fs.writeFile(out, svg, "utf8");
console.log(out);
