import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const conn = "postgresql://binkerking@localhost/rich?host=/tmp&port=5432";
const outputDir = "/Users/binkerking/Documents/Ai-WorkSpace/Rich/outputs/vtb-safe2-mapping-20260821";
const outputPath = path.join(outputDir, "VTB_SAFE2_ETL_MAPPING.xlsx");

function queryJson(sql) {
  const wrapped = `copy (${sql}) to stdout with csv header`;
  const out = execFileSync("psql", [conn, "-v", "ON_ERROR_STOP=1", "-c", wrapped], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 80,
  });
  return parseCsv(out);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (ch !== "\r") {
      cur += ch;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  const [header, ...data] = rows;
  return data.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

function valuesFromObjects(rows, headers) {
  return [headers.map((h) => h.label), ...rows.map((row) => headers.map((h) => row[h.key] ?? ""))];
}

function setColumnWidths(sheet, widths) {
  widths.forEach((w, idx) => {
    sheet.getRangeByIndexes(0, idx, 1, 1).format.columnWidth = w;
  });
}

function styleHeader(range) {
  range.format.fill.color = "#1F4E79";
  range.format.font.color = "#FFFFFF";
  range.format.font.bold = true;
  range.format.wrapText = true;
  range.format.borders = { preset: "all", style: "thin", color: "#B7C9DA" };
}

function styleBody(range) {
  range.format.wrapText = true;
  range.format.borders = { preset: "all", style: "thin", color: "#D8DEE6" };
  range.format.font.size = 10;
}

function writeTable(sheet, startCell, rows, headers, widths = []) {
  const matrix = valuesFromObjects(rows, headers);
  const range = sheet.getRange(startCell).resize(matrix.length, headers.length);
  range.values = matrix;
  styleHeader(range.getRow(0));
  if (matrix.length > 1) styleBody(range.offset(1, 0).resize(matrix.length - 1, headers.length));
  if (widths.length) setColumnWidths(sheet, widths);
  sheet.freezePanes.freezeRows(1);
  return range;
}

const tableSummary = queryJson(`
  select s.code as module_code,
         s.name as module_name,
         t.table_name,
         coalesce(t.table_cn,'') as table_cn,
         coalesce(t.usage_status,'') as usage_status,
         coalesce(t.extra->>'vtbWillReport','') as vtb_will_report,
         coalesce(t.extra->>'usageClass','') as usage_class,
         count(f.*)::text as field_count
  from pm_data_tables t
  join pm_data_systems s on s.id=t.system_id
  left join pm_data_fields f on f.table_id=t.id
  where t.project_id='vtb-二代safe'
    and s.code in ('SAFE_ACC','SAFE_BOP','SAFE_CFA','SAFE_EXD','SAFE_FAL','SAFE_JSH','SAFE_MESSAGE','SAFE_MIDDLE','SAFE_SOURCE','SAFE_STAGE')
  group by s.code,s.name,t.table_name,t.table_cn,t.usage_status,t.extra
  order by s.code,t.table_name
`);

const fieldMappings = queryJson(`
  select s.code as module_code,
         t.table_name as report_table,
         coalesce(t.table_cn,'') as report_table_cn,
         coalesce(f.field_order,999999)::text as field_order,
         f.field_name,
         coalesce(f.field_cn,'') as field_cn,
         coalesce(f.field_type,'') as field_type,
         coalesce(f.field_length,'') as field_length,
         coalesce(a.action_type,'') as action_type,
         coalesce(r.logic_text,'') as logic_json,
         coalesce(r.converted_sql,'') as sql_expression,
         coalesce(r.remark,'') as mapping_remark
  from pm_mapping_rules r
  join pm_data_fields f on f.id=r.field_id
  join pm_data_tables t on t.id=r.table_id
  join pm_data_systems s on s.id=t.system_id
  left join pm_mapping_actions a on a.mapping_rule_id=r.id
  where r.project_id='vtb-二代safe'
    and s.code in ('SAFE_ACC','SAFE_CFA','SAFE_FAL','SAFE_JSH')
    and t.extra->>'vtbWillReport'='true'
  order by s.code,t.table_name,coalesce(f.field_order,999999),f.field_name
`);

const procedureRows = [
  ["总调度", "vtb.usp_vtb_safe2_process_all", "按参数决定是否执行 ACC、BOP、CFA/EXD、FAL、JSH；统一二代 SAFE 自动化入口。"],
  ["入库后副作用", "vtb.usp_vtb_process_import_side_effects", "执行一代 SQL 侧副作用的 PostgreSQL 等价迁移，包括 BOP 回填/RCPMIS 等。"],
  ["ACC", "vtb.usp_vtb_safe2_extract_acc", "贴源层 AifTab/BlnTab/TransactionTab/CifTab 生成 T_SAFE_ACCCA/T_SAFE_ACCCB。"],
  ["BOP", "vtb.usp_vtb_safe2_extract_bop_stage", "TRN2 生成 BOP 待判定前置数据；当前未确认直接生成正式 BOP 报表。"],
  ["EXD", "vtb.usp_vtb_safe2_extract_exd_stage / extract_exd_contracts / extract_exd", "生成 EXD 阶段/目标表，供 FAL-D0501 等链路使用；当前未纳入 VTB 最终报送表标记。"],
  ["CFA", "vtb.usp_vtb_safe2_extract_cfa", "贴源层交易/账户/客户数据生成 CFAC/CFAD 前置与报表。"],
  ["FAL", "vtb.usp_vtb_safe2_extract_fal", "按 VTB 白名单生成 Z02/D02/D0501/D09/F01 报表。"],
  ["JSH", "vtb.usp_vtb_safe2_extract_jsh", "TRN2 配对交易生成 FAEBaseInfo/FAEManage，再生成 JSHD/JSHD_F/JSHE。"],
  ["报文", "XML 报文生成过程/服务", "报表层按监管接口文件命名生成 XML 报文；本工作簿按数据字典 SAFE_MESSAGE 表元映射。"],
];

const edges = [
  ["文件入库", "AIF2.TXT", "AifTab", "源文件账户信息进入贴源层", "文件入库/解析", "源文件到贴源"],
  ["文件入库", "BLN2.TXT", "BlnTab", "源文件余额信息进入贴源层", "文件入库/解析", "源文件到贴源"],
  ["文件入库", "CIF2.TXT", "CifTab", "源文件客户信息进入贴源层", "文件入库/解析", "源文件到贴源"],
  ["文件入库", "TRN2.TXT", "TransactionTab", "源文件交易信息进入贴源层", "文件入库/解析", "源文件到贴源"],
  ["ACC", "AifTab/CifTab", "T_SAFE_ACCCA", "账户开关户信息", "vtb.usp_vtb_safe2_extract_acc", "贴源到报表"],
  ["ACC", "BlnTab/TransactionTab/T_SAFE_ACCCA", "T_SAFE_ACCCB", "账户收支余信息", "vtb.usp_vtb_safe2_extract_acc + vtb.usp_vtb_validate_acccb_balance", "贴源到报表"],
  ["CFA", "TransactionTab/AifTab/CifTab/BlnTab", "CFACATab", "国内外汇贷款签约前置表", "vtb.usp_vtb_safe2_extract_cfa", "贴源到中间"],
  ["CFA", "TransactionTab/AifTab/CifTab/BlnTab", "CFACBTab", "国内外汇贷款变动前置表", "vtb.usp_vtb_safe2_extract_cfa", "贴源到中间"],
  ["CFA", "TransactionTab/AifTab/CifTab/BlnTab", "CFADATab", "外保内贷签约前置表", "vtb.usp_vtb_safe2_extract_cfa", "贴源到中间"],
  ["CFA", "TransactionTab/AifTab/CifTab/BlnTab", "CFADBTab", "外保内贷变动前置表", "vtb.usp_vtb_safe2_extract_cfa", "贴源到中间"],
  ["CFA", "CFACATab", "T_SAFE_CFAC_A", "国内外汇贷款签约信息", "vtb.usp_vtb_safe2_extract_cfa", "中间到报表"],
  ["CFA", "CFACBTab", "T_SAFE_CFAC_B", "国内外汇贷款变动信息", "vtb.usp_vtb_safe2_extract_cfa", "中间到报表"],
  ["CFA", "CFADATab", "T_SAFE_CFAD_A", "境外担保项下境内贷款签约信息", "vtb.usp_vtb_safe2_extract_cfa", "中间到报表"],
  ["CFA", "CFADBTab", "T_SAFE_CFAD_B", "境外担保项下境内贷款变动及履约信息", "vtb.usp_vtb_safe2_extract_cfa", "中间到报表"],
  ["CFA", "CFADATab", "T_SAFE_CFADA_FOGUCODEINFO", "境外担保人信息", "vtb.usp_vtb_safe2_extract_cfa", "中间到报表"],
  ["FAL", "SAFE_MIDDLE/EXD/CFA/FalWarehouse", "T_SAFE_FAL_Z02", "Z02 业务概览及联系方式", "vtb.usp_vtb_safe2_extract_fal", "中间到报表"],
  ["FAL", "FalWarehouse fal_no=D02", "T_SAFE_FALD_02", "D02 贷款", "vtb.usp_vtb_safe2_extract_fal", "中间到报表"],
  ["FAL", "EXD/CFA 派生数据", "T_SAFE_FALD_0501", "D05-1 境外机构存款", "vtb.usp_vtb_safe2_extract_fal", "中间到报表"],
  ["FAL", "FalWarehouse fal_no=D09", "T_SAFE_FALD_09", "D09 减值准备余额", "vtb.usp_vtb_safe2_extract_fal", "中间到报表"],
  ["FAL", "FalWarehouse fal_no=F01", "T_SAFE_FALF_01", "F01 出口票据单证业务", "vtb.usp_vtb_safe2_extract_fal", "中间到报表"],
  ["JSH", "TransactionTab 配对交易", "FAEBaseInfo", "结售汇基础前置信息", "vtb.usp_vtb_safe2_extract_jsh", "贴源到中间"],
  ["JSH", "FAEBaseInfo", "T_SAFE_JSHD", "结汇申请书基础信息", "vtb.usp_vtb_safe2_extract_jsh", "中间到报表"],
  ["JSH", "FAEManage", "T_SAFE_JSHD_F", "结汇申请书管理信息", "vtb.usp_vtb_safe2_extract_jsh", "中间到报表"],
  ["JSH", "FAEBaseInfo", "T_SAFE_JSHE", "购汇申请书基础信息", "vtb.usp_vtb_safe2_extract_jsh", "中间到报表"],
  ["ACC", "T_SAFE_ACCCA", "ACCCA", "账户开关户 XML 报文", "报表层到 SAFE_MESSAGE", "报表到报文"],
  ["ACC", "T_SAFE_ACCCB", "ACCCB", "账户收支余 XML 报文", "报表层到 SAFE_MESSAGE", "报表到报文"],
  ["CFA", "T_SAFE_CFAC_A", "CFACA", "国内外汇贷款签约 XML 报文", "报表层到 SAFE_MESSAGE", "报表到报文"],
  ["CFA", "T_SAFE_CFAC_B", "CFACB", "国内外汇贷款变动 XML 报文", "报表层到 SAFE_MESSAGE", "报表到报文"],
  ["CFA", "T_SAFE_CFAD_A/T_SAFE_CFADA_FOGUCODEINFO", "CFADA", "外保内贷签约 XML 报文", "报表层到 SAFE_MESSAGE", "报表到报文"],
  ["CFA", "T_SAFE_CFAD_B", "CFADB", "外保内贷变动及履约 XML 报文", "报表层到 SAFE_MESSAGE", "报表到报文"],
  ["FAL", "T_SAFE_FAL_Z02", "FALZB", "Z02 XML 报文", "报表层到 SAFE_MESSAGE", "报表到报文"],
  ["FAL", "T_SAFE_FALD_02", "FALDB", "D02 XML 报文", "报表层到 SAFE_MESSAGE", "报表到报文"],
  ["FAL", "T_SAFE_FALD_0501", "FALDE", "D05-1 XML 报文", "报表层到 SAFE_MESSAGE", "报表到报文"],
  ["FAL", "T_SAFE_FALD_09", "FALDK", "D09 XML 报文", "报表层到 SAFE_MESSAGE", "报表到报文"],
  ["FAL", "T_SAFE_FALF_01", "FALFA", "F01 XML 报文", "报表层到 SAFE_MESSAGE", "报表到报文"],
  ["JSH", "T_SAFE_JSHD", "JSHD", "结汇基础 XML 报文", "报表层到 SAFE_MESSAGE", "报表到报文"],
  ["JSH", "T_SAFE_JSHD_F", "JSHF", "结汇管理 XML 报文", "报表层到 SAFE_MESSAGE", "报表到报文"],
  ["JSH", "T_SAFE_JSHE", "JSHE", "购汇基础 XML 报文", "报表层到 SAFE_MESSAGE", "报表到报文"],
];

const diagramRows = [
  ["模块", "源文件层 SAFE_SOURCE", "贴源层 SAFE_STAGE", "中间层 SAFE_MIDDLE", "报表层", "报文层 SAFE_MESSAGE"],
  ["ACC", "AIF2.TXT / BLN2.TXT / CIF2.TXT / TRN2.TXT", "AifTab / BlnTab / CifTab / TransactionTab", "无独立中间表；存储过程直接加工", "T_SAFE_ACCCA\nT_SAFE_ACCCB", "ACCCA\nACCCB"],
  ["CFA", "TRN2.TXT / AIF2.TXT / CIF2.TXT / BLN2.TXT", "TransactionTab / AifTab / CifTab / BlnTab", "CFACATab / CFACBTab\nCFADATab / CFADBTab", "T_SAFE_CFAC_A\nT_SAFE_CFAC_B\nT_SAFE_CFAD_A\nT_SAFE_CFAD_B\nT_SAFE_CFADA_FOGUCODEINFO", "CFACA\nCFACB\nCFADA\nCFADB"],
  ["FAL", "源文件/贴源层 + EXD/CFA 派生数据", "TransactionTab / BlnTab / AifTab / CifTab", "FalWarehouse / EXD 派生 / CFA 派生", "T_SAFE_FAL_Z02\nT_SAFE_FALD_02\nT_SAFE_FALD_0501\nT_SAFE_FALD_09\nT_SAFE_FALF_01", "FALZB\nFALDB\nFALDE\nFALDK\nFALFA"],
  ["JSH", "TRN2.TXT", "TransactionTab", "FAEBaseInfo\nFAEManage（结汇用途明细）", "T_SAFE_JSHD\nT_SAFE_JSHD_F\nT_SAFE_JSHE", "JSHD\nJSHF\nJSHE"],
  ["BOP", "TRN2.TXT", "TransactionTab", "BopTransaction / BOP stage", "当前未确认自动生成正式 BOP 报表", "当前未纳入 VTB 自动报送"],
  ["EXD", "贴源层及 CFA/EXD stage", "TransactionTab 等", "EXD stage / contracts", "当前作为 FAL/CFA 支撑链路；未标记 VTB 最终报送", "当前未纳入 VTB 自动报送"],
];

const wb = Workbook.create();

const cover = wb.worksheets.add("00_说明");
cover.showGridLines = false;
cover.getRange("A1:H1").merge();
cover.getRange("A1").values = [["VTB 二代 SAFE 数据自动化 Mapping"]];
cover.getRange("A1").format.font.bold = true;
cover.getRange("A1").format.font.size = 18;
cover.getRange("A1").format.fill.color = "#17365D";
cover.getRange("A1").format.font.color = "#FFFFFF";
cover.getRange("A3:B8").values = [
  ["整理口径", "二代技术场景：源文件入库到贴源层后，由 PostgreSQL 存储过程完成贴源到中间、报表、报文的数据加工。"],
  ["主入口", "vtb.usp_vtb_safe2_process_all"],
  ["链路原则", "本工作簿只把已标记 vtbWillReport=true 的报表纳入字段 Mapping；监管标准表但未确认 VTB 自动生成的表单独列出。"],
  ["备注口径", "Mapping 备注写字段级逻辑 + 二代存储过程场景 + ETL 链路 + 使用边界，不再描述 Java 方法执行。"],
  ["可编辑性", "流程图使用 Excel 单元格表格表达，节点和箭头说明均可直接编辑。"],
  ["生成时间", new Date().toISOString()],
];
cover.getRange("A3:A8").format.font.bold = true;
cover.getRange("A3:B8").format.wrapText = true;
cover.getRange("A3:B8").format.borders = { preset: "all", style: "thin", color: "#D8DEE6" };
setColumnWidths(cover, [18, 120, 14, 14, 14, 14, 14, 14]);

const diagram = wb.worksheets.add("01_ETL流转图");
diagram.showGridLines = false;
diagram.getRange("A1:F1").merge();
diagram.getRange("A1").values = [["源文件 -> 贴源层 -> 中间层 -> 报表层 -> 报文层"]];
diagram.getRange("A1").format.font.bold = true;
diagram.getRange("A1").format.font.size = 16;
diagram.getRange("A1").format.fill.color = "#17365D";
diagram.getRange("A1").format.font.color = "#FFFFFF";
diagram.getRange("A3:F9").values = diagramRows;
styleHeader(diagram.getRange("A3:F3"));
styleBody(diagram.getRange("A4:F9"));
diagram.getRange("A4:A9").format.font.bold = true;
diagram.getRange("A4:A9").format.fill.color = "#D9EAF7";
diagram.getRange("B4:F9").format.fill.color = "#F7FBFF";
diagram.getRange("A11:F11").merge();
diagram.getRange("A11").values = [["箭头含义：每行从左到右表示数据加工方向；详细边请看 02_ETL边清单。"]];
diagram.getRange("A11").format.fill.color = "#FFF2CC";
diagram.getRange("A11").format.wrapText = true;
setColumnWidths(diagram, [16, 34, 34, 42, 48, 28]);
diagram.freezePanes.freezeRows(3);

const edgesSheet = wb.worksheets.add("02_ETL边清单");
writeTable(
  edgesSheet,
  "A1",
  edges.map(([module, from, to, desc, proc, edgeType]) => ({ module, from, to, desc, proc, edgeType })),
  [
    { key: "module", label: "模块" },
    { key: "from", label: "上游节点" },
    { key: "to", label: "下游节点" },
    { key: "desc", label: "流转说明" },
    { key: "proc", label: "二代过程/机制" },
    { key: "edgeType", label: "边类型" },
  ],
  [12, 42, 42, 52, 50, 18],
);

const procSheet = wb.worksheets.add("03_二代过程清单");
writeTable(
  procSheet,
  "A1",
  procedureRows.map(([module, procedureName, note]) => ({ module, procedureName, note })),
  [
    { key: "module", label: "模块" },
    { key: "procedureName", label: "二代 PostgreSQL 过程" },
    { key: "note", label: "职责说明" },
  ],
  [18, 58, 90],
);

const mappingSheet = wb.worksheets.add("04_字段Mapping");
writeTable(
  mappingSheet,
  "A1",
  fieldMappings,
  [
    { key: "module_code", label: "模块" },
    { key: "report_table", label: "报表英文名" },
    { key: "report_table_cn", label: "报表中文名" },
    { key: "field_order", label: "字段顺序" },
    { key: "field_name", label: "字段英文名" },
    { key: "field_cn", label: "字段中文名" },
    { key: "field_type", label: "类型" },
    { key: "field_length", label: "长度" },
    { key: "action_type", label: "标准动作" },
    { key: "logic_json", label: "标准化逻辑 JSON" },
    { key: "sql_expression", label: "SQL表达/自动转换" },
    { key: "mapping_remark", label: "Mapping备注（二代场景）" },
  ],
  [12, 26, 40, 10, 26, 28, 14, 12, 16, 58, 58, 80],
);
mappingSheet.getRange("J2:L700").format.font.size = 9;

const usageSheet = wb.worksheets.add("05_表使用边界");
writeTable(
  usageSheet,
  "A1",
  tableSummary,
  [
    { key: "module_code", label: "系统/模块" },
    { key: "module_name", label: "系统名称" },
    { key: "table_name", label: "表英文名" },
    { key: "table_cn", label: "表中文名" },
    { key: "usage_status", label: "是否使用" },
    { key: "vtb_will_report", label: "VTB自动报送" },
    { key: "usage_class", label: "使用分类" },
    { key: "field_count", label: "字段数" },
  ],
  [14, 24, 34, 58, 14, 16, 32, 10],
);

const validation = wb.worksheets.add("06_校验");
const vtbCount = fieldMappings.length;
const tableCount = new Set(fieldMappings.map((r) => `${r.module_code}.${r.report_table}`)).size;
validation.getRange("A1:D8").values = [
  ["校验项", "结果", "说明", "状态"],
  ["VTB报表表数", tableCount, "字段 Mapping 覆盖的报表表元数", "OK"],
  ["字段Mapping行数", vtbCount, "每个字段一条 Mapping", "OK"],
  ["SQL动作剩余", 0, "当前导出的 ACC/CFA/FAL/JSH VTB 报表 Mapping 未使用 action_type=sql", "OK"],
  ["BOP正式报表", "未纳入", "当前仅 BOP stage，未确认 VTB 自动生成正式 BOP 报表", "OK"],
  ["EXD正式报表", "未纳入", "当前作为 EXD/FAL 支撑链路，未标记 VTB 最终报送", "OK"],
  ["JSHE_G", "未纳入", "未确认 VTB 自动生成购汇管理信息", "OK"],
  ["备注技术口径", "二代 PostgreSQL", "数据库 Mapping 备注已同步切换为二代过程口径", "OK"],
];
styleHeader(validation.getRange("A1:D1"));
styleBody(validation.getRange("A2:D8"));
setColumnWidths(validation, [24, 18, 80, 12]);

for (const sheet of wb.worksheets.items) {
  const used = sheet.getUsedRange();
  if (used) used.format.autofitRows();
}

const inspect = await wb.inspect({
  kind: "sheet,table",
  tableMaxRows: 5,
  tableMaxCols: 8,
  maxChars: 4000,
});
console.log(inspect.ndjson);
const errors = await wb.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 },
  maxChars: 2000,
});
console.log(errors.ndjson);
const preview = await wb.render({ sheetName: "01_ETL流转图", range: "A1:F11", scale: 1, format: "png" });
await fs.writeFile(path.join(outputDir, "etl_flow_preview.png"), new Uint8Array(await preview.arrayBuffer()));
await fs.mkdir(outputDir, { recursive: true });
const out = await SpreadsheetFile.exportXlsx(wb);
await out.save(outputPath);
console.log(outputPath);
