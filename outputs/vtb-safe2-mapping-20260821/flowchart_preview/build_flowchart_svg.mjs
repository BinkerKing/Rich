import fs from "node:fs/promises";

const out = "/Users/binkerking/Documents/Ai-WorkSpace/Rich/outputs/vtb-safe2-mapping-20260821/flowchart_preview/vtb_safe2_etl_flowchart_v7.svg";

const W = 4200;
const H = 2920;
const C = {
  bg: "#FFFFFF",
  text: "#0F172A",
  sub: "#475569",
  border: "#334155",
  source: "#E8F3FF",
  stage: "#EAF7EA",
  middle1: "#FFF6DE",
  middle2: "#FFF0C2",
  report: "#F2ECFF",
  message: "#FFECEC",
  acc: "#2563EB",
  bop: "#7C3AED",
  cfa: "#059669",
  exd: "#0891B2",
  fal: "#D97706",
  jsh: "#DC2626",
  muted: "#64748B",
  lane: "#F8FAFC",
};

const nodes = {
  AIF2: [70, 190, 240, 62, "AIF2.TXT", "账户源文件", "source"],
  BLN2: [70, 275, 240, 62, "BLN2.TXT", "余额源文件", "source"],
  CIF2: [70, 360, 240, 62, "CIF2.TXT", "客户源文件", "source"],
  TRN2: [70, 445, 240, 62, "TRN2.TXT", "交易源文件", "source"],

  AifTab: [420, 190, 240, 62, "AifTab", "账户贴源表", "stage"],
  BlnTab: [420, 275, 240, 62, "BlnTab", "余额贴源表", "stage"],
  CifTab: [420, 360, 240, 62, "CifTab", "客户贴源表", "stage"],
  TransactionTab: [420, 445, 240, 62, "TransactionTab", "交易贴源表", "stage"],

  // ACC
  ACCProc: [1130, 205, 300, 76, "ACC 存储过程", "usp_vtb_safe2_extract_acc", "middle1"],
  ACCCA: [1940, 175, 310, 70, "T_SAFE_ACCCA", "账户开关户信息", "report"],
  ACCCB: [1940, 260, 310, 70, "T_SAFE_ACCCB", "账户收支余信息", "report"],
  MACCCA: [3310, 175, 230, 70, "ACCCA", "账户开关户XML", "message"],
  MACCCB: [3310, 260, 230, 70, "ACCCB", "账户收支余XML", "message"],

  // BOP
  BOPStage: [1130, 610, 320, 78, "BopTransaction / BOP stage", "涉外收支待判定前置", "middle1"],
  BOPReports: [1940, 595, 350, 116, "T_SAFE_BOPA/BOPB/BOPC\nT_SAFE_BOPD/BOPE/BOPF", "当前未确认VTB自动生成正式报表", "report"],
  MBOP: [3310, 610, 250, 78, "BOP XML", "当前未纳入VTB自动报送", "message"],

  // CFA
  CFACATab: [1130, 910, 320, 70, "CFACATab", "国内外汇贷款签约前置", "middle1"],
  CFACBTab: [1130, 995, 320, 70, "CFACBTab", "国内外汇贷款变动前置", "middle1"],
  CFADATab: [1130, 1080, 320, 70, "CFADATab", "外保内贷签约前置", "middle1"],
  CFADBTab: [1130, 1165, 320, 70, "CFADBTab", "外保内贷变动前置", "middle1"],
  Fogu: [1530, 1080, 330, 70, "fogu_code_infos_tab", "境外担保人明细前置", "middle2"],
  CFACA: [1940, 890, 310, 70, "T_SAFE_CFAC_A", "国内外汇贷款签约", "report"],
  CFACB: [1940, 975, 310, 70, "T_SAFE_CFAC_B", "国内外汇贷款变动", "report"],
  CFADA: [1940, 1060, 310, 70, "T_SAFE_CFAD_A", "外保内贷签约", "report"],
  CFADB: [1940, 1145, 310, 70, "T_SAFE_CFAD_B", "外保内贷变动/履约", "report"],
  CFADFogu: [1940, 1230, 310, 70, "T_SAFE_CFADA_FOGUCODEINFO", "境外担保人信息", "report"],
  MCFACA: [3310, 930, 230, 70, "CFACA", "国内外汇贷款签约XML", "message"],
  MCFACB: [3310, 1015, 230, 70, "CFACB", "国内外汇贷款变动XML", "message"],
  MCFADA: [3310, 1100, 230, 70, "CFADA", "外保内贷签约XML", "message"],
  MCFADB: [3310, 1185, 230, 70, "CFADB", "外保内贷变动XML", "message"],

  // EXD
  EXDStage: [1130, 1480, 320, 78, "EXD stage", "外债阶段前置", "middle1"],
  EXDContracts: [1530, 1480, 330, 78, "EXD contracts", "外债签约/余额支撑", "middle2"],
  EXDReports: [1940, 1450, 350, 138, "T_SAFE_EXDA_C/F/L/M/N/P/R/S", "二代过程已实现支撑链路\n当前未标记VTB最终自动报送", "report"],
  MEXD: [3310, 1480, 250, 78, "EXD XML", "当前未纳入VTB自动报送", "message"],

  // FAL
  FalWarehouse: [1530, 1880, 330, 78, "FalWarehouse", "FAL白名单加工仓", "middle2"],
  FALZB: [1940, 1785, 310, 70, "T_SAFE_FAL_Z02", "Z02业务概览", "report"],
  FALDB: [1940, 1870, 310, 70, "T_SAFE_FALD_02", "D02贷款", "report"],
  FALDE: [1940, 1955, 310, 70, "T_SAFE_FALD_0501", "D05-1境外机构存款", "report"],
  FALDK: [1940, 2040, 310, 70, "T_SAFE_FALD_09", "D09减值准备余额", "report"],
  FALFA: [1940, 2125, 310, 70, "T_SAFE_FALF_01", "F01出口票据单证", "report"],
  MFALZB: [3310, 1785, 230, 70, "FALZB", "Z02 XML", "message"],
  MFALDB: [3310, 1870, 230, 70, "FALDB", "D02 XML", "message"],
  MFALDE: [3310, 1955, 230, 70, "FALDE", "D05-1 XML", "message"],
  MFALDK: [3310, 2040, 230, 70, "FALDK", "D09 XML", "message"],
  MFALFA: [3310, 2125, 230, 70, "FALFA", "F01 XML", "message"],

  // JSH
  FAEBaseInfo: [1130, 2480, 320, 70, "FAEBaseInfo", "结售汇基础前置", "middle1"],
  FAEManage: [1530, 2565, 330, 70, "FAEManage", "结汇资金用途明细", "middle2"],
  JSHD: [1940, 2440, 310, 70, "T_SAFE_JSHD", "结汇基础信息", "report"],
  JSHF: [1940, 2525, 310, 70, "T_SAFE_JSHD_F", "结汇管理信息", "report"],
  JSHE: [1940, 2610, 310, 70, "T_SAFE_JSHE", "购汇基础信息", "report"],
  MJSHD: [3310, 2440, 230, 70, "JSHD", "结汇基础XML", "message"],
  MJSHF: [3310, 2525, 230, 70, "JSHF", "结汇管理XML", "message"],
  MJSHE: [3310, 2610, 230, 70, "JSHE", "购汇基础XML", "message"],
};

const edges = [
  ["AIF2", "AifTab", "1:1 入库", C.muted],
  ["BLN2", "BlnTab", "1:1 入库", C.muted],
  ["CIF2", "CifTab", "1:1 入库", C.muted],
  ["TRN2", "TransactionTab", "1:1 入库", C.muted],

  ["TransactionTab", "ACCProc", "源表: AIF + BLN + CIF + TRN", C.acc],
  ["ACCProc", "ACCCA", "AIF + CIF", C.acc],
  ["ACCProc", "ACCCB", "BLN + TRN + ACCCA", C.acc],
  ["ACCCA", "MACCCA", "XML", C.acc],
  ["ACCCB", "MACCCB", "XML", C.acc],

  ["TransactionTab", "BOPStage", "源表: TRN + AIF + CIF", C.bop],
  ["BOPStage", "BOPReports", "待分类/待确认", C.bop, true],
  ["BOPReports", "MBOP", "未纳入", C.bop, true],

  ["TransactionTab", "CFACATab", "源表: TRN + AIF + CIF", C.cfa],
  ["TransactionTab", "CFACBTab", "源表: TRN + BLN", C.cfa],
  ["TransactionTab", "CFADATab", "源表: TRN + AIF + CIF", C.cfa],
  ["TransactionTab", "CFADBTab", "源表: TRN", C.cfa],
  ["CFADATab", "Fogu", "担保人明细", C.cfa],
  ["CFACATab", "CFACA", "前置转正式", C.cfa],
  ["CFACBTab", "CFACB", "前置转正式", C.cfa],
  ["CFADATab", "CFADA", "前置转正式", C.cfa, false, { viaY: 1038 }],
  ["CFADBTab", "CFADB", "前置转正式", C.cfa],
  ["Fogu", "CFADFogu", "明细转正式", C.cfa],
  ["CFACA", "MCFACA", "XML", C.cfa],
  ["CFACB", "MCFACB", "XML", C.cfa],
  ["CFADA", "MCFADA", "XML", C.cfa],
  ["CFADFogu", "MCFADA", "子节点", C.cfa],
  ["CFADB", "MCFADB", "XML", C.cfa],

  ["TransactionTab", "EXDStage", "源表: TRN + AIF + CIF", C.exd],
  ["EXDStage", "EXDContracts", "阶段转签约/余额", C.exd],
  ["EXDContracts", "EXDReports", "支撑报表", C.exd, true],
  ["EXDReports", "MEXD", "未纳入", C.exd, true],

  ["TransactionTab", "FalWarehouse", "源表: TRN + AIF + CIF + BLN", C.fal],
  ["EXDContracts", "FalWarehouse", "EXD支撑", C.fal],
  ["CFACA", "FalWarehouse", "CFA支撑", C.fal],
  ["FalWarehouse", "FALZB", "Z02", C.fal, false, { channelX: 1886 }],
  ["FalWarehouse", "FALDB", "D02", C.fal, false, { channelX: 1886 }],
  ["FalWarehouse", "FALDE", "D05-1", C.fal, false, { channelX: 1886 }],
  ["FalWarehouse", "FALDK", "D09", C.fal, false, { channelX: 1886 }],
  ["FalWarehouse", "FALFA", "F01", C.fal, false, { channelX: 1886 }],
  ["FALZB", "MFALZB", "XML", C.fal],
  ["FALDB", "MFALDB", "XML", C.fal],
  ["FALDE", "MFALDE", "XML", C.fal],
  ["FALDK", "MFALDK", "XML", C.fal],
  ["FALFA", "MFALFA", "XML", C.fal],

  ["TransactionTab", "FAEBaseInfo", "源表: TRN + AIF + CIF", C.jsh],
  ["FAEBaseInfo", "FAEManage", "结汇用途", C.jsh],
  ["FAEBaseInfo", "JSHD", "基础信息", C.jsh],
  ["FAEManage", "JSHF", "管理信息", C.jsh],
  ["FAEBaseInfo", "JSHE", "基础信息", C.jsh],
  ["JSHD", "MJSHD", "XML", C.jsh],
  ["JSHF", "MJSHF", "XML", C.jsh],
  ["JSHE", "MJSHE", "XML", C.jsh],
];

const lanes = [
  ["公共源文件/贴源", 150, 390, C.muted],
  ["ACC", 150, 220, C.acc],
  ["BOP", 560, 220, C.bop],
  ["CFA", 850, 510, C.cfa],
  ["EXD", 1410, 240, C.exd],
  ["FAL", 1745, 510, C.fal],
  ["JSH", 2400, 340, C.jsh],
];

function esc(s) {
  return String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]);
}

function split(s) {
  return String(s).split("\n");
}

function box(id, [x, y, w, h, title, sub, kind]) {
  const ts = split(title);
  const ss = split(sub);
  return `
  <g id="${id}">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${C[kind]}" stroke="${C.border}" stroke-width="1.25"/>
    <text x="${x + 14}" y="${y + 25}" font-size="17" font-weight="800" fill="${C.text}">
      ${ts.map((t, i) => `<tspan x="${x + 14}" dy="${i ? 20 : 0}">${esc(t)}</tspan>`).join("")}
    </text>
    <text x="${x + 14}" y="${y + 25 + ts.length * 21}" font-size="12.5" fill="${C.sub}">
      ${ss.map((t, i) => `<tspan x="${x + 14}" dy="${i ? 17 : 0}">${esc(t)}</tspan>`).join("")}
    </text>
  </g>`;
}

function right(id) {
  const [x, y, w, h] = nodes[id];
  return [x + w, y + h / 2];
}

function left(id) {
  const [x, y, , h] = nodes[id];
  return [x, y + h / 2];
}

function marker(color) {
  return `arrow-${color.slice(1)}`;
}

function edge([from, to, label, color, dashed, route]) {
  const [x1, y1] = right(from);
  const [x2, y2] = left(to);
  const endX = x2 - 24;
  const mid = route?.channelX ?? Math.max(x1 + 48, x2 - 72);
  const d = route?.viaY
    ? `M ${x1} ${y1} L ${x1 + 48} ${y1} L ${x1 + 48} ${route.viaY} L ${mid} ${route.viaY} L ${mid} ${y2} L ${endX} ${y2}`
    : `M ${x1} ${y1} L ${mid} ${y1} L ${mid} ${y2} L ${endX} ${y2}`;
  const labelWidth = Math.max(64, Math.min(230, label.length * 9.5));
  const lx = Math.max(x1 + 10, x2 - labelWidth - 24);
  const ly = y2 - 18;
  return `
  <path d="${d}" fill="none" stroke="${color}" stroke-width="2.15" marker-end="url(#${marker(color)})" ${dashed ? 'stroke-dasharray="8 7"' : ""}/>
  <rect x="${lx - 5}" y="${ly - 15}" width="${labelWidth + 10}" height="22" rx="5" fill="#FFFFFF" opacity="0.96"/>
  <text x="${lx}" y="${ly}" font-size="11.5" font-weight="800" fill="${color}">${esc(label)}</text>`;
}

function lane([name, y, h, color]) {
  return `
  <g>
    <rect x="40" y="${y}" width="${W - 90}" height="${h}" rx="18" fill="${C.lane}" stroke="#CBD5E1"/>
    <rect x="40" y="${y}" width="56" height="${h}" rx="18" fill="${color}" opacity="0.92"/>
    <text transform="translate(74 ${y + h / 2}) rotate(-90)" text-anchor="middle" font-size="18" font-weight="900" fill="#FFFFFF">${esc(name)}</text>
  </g>`;
}

const columns = [
  [60, "源文件层"],
  [410, "贴源层"],
  [1120, "中间层 1"],
  [1520, "中间层 2"],
  [1930, "报表层"],
  [3300, "报文层"],
];

function col([x, title]) {
  return `<rect x="${x}" y="96" width="250" height="42" rx="9" fill="#0F172A"/><text x="${x + 18}" y="124" font-size="18" font-weight="800" fill="#FFF">${esc(title)}</text>`;
}

const markers = Array.from(new Set(edges.map((e) => e[3])))
  .map((color) => `<marker id="${marker(color)}" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="${color}"/></marker>`)
  .join("\n");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    ${markers}
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans CJK SC", "Microsoft YaHei", Arial, sans-serif; }
    </style>
  </defs>
  <rect width="100%" height="100%" fill="${C.bg}"/>
  <text x="60" y="56" font-size="32" font-weight="900" fill="${C.text}">VTB 二代 SAFE 数据自动化 ETL 血缘流程图 v7</text>
  <text x="60" y="84" font-size="16" fill="${C.sub}">按 ACC / BOP / CFA / EXD / FAL / JSH 六个业务大类划分；每个源文件和贴源表独立展示，贴源表直接指向业务中间/过程节点。</text>
  ${columns.map(col).join("\n")}
  ${lanes.map(lane).join("\n")}
  ${edges.map(edge).join("\n")}
  ${Object.entries(nodes).map(([id, spec]) => box(id, spec)).join("\n")}
  <g transform="translate(60,2815)">
    <rect x="0" y="0" width="1720" height="74" rx="12" fill="#F8FAFC" stroke="#CBD5E1"/>
    <text x="18" y="28" font-size="16" font-weight="800" fill="${C.text}">说明</text>
    <text x="18" y="52" font-size="14" fill="${C.sub}">箭头终端标源表组合：AIF=AifTab，BLN=BlnTab，CIF=CifTab，TRN=TransactionTab。虚线表示待确认或非当前VTB最终自动报送。</text>
  </g>
</svg>`;

await fs.writeFile(out, svg, "utf8");
console.log(out);
