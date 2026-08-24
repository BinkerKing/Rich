import { createHash } from "node:crypto";
import sql from "mssql";
import { Pool, type QueryResultRow } from "pg";

/**
 * Rebuilds the evidence-backed CFAAN vertical slice for the VTB SAFE2 project.
 *
 * Evidence hierarchy:
 * 1. vtb_ods physical schema and SAFE2 procedures: field order/type and actual writes.
 * 2. SAFE 1.4 specification: report/message semantics, validation, and official code values.
 * 3. SAFE1 Java: only the CFAA/CFAAS intermediate preparation logic.
 *
 * Do not use this importer as a generic dictionary importer. It intentionally replaces only
 * the five SAFE systems belonging to the VTB SAFE2 project.
 */

const PROJECT_ID = "vtb-二代safe";
const RICH_URL = process.env.RICH_DB_URL ?? "postgresql://binkerking@localhost/rich?host=/tmp&port=5432";
const ODS_URL = process.env.VTB_ODS_DATABASE_URL ?? "postgresql://binkerking@localhost/vtb_ods?host=/tmp&port=5432";
const SAFE1_SQLSERVER = {
  server: process.env.SAFE1_SQLSERVER_HOST,
  port: Number(process.env.SAFE1_SQLSERVER_PORT ?? "1433"),
  database: process.env.SAFE1_SQLSERVER_DATABASE ?? "fbdsALL",
  user: process.env.SAFE1_SQLSERVER_USER,
  password: process.env.SAFE1_SQLSERVER_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true },
};
const NOW = new Date().toISOString();

type PhysicalColumn = QueryResultRow & {
  table_name: string;
  ordinal_position: number;
  column_name: string;
  data_type: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_nullable: "YES" | "NO";
};

type DocField = {
  cn: string;
  format: string;
  validation?: string;
  description: string;
  codeSet?: string;
};

type TableSpec = {
  id: string;
  systemId: string;
  tableName: string;
  tableCn: string | null;
  dataLayer: string;
  sourceKind: string;
  description: string;
  caliber: string;
  physicalSource?: "ods" | "safe1";
  physicalTableName?: string;
};

const SYSTEMS = [
  ["vtb-safe-src", "SAFE_SOURCE", "源数据层", "file source", "源数据层", "二代 SAFE 的源文件元数据。文件字段仅记录已核验的文件名、分隔符、字段顺序和入库字段关联。"],
  ["vtb-safe-stage", "SAFE_STAGE", "贴源层（一代标准）", "database", "贴源层", "一代 SAFE 的标准贴源表：RKAiftab、RKCiftab、RKTrntab。字段结构从一代 fbdsALL 真实表读取，用作二代迁移的对照标准。"],
  ["vtb-safe-middle", "SAFE_MIDDLE", "中间层", "database", "中间层", "二代文件入库工作表 aif_tab/bln_tab/cif_tab/transaction_tab 与 CFAA/CFAAS 中间物理表。二代工作表和一代 RK* 标准表的差异单独保留。"],
  ["vtb-safe-report", "SAFE_CFA", "SAFE 报表层-CFA", "regulatory report", "报表层", "二代系统中的 CFAAN/CFAAS 正式报表物理表。"],
  ["vtb-safe-message", "SAFE_MESSAGE", "SAFE 报文层", "regulatory message", "报文层", "依据《金融机构外汇业务数据采集规范（1.4版）》并由二代存储过程写入的 EXDAN/EXDAS 报文记录。"],
] as const;

const TABLES: TableSpec[] = [
  { id: "vtb-safe-src-aif", systemId: "vtb-safe-src", tableName: "AIF2.TXT", tableCn: null, dataLayer: "源数据层", sourceKind: "文件", description: "二代 AIF2 源文件。文件名称、分隔符、字段顺序来自已保存的源文件字段元数据；中文业务名未核验的不填。", caliber: "二代源文件 AIF2.TXT。" },
  { id: "vtb-safe-src-bln", systemId: "vtb-safe-src", tableName: "BLN2.TXT", tableCn: null, dataLayer: "源数据层", sourceKind: "文件", description: "二代 BLN2 源文件。文件名称、分隔符、字段顺序来自已保存的源文件字段元数据；中文业务名未核验的不填。", caliber: "二代源文件 BLN2.TXT。" },
  { id: "vtb-safe-src-cif", systemId: "vtb-safe-src", tableName: "CIF2.TXT", tableCn: null, dataLayer: "源数据层", sourceKind: "文件", description: "二代 CIF2 源文件。文件名称、分隔符、字段顺序来自已保存的源文件字段元数据；中文业务名未核验的不填。", caliber: "二代源文件 CIF2.TXT。" },
  { id: "vtb-safe-src-trn", systemId: "vtb-safe-src", tableName: "TRN2.TXT", tableCn: null, dataLayer: "源数据层", sourceKind: "文件", description: "二代 TRN2 源文件。文件名称、分隔符、字段顺序来自已保存的源文件字段元数据；中文业务名未核验的不填。", caliber: "二代源文件 TRN2.TXT。" },
  { id: "vtb-safe-stage-rkaif", systemId: "vtb-safe-stage", tableName: "RKAiftab", tableCn: "账户及余额贴源表", dataLayer: "贴源层", sourceKind: "数据库表", description: "一代 SAFE 真实物理贴源表 dbo.RKAiftab。由账户与余额源数据导入，作为 AIF2.TXT 与 BLN2.TXT 的一代标准对照。", caliber: "一代账户与余额贴源标准。", physicalSource: "safe1" },
  { id: "vtb-safe-stage-rkcif", systemId: "vtb-safe-stage", tableName: "RKCiftab", tableCn: "客户贴源表", dataLayer: "贴源层", sourceKind: "数据库表", description: "一代 SAFE 真实物理贴源表 dbo.RKCiftab。由客户源数据导入，作为 CIF2.TXT 的一代标准对照。", caliber: "一代客户贴源标准。", physicalSource: "safe1" },
  { id: "vtb-safe-stage-rktrn", systemId: "vtb-safe-stage", tableName: "RKTrntab", tableCn: "交易流水贴源表", dataLayer: "贴源层", sourceKind: "数据库表", description: "一代 SAFE 真实物理贴源表 dbo.RKTrntab。由交易源数据导入，作为 TRN2.TXT 的一代标准对照。", caliber: "一代交易流水贴源标准。", physicalSource: "safe1" },
  { id: "vtb-safe-middle-aif", systemId: "vtb-safe-middle", tableName: "aif_tab", tableCn: null, dataLayer: "中间层", sourceKind: "数据库表", description: "二代 ODS 物理文件入库工作表 vtb.aif_tab，承接 AIF2.TXT。与一代 RKAiftab 对照，不等同于一代物理贴源表。", caliber: "二代 AIF2 文件解析工作表。", physicalSource: "ods" },
  { id: "vtb-safe-middle-bln", systemId: "vtb-safe-middle", tableName: "bln_tab", tableCn: null, dataLayer: "中间层", sourceKind: "数据库表", description: "二代 ODS 物理文件入库工作表 vtb.bln_tab，承接 BLN2.TXT。与一代 RKAiftab 的余额字段对照。", caliber: "二代 BLN2 文件解析工作表。", physicalSource: "ods" },
  { id: "vtb-safe-middle-cif", systemId: "vtb-safe-middle", tableName: "cif_tab", tableCn: null, dataLayer: "中间层", sourceKind: "数据库表", description: "二代 ODS 物理文件入库工作表 vtb.cif_tab，承接 CIF2.TXT。与一代 RKCiftab 对照，不等同于一代物理贴源表。", caliber: "二代 CIF2 文件解析工作表。", physicalSource: "ods" },
  { id: "vtb-safe-middle-trn", systemId: "vtb-safe-middle", tableName: "transaction_tab", tableCn: null, dataLayer: "中间层", sourceKind: "数据库表", description: "二代 ODS 物理文件入库工作表 vtb.transaction_tab，承接 TRN2.TXT。与一代 RKTrntab 对照，不等同于一代物理贴源表。", caliber: "二代 TRN2 文件解析工作表。", physicalSource: "ods" },
  { id: "vtb-safe-middle-cfaa", systemId: "vtb-safe-middle", tableName: "cfaa_tab", tableCn: "外债签约中间表", dataLayer: "中间层", sourceKind: "数据库表", description: "二代 ODS 物理中间表 vtb.cfaa_tab。EXDAN 写入过程以 data_type='AN' 筛选该表。", caliber: "CFAA 外债签约中间数据；AN 表示非居民机构存款。", physicalSource: "ods" },
  { id: "vtb-safe-middle-cfaas", systemId: "vtb-safe-middle", tableName: "cfaas_tab", tableCn: "外债余额中间表", dataLayer: "中间层", sourceKind: "数据库表", description: "二代 ODS 物理中间表 vtb.cfaas_tab。余额中间数据以 data_type 标识业务类型。", caliber: "CFAAS 外债余额中间数据；AN 表示非居民机构存款。", physicalSource: "ods" },
  { id: "vtb-safe-middle-cfaam", systemId: "vtb-safe-middle", tableName: "cfaam", tableCn: "外债签约业务中间表", dataLayer: "中间层", sourceKind: "数据库表", description: "二代过程 usp_vtb_safe2_extract_exd_stage 从 cfaa_tab 生成的外债签约业务中间表。", caliber: "二代外债签约业务中间数据。", physicalSource: "ods" },
  { id: "vtb-safe-middle-cfaas-business", systemId: "vtb-safe-middle", tableName: "cfaas", tableCn: "外债余额业务中间表", dataLayer: "中间层", sourceKind: "数据库表", description: "二代过程 usp_vtb_safe2_extract_exd_stage 从 cfaas_tab 汇总生成；usp_vtb_safe2_extract_exd 据此写入 EXDAS 报文。", caliber: "二代外债余额业务中间数据。", physicalSource: "ods" },
  { id: "vtb-safe-cfaan", systemId: "vtb-safe-report", tableName: "cfaan", tableCn: "外债非居民机构存款-签约信息", dataLayer: "报表层", sourceKind: "数据库表", description: "二代 ODS 正式报表物理表 vtb.cfaan。字段语义以 SAFE 1.4 发文的 AN 签约信息补充。", caliber: "CFAAN：外债非居民机构存款-签约信息。", physicalSource: "ods" },
  { id: "vtb-safe-message-exdan", systemId: "vtb-safe-message", tableName: "t_safe_exda_n", tableCn: "外债非居民机构存款-签约报文（EXDAN）", dataLayer: "报文层", sourceKind: "数据库报文表", description: "二代 ODS 报文物理表 vtb.t_safe_exda_n。由 usp_vtb_safe2_extract_exd_contracts 从 cfaa_tab 的 AN 数据写入。", caliber: "SAFE 1.4 接口类型 AN：外债非居民机构存款-签约信息。", physicalSource: "ods" },
  { id: "vtb-safe-message-exdas", systemId: "vtb-safe-message", tableName: "t_safe_exda_s", tableCn: "外债余额报文（EXDAS）", dataLayer: "报文层", sourceKind: "数据库报文表", description: "二代 ODS 报文物理表 vtb.t_safe_exda_s。由 usp_vtb_safe2_extract_exd 从 cfaas/cfaam 写入。", caliber: "SAFE 1.4 接口类型 AS：外债余额信息。", physicalSource: "ods" },
];

const DOC_FIELDS: Record<string, DocField> = {
  actiontype: { cn: "操作类型", format: "varchar(1)", validation: "必填：A-新建；C-修改；D-删除。", description: "SAFE 1.4 外债签约/余额接口的操作类型。", codeSet: "cs-safe-action" },
  actiondesc: { cn: "删除原因", format: "varchar(128)", validation: "操作类型为 D 时必填。", description: "删除报送记录时的原因。" },
  exdebtcode: { cn: "外债编号", format: "varchar(28)", validation: "必填；外债唯一性编码。", description: "国家外汇局规则下的外债唯一编号。" },
  limittype: { cn: "账户类型", format: "varchar(4)", validation: "必填；见非居民机构账户类型代码表。", description: "非居民机构账户类型。" },
  debtorcode: { cn: "债务人代码", format: "varchar(12)", validation: "必填；金融机构标识码。", description: "境内债务银行的金融机构标识码。" },
  debtype: { cn: "债务类型", format: "varchar(4)", validation: "必填；见外债债务类型代码表。", description: "外债债务类型代码。" },
  valuedate: { cn: "起息日", format: "YYYYMMDD", validation: "必填；报文格式 YYYYMMDD。", description: "账户开户日期。" },
  contractcurr: { cn: "签约币种", format: "varchar(3)", validation: "必填；见币种代码表。", description: "账户币种/签约币种。" },
  floatrate: { cn: "是否浮动利率", format: "varchar(1)", validation: "必填：Y-是；N-否，默认 N。", description: "债务利率是否为浮动利率。", codeSet: "cs-safe-yesno" },
  anninrate: { cn: "年化利率值", format: "numeric(13,8)", validation: "必填；大于等于 0；按小数填写。", description: "外债年化利率值。" },
  creditorcode: { cn: "债权人代码", format: "varchar(11)", validation: "非必填。", description: "非居民机构存款的债权人特殊机构代码。" },
  creditorname: { cn: "债权人中文名称", format: "varchar(128)", validation: "与英文名称至少填写一项。", description: "存款人的中文名称。" },
  creditornamen: { cn: "债权人英文名称", format: "varchar(128)", validation: "与中文名称至少填写一项。", description: "存款人的英文名称。" },
  creditortype: { cn: "债权人类型代码", format: "varchar(8)", validation: "必填；见境外主体类型代码表；非居民机构存款为 1303。", description: "债权人主体类型代码。" },
  crehqcode: { cn: "债权人总部所在国家（地区）代码", format: "varchar(3)", validation: "必填；见国家和地区代码表。", description: "债权人总部所在地代码。" },
  opercode: { cn: "债权人经营地所在国家（地区）代码", format: "varchar(3)", validation: "必填；非境内银行离岸部时不得为 CHN。", description: "债权人经营所在地代码。" },
  spapfeboindex: { cn: "是否不纳入跨境融资风险加权余额计算", format: "varchar(1)", validation: "必填：Y-是；N-否，默认 N。", description: "该债务是否纳入跨境融资风险加权余额计算。", codeSet: "cs-safe-yesno" },
  deptype: { cn: "存款业务类别", format: "integer", validation: "必填：1-存款；2-账户金。", description: "非居民机构存款业务类别。", codeSet: "cs-safe-deptype" },
  relation: { cn: "对方与本机构的关系", format: "varchar(2)", validation: "必填；见关系代码表。", description: "债权人与本机构的关系。" },
  originalperiod: { cn: "原始期限", format: "integer", validation: "必填：1-一年及以下（含活期或不定期）；2-一年以上。", description: "合同原始期限类别。", codeSet: "cs-safe-original-period" },
  remark: { cn: "备注", format: "varchar(256)", validation: "非必填。", description: "需要说明的备注事项。" },
  changeno: { cn: "变动编号", format: "varchar(4)", validation: "必填；4 位流水号。", description: "同一笔债务下余额信息的变动编号。" },
  buscode: { cn: "银行账号", format: "varchar(32)", validation: "必填。", description: "该笔业务在银行的账号。" },
  accoamount: { cn: "外债余额", format: "numeric(22,2)", validation: "必填；大于等于 0。", description: "账户余额。" },
  chdate: { cn: "变动日期", format: "YYYYMMDD", validation: "必填；报文格式 YYYYMMDD。", description: "账户信息变动日期。" },
};

const NAME_ALIASES: Record<string, string> = {
  action_type: "actiontype", action_desc: "actiondesc", exdebt_code: "exdebtcode", limit_type: "limittype",
  debtor_code: "debtorcode", deb_type: "debtype", value_date: "valuedate", contract_curr: "contractcurr",
  float_rate: "floatrate", annin_rate: "anninrate", creditor_code: "creditorcode", creditor_name: "creditorname",
  creditor_namen: "creditornamen", creditor_type: "creditortype", crehq_code: "crehqcode", oper_code: "opercode",
  spapfebo_index: "spapfeboindex", original_period: "originalperiod", change_no: "changeno", bus_code: "buscode",
  acco_amount: "accoamount", ch_date: "chdate",
};

const SAFE1_FIELD_INFO: Record<string, DocField> = {
  "RKAiftab.cnum": { cn: "客户编号", format: "nvarchar(50)", description: "一代导入代码由账户源数据的 ClientNumber 赋值。" },
  "RKAiftab.ccy": { cn: "币种", format: "nvarchar(3)", description: "一代导入代码由账户源数据的 CurrencyShortName 赋值。" },
  "RKAiftab.acod": { cn: "客户账户", format: "nvarchar(50)", description: "一代导入代码由账户源数据的 AccountNumber 赋值。" },
  "RKAiftab.account_type": { cn: "账户类型", format: "nvarchar(5)", description: "一代导入代码由账户源数据的 AccountType 赋值。" },
  "RKAiftab.ldbl": { cn: "折美元余额", format: "numeric(22,2)", description: "一代导入代码由账户源数据的 CurrentAccountBalance 赋值。" },
  "RKAiftab.cdbl": { cn: "原始币种余额", format: "numeric(22,2)", description: "一代导入代码由账户源数据的 AmountBalance 赋值。" },
  "RKAiftab.lmvd": { cn: "最后交易日期", format: "datetime", description: "一代导入代码由账户源数据的 LastPostDate 赋值。" },
  "RKAiftab.open_date": { cn: "开户日期", format: "datetime", description: "一代导入代码由账户源数据的 OpenedDate 赋值。" },
  "RKAiftab.close_date": { cn: "销户日期", format: "datetime", description: "一代导入代码由账户源数据的 ClosedDate 赋值。" },
  "RKAiftab.gl_code": { cn: "业务编号", format: "nvarchar(30)", description: "一代导入代码由账户源数据的 BussCode 赋值。" },
  "RKAiftab.rpt_bsCode": { cn: "报表资产负债表代码", format: "nvarchar(30)", description: "一代导入代码由账户源数据的 RptBussCode 赋值。" },
  "RKAiftab.brcd": { cn: "分支机构代码", format: "nvarchar(50)", description: "一代导入代码由账户源数据的 BranchCode 赋值。" },
  "RKAiftab.data_date": { cn: "业务数据日期", format: "datetime", description: "一代导入代码写入业务数据导入日期。" },
  "RKAiftab.import_date": { cn: "系统导入日期", format: "datetime", description: "一代导入代码写入系统导入日期。" },
  "RKCiftab.cnum": { cn: "客户号", format: "nvarchar(50)", description: "一代导入代码由客户源数据的 ClientNumber 赋值。" },
  "RKCiftab.name_en": { cn: "客户英文名称", format: "nvarchar(200)", description: "一代导入代码由客户源数据的 EnName 赋值。" },
  "RKCiftab.name_cn": { cn: "客户中文名称", format: "nvarchar(9)", description: "一代物理字段；当前已核验导入代码片段未发现该字段的赋值语句。" },
  "RKCiftab.cloc": { cn: "国家（地区）代码", format: "nvarchar(3)", description: "一代导入代码由客户源数据的 CountryCode 赋值。" },
  "RKCiftab.brcd": { cn: "分支机构代码", format: "nvarchar(50)", description: "一代导入代码由客户源数据的 BranchCode 赋值。" },
  "RKCiftab.groc": { cn: "集团编号", format: "nvarchar(50)", description: "一代导入代码由客户源数据的 BossClient 赋值。" },
  "RKCiftab.data_date": { cn: "业务数据日期", format: "datetime", description: "一代导入代码写入业务数据导入日期。" },
  "RKCiftab.import_date": { cn: "系统导入日期", format: "datetime", description: "一代导入代码写入系统导入日期。" },
  "RKTrntab.trn_id": { cn: "业务流水号", format: "nvarchar(64)", description: "一代导入代码由交易源数据的 TranchNo 赋值。" },
  "RKTrntab.cnum": { cn: "客户号", format: "nvarchar(50)", description: "一代导入代码由交易源数据的 ClientNumber 赋值。" },
  "RKTrntab.acod": { cn: "交易账号", format: "nvarchar(50)", description: "一代导入代码由交易源数据的 AccountNumber 赋值。" },
  "RKTrntab.ccy": { cn: "币种", format: "nvarchar(3)", description: "一代导入代码由 CurrencyCode 通过币种映射转换后赋值。" },
  "RKTrntab.pstd": { cn: "交易发生日期", format: "datetime", description: "一代导入代码由交易源数据的 ChangeDate 赋值。" },
  "RKTrntab.vald": { cn: "交易生效日", format: "datetime", description: "一代导入代码由交易源数据的 Vald 赋值。" },
  "RKTrntab.trat": { cn: "交易代码", format: "nvarchar(15)", description: "一代导入代码由交易源数据的 TransactionCode 赋值。" },
  "RKTrntab.pnar": { cn: "交易备注", format: "nvarchar(500)", description: "一代导入代码由交易源数据的 Remark 赋值。" },
  "RKTrntab.psta": { cn: "交易金额", format: "numeric(22,2)", description: "一代导入代码由交易源数据的 Amount 赋值。" },
  "RKTrntab.psta_usd": { cn: "折美元交易金额", format: "numeric(22,2)", description: "一代导入代码优先使用 AmountUsd；缺失时按币种汇率换算。" },
  "RKTrntab.dlref": { cn: "业务编号", format: "nvarchar(64)", description: "一代导入代码由交易源数据的 TransactionNumber 赋值。" },
  "RKTrntab.drcr": { cn: "借贷标识", format: "nvarchar(1)", description: "一代导入代码由交易源数据的 DebitOrCredit 赋值。" },
  "RKTrntab.brcd": { cn: "分支机构代码", format: "nvarchar(8)", description: "一代导入代码由交易源数据的 BranchCode 赋值。" },
  "RKTrntab.data_date": { cn: "业务数据日期", format: "datetime", description: "一代导入代码写入业务数据导入日期。" },
  "RKTrntab.import_date": { cn: "系统导入日期", format: "datetime", description: "一代导入代码写入系统导入日期。" },
};

const FILE_TO_STAGE: Record<string, { stageTable: string; stageId: string }> = {
  "AIF2.TXT": { stageTable: "aif_tab", stageId: "vtb-safe-middle-aif" },
  "BLN2.TXT": { stageTable: "bln_tab", stageId: "vtb-safe-middle-bln" },
  "CIF2.TXT": { stageTable: "cif_tab", stageId: "vtb-safe-middle-cif" },
  "TRN2.TXT": { stageTable: "transaction_tab", stageId: "vtb-safe-middle-trn" },
};

async function main(): Promise<void> {
  const rich = new Pool({ connectionString: RICH_URL });
  const ods = new Pool({ connectionString: ODS_URL });
  try {
    const sourceRows = await rich.query<SourceFieldRow>(`
      SELECT t.table_name, f.field_name, f.field_cn, f.source_field_order, f.extra
      FROM pm_data_fields f JOIN pm_data_tables t ON t.id=f.table_id
      WHERE f.project_id=$1 AND t.system_id='vtb-safe-src'
        AND f.carrier_kind='file' AND f.source_field_order IS NOT NULL
      ORDER BY t.table_name, f.source_field_order
    `, [PROJECT_ID]);
    const odsTables = TABLES.filter((table) => table.physicalSource === "ods").map((table) => table.tableName);
    const columns = await ods.query<PhysicalColumn>(`
      SELECT table_name, ordinal_position, column_name, data_type, character_maximum_length,
             numeric_precision, numeric_scale, is_nullable
      FROM information_schema.columns
      WHERE table_schema='vtb' AND table_name = ANY($1)
      ORDER BY table_name, ordinal_position
    `, [odsTables]);
    const columnsByTable = new Map<string, PhysicalColumn[]>();
    for (const column of columns.rows) {
      const list = columnsByTable.get(column.table_name) ?? [];
      list.push(column);
      columnsByTable.set(column.table_name, list);
    }
    const safe1ColumnsByTable = await loadSafe1Columns();

    await rich.query("BEGIN");
    await clearPreviousSlice(rich);
    await insertSystems(rich);
    await insertTables(rich);
    await insertSourceFields(rich, sourceRows.rows);
    await insertPhysicalFields(rich, columnsByTable, safe1ColumnsByTable);
    await insertGenerationComparison(rich);
    await insertOfficialCodeSets(rich);
    await linkCodeSets(rich);
    await insertEvidenceMappings(rich);
    await rebuildSearchIndex(rich);
    await rich.query("COMMIT");

    const summary = await rich.query(`
      SELECT s.code AS system_code, count(DISTINCT t.id) AS table_count, count(f.id) AS field_count
      FROM pm_data_systems s
      LEFT JOIN pm_data_tables t ON t.system_id=s.id
      LEFT JOIN pm_data_fields f ON f.table_id=t.id
      WHERE s.project_id=$1 AND s.id = ANY($2)
      GROUP BY s.code ORDER BY s.code
    `, [PROJECT_ID, SYSTEMS.map(([id]) => id)]);
    console.table(summary.rows);
  } catch (error) {
    await rich.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await rich.end();
    await ods.end();
  }
}

type SourceFieldRow = QueryResultRow & {
  table_name: string;
  field_name: string;
  field_cn: string | null;
  source_field_order: number;
  extra: Record<string, unknown>;
};

async function loadSafe1Columns(): Promise<Map<string, PhysicalColumn[]>> {
  if (!SAFE1_SQLSERVER.server || !SAFE1_SQLSERVER.user || !SAFE1_SQLSERVER.password) {
    throw new Error("SAFE1_SQLSERVER_HOST、SAFE1_SQLSERVER_USER、SAFE1_SQLSERVER_PASSWORD are required to rebuild the RK* stage model.");
  }
  const pool = await sql.connect(SAFE1_SQLSERVER);
  try {
    const names = TABLES.filter((table) => table.physicalSource === "safe1").map((table) => table.tableName);
    const result = await pool.request().query<{
      table_name: string;
      ordinal_position: number;
      column_name: string;
      data_type: string;
      character_maximum_length: number | null;
      numeric_precision: number | null;
      numeric_scale: number | null;
      is_nullable: boolean;
    }>(`
      SELECT t.name AS table_name, c.column_id AS ordinal_position, c.name AS column_name,
             ty.name AS data_type,
             CASE WHEN ty.name IN ('varchar','nvarchar','char','nchar')
               THEN CASE WHEN c.max_length=-1 THEN NULL
                         WHEN ty.name IN ('nvarchar','nchar') THEN c.max_length / 2
                         ELSE c.max_length END END AS character_maximum_length,
             c.precision AS numeric_precision, c.scale AS numeric_scale, c.is_nullable
      FROM sys.tables t
      JOIN sys.columns c ON c.object_id=t.object_id
      JOIN sys.types ty ON ty.user_type_id=c.user_type_id
      WHERE t.name IN (${names.map((name) => `'${name}'`).join(",")})
      ORDER BY t.name, c.column_id
    `);
    const byTable = new Map<string, PhysicalColumn[]>();
    for (const column of result.recordset) {
      const columns = byTable.get(column.table_name) ?? [];
      columns.push({ ...column, is_nullable: column.is_nullable ? "YES" : "NO" });
      byTable.set(column.table_name, columns);
    }
    return byTable;
  } finally {
    await pool.close();
  }
}

async function clearPreviousSlice(pg: Pool): Promise<void> {
  const systemIds = SYSTEMS.map(([id]) => id);
  await pg.query("DELETE FROM pm_search_index WHERE project_id=$1 AND module_key='dictionary'", [PROJECT_ID]);
  await pg.query("DELETE FROM pm_mapping_rules WHERE project_id=$1 AND system_id = ANY($2)", [PROJECT_ID, systemIds]);
  await pg.query(`
    DELETE FROM pm_entity_links
    WHERE project_id=$1 AND (
      from_id IN (SELECT id FROM pm_data_tables WHERE project_id=$1 AND system_id = ANY($2))
      OR to_id IN (SELECT id FROM pm_data_tables WHERE project_id=$1 AND system_id = ANY($2))
      OR from_id IN (
        SELECT f.id FROM pm_data_fields f
        JOIN pm_data_tables t ON t.id=f.table_id
        WHERE f.project_id=$1 AND t.system_id = ANY($2)
      )
      OR to_id IN (
        SELECT f.id FROM pm_data_fields f
        JOIN pm_data_tables t ON t.id=f.table_id
        WHERE f.project_id=$1 AND t.system_id = ANY($2)
      )
    )
  `, [PROJECT_ID, systemIds]);
  await pg.query("DELETE FROM pm_data_tables WHERE project_id=$1 AND system_id = ANY($2)", [PROJECT_ID, systemIds]);
  await pg.query("DELETE FROM pm_code_sets WHERE project_id=$1 AND id LIKE 'cs-safe-%'", [PROJECT_ID]);
  await pg.query("DELETE FROM pm_data_systems WHERE project_id=$1 AND id = ANY($2)", [PROJECT_ID, systemIds]);
}

async function insertSystems(pg: Pool): Promise<void> {
  for (const [id, code, name, type, assetLayer, description] of SYSTEMS) {
    await pg.query(`
      INSERT INTO pm_data_systems (id, project_id, code, name, type, asset_layer, description, extra, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$9)
    `, [id, PROJECT_ID, code, name, type, assetLayer, description, JSON.stringify({ evidence: ["vtb_ods physical schema", "SAFE 1.4 specification", "SAFE1 Java (middle layer only)"] }), NOW]);
  }
}

async function insertTables(pg: Pool): Promise<void> {
  for (const table of TABLES) {
    await pg.query(`
      INSERT INTO pm_data_tables (
        id, project_id, system_id, database_name, schema_name, table_name, table_cn,
        description, caliber, extra, data_layer, source_kind, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$13)
    `, [
      table.id, PROJECT_ID, table.systemId,
      table.physicalSource === "ods" ? "vtb_ods" : table.physicalSource === "safe1" ? "fbdsALL" : null,
      table.physicalSource === "ods" ? "vtb" : table.physicalSource === "safe1" ? "dbo" : null,
      table.tableName, table.tableCn, table.description, table.caliber,
      JSON.stringify({
        evidence: table.physicalSource === "ods" ? ["vtb_ods.vtb physical schema"] : table.physicalSource === "safe1" ? ["SAFE1 fbdsALL.dbo physical schema"] : ["source-file metadata"],
        physicalObject: table.physicalSource === "ods" ? `vtb_ods.vtb.${table.tableName}` : table.physicalSource === "safe1" ? `fbdsALL.dbo.${table.tableName}` : null,
        officialSpecification: table.systemId === "vtb-safe-message" ? "金融机构外汇业务数据采集规范（1.4版）" : null,
      }),
      table.dataLayer, table.sourceKind, NOW,
    ]);
  }
}

async function insertSourceFields(pg: Pool, fields: SourceFieldRow[]): Promise<void> {
  for (const field of fields) {
    const source = FILE_TO_STAGE[field.table_name];
    if (!source) continue;
    const sourceMeta = ((field.extra ?? {}).sourceFileField ?? {}) as Record<string, unknown>;
    const position = field.source_field_order;
    const delimiter = text(sourceMeta.delimiterOrLayout) || "待确认";
    const fieldId = stableId("safe-source-field", `${field.table_name}|${field.field_name}`);
    await pg.query(`
      INSERT INTO pm_data_fields (
        id, project_id, system_id, table_id, field_name, field_cn, field_type, field_length,
        format_pattern, nullable, primary_key, required, description, mapped_table, mapped_field,
        mapped_field_cn, data_source, remark, extra, field_order, source_field_order, carrier_kind, created_at, updated_at
      ) VALUES ($1,$2,'vtb-safe-src',$3,$4,$5,'text',NULL,$6,'YES',false,false,$7,$8,$4,$5,'源文件',$9,$10::jsonb,$11,$11,'file',$12,$12)
    `, [
      fieldId, PROJECT_ID, sourceTableId(field.table_name), field.field_name, field.field_cn,
      `分隔符 ${delimiter}；第 ${position} 字段`,
      `源文件 ${field.table_name} 的第 ${position} 字段，按分隔符 ${delimiter} 解析后入库至 vtb.${source.stageTable}.${field.field_name}。`,
      source.stageTable,
      "文件字段名和中文名以已保存的源文件元数据为准；未核验中文名保持为空。",
      JSON.stringify({ evidence: ["source-file field metadata", `vtb.${source.stageTable} physical schema`], sourceFileField: { sourceFile: field.table_name, parseMode: "分隔符", delimiterOrLayout: delimiter, fieldPosition: `第 ${position} 字段`, stageField: field.field_name } }),
      position, NOW,
    ]);
    await pg.query(`
      INSERT INTO pm_entity_links (id, project_id, from_type, from_id, to_type, to_id, relation_type, metadata, created_at)
      VALUES ($1,$2,'field',$3,'field',$4,'file_ingests_to',$5::jsonb,$6)
    `, [
      stableId("safe-file-link", `${field.table_name}|${field.field_name}`), PROJECT_ID, fieldId,
      physicalFieldId(source.stageId, field.field_name),
      JSON.stringify({ sourceFile: field.table_name, sourceFieldOrder: position, delimiter }), NOW,
    ]);
  }
}

async function insertPhysicalFields(
  pg: Pool,
  odsColumnsByTable: Map<string, PhysicalColumn[]>,
  safe1ColumnsByTable: Map<string, PhysicalColumn[]>,
): Promise<void> {
  for (const table of TABLES.filter((candidate) => candidate.physicalSource)) {
    const columns = (table.physicalSource === "safe1" ? safe1ColumnsByTable : odsColumnsByTable).get(table.tableName) ?? [];
    if (!columns.length) throw new Error(`No physical columns found for ${table.physicalSource === "safe1" ? "fbdsALL.dbo" : "vtb_ods.vtb"}.${table.tableName}`);
    const sourceFile = sourceFileForStage(table.tableName);
    for (const column of columns) {
      const doc = documentField(column.column_name) ?? SAFE1_FIELD_INFO[`${table.tableName}.${column.column_name}`];
      const sourceField = sourceFile && column.column_name !== "id" ? physicalFieldId(sourceTableId(sourceFile), column.column_name) : null;
      const sourceCn = sourceFile ? await lookupSourceCn(pg, sourceFile, column.column_name) : null;
      const fieldId = physicalFieldId(table.id, column.column_name);
      const sourceDescription = sourceFile && column.column_name !== "id"
        ? `；对应源文件 ${sourceFile}，文件字段位置以源文件元数据为准`
        : "";
      await pg.query(`
        INSERT INTO pm_data_fields (
          id, project_id, system_id, table_id, field_name, field_cn, field_type, field_length,
          format_pattern, nullable, primary_key, required, description, validation_rule, code_value,
          mapped_table, mapped_field, mapped_field_cn, data_source, remark, extra,
          field_order, source_field_order, carrier_kind, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NULL,$15,$16,$17,'vtb_ods', $18,$19::jsonb,$20,NULL,'database',$21,$21)
      `, [
        fieldId, PROJECT_ID, table.systemId, table.id, column.column_name, doc?.cn ?? sourceCn,
        databaseType(column), databaseLength(column), doc?.format ?? physicalFormat(column), column.is_nullable,
        column.column_name === "id", Boolean(doc?.validation),
        doc?.description ?? `${table.physicalSource === "safe1" ? "一代" : "二代"}物理列 ${table.physicalSource === "safe1" ? "fbdsALL.dbo" : "vtb_ods.vtb"}.${table.tableName}.${column.column_name}${sourceDescription}。`,
        doc?.validation ?? null,
        sourceFile && column.column_name !== "id" ? sourceFile : null,
        sourceFile && column.column_name !== "id" ? column.column_name : null,
        sourceCn,
        doc ? "字段业务语义和校验以 SAFE 1.4 发文为准；物理类型、长度和顺序以已核验物理表为准。" : "未在当前已核验文档或导入赋值代码中找到明确中文含义，仅保留物理列事实。",
        JSON.stringify({ evidence: doc ? ["SAFE 1.4 specification", `${table.physicalSource === "safe1" ? "fbdsALL.dbo" : "vtb_ods.vtb"}.${table.tableName}`] : [`${table.physicalSource === "safe1" ? "fbdsALL.dbo" : "vtb_ods.vtb"}.${table.tableName}`], physical: true, physicalColumnOrder: column.ordinal_position, generation: table.physicalSource === "safe1" ? "SAFE1" : "SAFE2" }),
        column.ordinal_position, NOW,
      ]);
    }
  }
}

async function insertGenerationComparison(pg: Pool): Promise<void> {
  const comparisons = [
    ["vtb-safe-stage-rkaif", ["vtb-safe-middle-aif", "vtb-safe-middle-bln"], "RKAiftab 对照二代 AIF2/BLN2 文件入库工作表：一代账户与余额合并入表，二代拆为 aif_tab 与 bln_tab。", 56, 23],
    ["vtb-safe-stage-rkcif", ["vtb-safe-middle-cif"], "RKCiftab 对照二代 CIF2 文件入库工作表：一代 32 列，二代 25 列，命名及部分业务属性存在代际差异。", 32, 25],
    ["vtb-safe-stage-rktrn", ["vtb-safe-middle-trn"], "RKTrntab 对照二代 TRN2 文件入库工作表：一代 71 列，二代 53 列，命名及字段集合存在代际差异。", 71, 53],
  ] as const;
  for (const [legacyTableId, safe2TableIds, description, legacyCount, safe2Count] of comparisons) {
    for (const safe2TableId of safe2TableIds) {
      await pg.query(`
        INSERT INTO pm_entity_links (id, project_id, from_type, from_id, to_type, to_id, relation_type, metadata, created_at)
        VALUES ($1,$2,'table',$3,'table',$4,'generation_comparison',$5::jsonb,$6)
      `, [
        stableId("safe-generation-comparison", `${legacyTableId}|${safe2TableId}`), PROJECT_ID, legacyTableId, safe2TableId,
        JSON.stringify({ generation: "SAFE1_to_SAFE2", description, legacyFieldCount: legacyCount, safe2FieldCount: safe2Count, comparisonStatus: "reviewed_schema_difference" }), NOW,
      ]);
    }
  }

  const confirmedMappings = [
    ["vtb-safe-stage-rkaif", "cnum", "vtb-safe-middle-aif", "customer_id"],
    ["vtb-safe-stage-rkaif", "ccy", "vtb-safe-middle-aif", "currency_code"],
    ["vtb-safe-stage-rkaif", "acod", "vtb-safe-middle-aif", "account_id"],
    ["vtb-safe-stage-rkaif", "account_type", "vtb-safe-middle-aif", "account_type"],
    ["vtb-safe-stage-rkaif", "open_date", "vtb-safe-middle-aif", "account_open_time"],
    ["vtb-safe-stage-rkaif", "close_date", "vtb-safe-middle-aif", "account_close_time"],
    ["vtb-safe-stage-rkaif", "limittype", "vtb-safe-middle-aif", "limit_type"],
    ["vtb-safe-stage-rkaif", "limitccy", "vtb-safe-middle-aif", "limit_ccy"],
    ["vtb-safe-stage-rkaif", "limitamt", "vtb-safe-middle-aif", "limit_amt"],
    ["vtb-safe-stage-rkaif", "gl_code", "vtb-safe-middle-aif", "glcode"],
    ["vtb-safe-stage-rkaif", "ldbl", "vtb-safe-middle-bln", "ldbl"],
    ["vtb-safe-stage-rkaif", "cdbl", "vtb-safe-middle-bln", "cdbl"],
    ["vtb-safe-stage-rkaif", "cdbl_usd", "vtb-safe-middle-bln", "cdbl_usd"],
    ["vtb-safe-stage-rkaif", "cdbl_cny", "vtb-safe-middle-bln", "cdbl_cny"],
    ["vtb-safe-stage-rkaif", "ldbl_usd", "vtb-safe-middle-bln", "ldbl_usd"],
    ["vtb-safe-stage-rkaif", "ldbl_cny", "vtb-safe-middle-bln", "ldbl_cny"],
    ["vtb-safe-stage-rkcif", "cnum", "vtb-safe-middle-cif", "customer_id"],
    ["vtb-safe-stage-rkcif", "name_en", "vtb-safe-middle-cif", "customers_english_name"],
    ["vtb-safe-stage-rkcif", "name_cn", "vtb-safe-middle-cif", "customers_chinese_name"],
    ["vtb-safe-stage-rkcif", "istaxfree", "vtb-safe-middle-cif", "istaxfree"],
    ["vtb-safe-stage-rkcif", "taxfreecode", "vtb-safe-middle-cif", "taxfreecode"],
    ["vtb-safe-stage-rkcif", "address", "vtb-safe-middle-cif", "customers_address"],
    ["vtb-safe-stage-rktrn", "cnum", "vtb-safe-middle-trn", "customer_code"],
    ["vtb-safe-stage-rktrn", "acod", "vtb-safe-middle-trn", "account_id"],
    ["vtb-safe-stage-rktrn", "ccy", "vtb-safe-middle-trn", "currency_code"],
    ["vtb-safe-stage-rktrn", "psta", "vtb-safe-middle-trn", "trade_amount"],
    ["vtb-safe-stage-rktrn", "local_bank_fee", "vtb-safe-middle-trn", "local_bank_fee"],
    ["vtb-safe-stage-rktrn", "foreign_bank_fee", "vtb-safe-middle-trn", "foreign_bank_fee"],
  ] as const;
  for (const [legacyTableId, legacyFieldName, safe2TableId, safe2FieldName] of confirmedMappings) {
    await pg.query(`
      INSERT INTO pm_entity_links (id, project_id, from_type, from_id, to_type, to_id, relation_type, metadata, created_at)
      VALUES ($1,$2,'field',$3,'field',$4,'generation_field_equivalent',$5::jsonb,$6)
    `, [
      stableId("safe-generation-field", `${legacyTableId}.${legacyFieldName}|${safe2TableId}.${safe2FieldName}`), PROJECT_ID,
      physicalFieldId(legacyTableId, legacyFieldName), physicalFieldId(safe2TableId, safe2FieldName),
      JSON.stringify({ evidence: "SAFE1 import assignments + both physical schemas", comparisonStatus: "confirmed_semantic_equivalent" }), NOW,
    ]);
  }
}

async function insertOfficialCodeSets(pg: Pool): Promise<void> {
  const sets = [
    ["cs-safe-action", "外债操作类型", "SAFE_ACTIONTYPE", "SAFE 1.4 规定的外债签约/余额报文操作类型。", [["A", "新建"], ["C", "修改"], ["D", "删除"]]],
    ["cs-safe-yesno", "是/否标识", "SAFE_YN", "SAFE 1.4 规定的 Y/N 标识。", [["Y", "是"], ["N", "否"]]],
    ["cs-safe-deptype", "非居民机构存款业务类别", "SAFE_DEPTYPE", "SAFE 1.4 的存款业务类别。", [["1", "存款"], ["2", "账户金"]]],
    ["cs-safe-original-period", "原始期限", "SAFE_ORIGINAL_PERIOD", "SAFE 1.4 的原始期限分类。", [["1", "一年及以下（含活期或不定期）"], ["2", "一年以上"]]],
  ] as const;
  for (const [id, name, code, description, values] of sets) {
    await pg.query("INSERT INTO pm_code_sets (id, project_id, name, code, description, raw, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$7)", [id, PROJECT_ID, name, code, description, JSON.stringify({ evidence: "金融机构外汇业务数据采集规范（1.4版）" }), NOW]);
    for (const [index, [value, label]] of values.entries()) {
      await pg.query("INSERT INTO pm_code_items (id, project_id, code_set_id, code, label, sort_order, raw, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$8)", [stableId("safe-code", `${id}|${value}`), PROJECT_ID, id, value, label, index + 1, JSON.stringify({ evidence: "SAFE 1.4" }), NOW]);
    }
  }
}

async function linkCodeSets(pg: Pool): Promise<void> {
  for (const table of TABLES.filter((candidate) => candidate.physicalSource)) {
    const columns = await pg.query<{ id: string; field_name: string }>("SELECT id, field_name FROM pm_data_fields WHERE table_id=$1", [table.id]);
    for (const field of columns.rows) {
      const codeSet = documentField(field.field_name)?.codeSet;
      if (!codeSet) continue;
      await pg.query("INSERT INTO pm_field_code_sets (project_id, field_id, code_set_id, relation_kind, created_at) VALUES ($1,$2,$3,'uses_code_set',$4)", [PROJECT_ID, field.id, codeSet, NOW]);
    }
  }
}

async function insertEvidenceMappings(pg: Pool): Promise<void> {
  const cfaa = "vtb-safe-middle-cfaa";
  const cfaam = "vtb-safe-middle-cfaam";
  const cfaas = "vtb-safe-middle-cfaas-business";
  const exdan = "vtb-safe-message-exdan";
  const exdas = "vtb-safe-message-exdas";
  const mappings = [
    ["actiontype", "action_type", "COALESCE(NULLIF(t.action_type, ''), 'A')", "默认值"],
    ["actiondesc", "action_desc", "t.action_desc", "直取"],
    ["anninrate", "annin_rate", "t.annin_rate", "直取"],
    ["contractamount", "contract_amount", "t.contract_amount", "直取"],
    ["contractcurr", "contract_curr", "left(t.contract_curr, 3)", "格式处理"],
    ["creditorcode", "creditor_code", "left(t.creditor_code, 11)", "格式处理"],
    ["creditorname", "creditor_name", "t.creditor_name", "直取"],
    ["creditornamen", "creditor_namen", "t.creditor_namen", "直取"],
    ["creditortype", "creditor_type", "t.creditor_type", "直取"],
    ["crehqcode", "crehq_code", "t.crehq_code", "直取"],
    ["debtype", "deb_type", "t.deb_type", "直取"],
    ["debtorcode", "debtor_code", "CASE WHEN p_branch_code IN ('310000167001','310000151101') THEN p_branch_code ELSE t.debtor_code END", "条件判断"],
    ["deptype", "", "1", "默认值"],
    ["exdebtcode", "exdebt_code", "t.exdebt_code", "直取"],
    ["floatrate", "float_rate", "t.float_rate", "直取"],
    ["limittype", "limit_type", "COALESCE(t.limit_type, 'NRA')", "默认值"],
    ["opercode", "oper_code", "t.oper_code", "直取"],
    ["originalperiod", "original_period", "t.original_period", "直取"],
    ["relation", "relation", "t.relation", "直取"],
    ["remark", "remark", "t.remark", "直取"],
    ["spapfeboindex", "spapfebo_index", "t.spapfebo_index", "直取"],
    ["valuedate", "value_date", "t.value_date", "直取"],
  ] as const;
  for (const [targetName, sourceName, expression, actionType] of mappings) {
    const id = stableId("safe-exdan-map", targetName);
    const targetId = physicalFieldId(exdan, targetName);
    await pg.query(`
      INSERT INTO pm_mapping_rules (id, project_id, system_id, table_id, field_id, status, logic_text, converted_sql, remark, sort_order, raw, created_at, updated_at)
      VALUES ($1,$2,'vtb-safe-message',$3,$4,'completed',$5,$6,$7,$8,$9::jsonb,$10,$10)
    `, [
      id, PROJECT_ID, exdan, targetId,
      `二代过程 usp_vtb_safe2_extract_exd_contracts：仅处理 cfaa_tab.data_type='AN'，${targetName} 使用 ${expression}。`,
      `SELECT ${expression} AS ${targetName} FROM vtb.cfaa_tab t WHERE t.data_type='AN' AND t.value_date::date = :business_date;`,
      "证据：vtb.usp_vtb_safe2_extract_exd_contracts 第 105-124 行。",
      mappings.indexOf([targetName, sourceName, expression, actionType] as never) + 1,
      JSON.stringify({ evidence: "vtb.usp_vtb_safe2_extract_exd_contracts", actionType, scenario: "非居民机构存款（AN）签约报送" }), NOW,
    ]);
    await pg.query("INSERT INTO pm_mapping_actions (id, project_id, mapping_rule_id, action_type, expression_text, result_text, sort_order, raw, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,1,$7::jsonb,$8,$8)", [stableId("safe-exdan-action", targetName), PROJECT_ID, id, actionType, expression, targetName, JSON.stringify({ evidence: "usp_vtb_safe2_extract_exd_contracts" }), NOW]);
    if (sourceName) {
      const sourceFieldId = physicalFieldId(cfaa, sourceName);
      const sourceRefId = stableId("safe-exdan-source", targetName);
      await pg.query("INSERT INTO pm_mapping_source_fields (id, project_id, mapping_rule_id, field_id, ref_path, alias, role, sort_order, raw, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,'t','source',1,$6::jsonb,$7,$7)", [sourceRefId, PROJECT_ID, id, sourceFieldId, `SAFE_MIDDLE.cfaa_tab.${sourceName}`, JSON.stringify({ evidence: "usp_vtb_safe2_extract_exd_contracts" }), NOW]);
      await pg.query("INSERT INTO pm_mapping_action_source_fields (project_id, action_id, source_field_id, relation_kind, created_at) VALUES ($1,$2,$3,'uses',$4)", [PROJECT_ID, stableId("safe-exdan-action", targetName), sourceRefId, NOW]);
    }
  }
  await pg.query(`
    INSERT INTO pm_mapping_rules (id, project_id, system_id, table_id, status, logic_text, converted_sql, remark, sort_order, raw, created_at, updated_at)
    VALUES ($1,$2,'vtb-safe-middle',$3,'cannot_convert',$4,NULL,$5,1,$6::jsonb,$7,$7)
  `, [
    "safe-cfaan-middle-preparation", PROJECT_ID, cfaa,
    "一代 CfaanMetroExtractServiceImpl 从账户余额候选生成 CFAATab/CFAASTab：账户类型 3400 或指定客户，写入 data_type='AN'、余额和若干默认值；二代库中尚未发现等价的 cfaa_tab 构造存储过程。",
    "保留一代 Java 作为中间层业务证据；由于二代 ETL/存储过程中没有 cfaa_tab 的完整构造 SQL，本规则不标记为可转换。",
    JSON.stringify({ evidence: "SAFE1 CfaanMetroExtractServiceImpl.java:53-115", missingEvidence: "SAFE2 cfaa_tab 生成 ETL/存储过程" }), NOW,
  ]);
}

async function rebuildSearchIndex(pg: Pool): Promise<void> {
  await pg.query(`
    INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
    SELECT 'dict-system:' || id, project_id, 'dictionary', 'system', id, name, code, description, code || ' ' || coalesce(asset_layer,''),
      name || ' ' || code || ' ' || coalesce(description,'') || ' ' || coalesce(asset_layer,''), $2
    FROM pm_data_systems WHERE project_id=$1 AND id = ANY($3)
  `, [PROJECT_ID, NOW, SYSTEMS.map(([id]) => id)]);
  await pg.query(`
    INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
    SELECT 'dict-table:' || id, project_id, 'dictionary', 'table', id, table_name, coalesce(table_cn,''), coalesce(description,''), coalesce(data_layer,'') || ' ' || coalesce(source_kind,''),
      table_name || ' ' || coalesce(table_cn,'') || ' ' || coalesce(description,'') || ' ' || coalesce(data_layer,'') || ' ' || coalesce(source_kind,''), $2
    FROM pm_data_tables WHERE project_id=$1 AND id = ANY($3)
  `, [PROJECT_ID, NOW, TABLES.map((table) => table.id)]);
  await pg.query(`
    INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
    SELECT 'dict-field:' || id, project_id, 'dictionary', 'field', id, field_name, coalesce(field_cn,''), coalesce(description,''), coalesce(field_type,'') || ' ' || coalesce(format_pattern,''),
      field_name || ' ' || coalesce(field_cn,'') || ' ' || coalesce(description,'') || ' ' || coalesce(field_type,'') || ' ' || coalesce(format_pattern,''), $2
    FROM pm_data_fields WHERE project_id=$1 AND table_id = ANY($3)
  `, [PROJECT_ID, NOW, TABLES.map((table) => table.id)]);
}

function documentField(name: string): DocField | undefined {
  return DOC_FIELDS[NAME_ALIASES[name] ?? name];
}

function sourceTableId(name: string): string {
  return TABLES.find((table) => table.tableName === name)?.id ?? "";
}

function sourceFileForStage(tableName: string): string | null {
  return Object.entries(FILE_TO_STAGE).find(([, value]) => value.stageTable === tableName)?.[0] ?? null;
}

function physicalFieldId(tableId: string, fieldName: string): string {
  return stableId("safe-field", `${tableId}|${fieldName}`);
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${createHash("sha1").update(`${PROJECT_ID}:${value}`).digest("hex").slice(0, 20)}`;
}

function databaseType(column: PhysicalColumn): string {
  if (column.data_type === "character varying") return "varchar";
  if (column.data_type === "timestamp without time zone") return "timestamp";
  return column.data_type;
}

function databaseLength(column: PhysicalColumn): string | null {
  if (column.character_maximum_length) return String(column.character_maximum_length);
  if (column.numeric_precision) return `${column.numeric_precision}${column.numeric_scale !== null ? `,${column.numeric_scale}` : ""}`;
  return null;
}

function physicalFormat(column: PhysicalColumn): string {
  const type = databaseType(column);
  const length = databaseLength(column);
  return length ? `${type}(${length})` : type;
}

async function lookupSourceCn(pg: Pool, sourceFile: string, fieldName: string): Promise<string | null> {
  const result = await pg.query<{ field_cn: string | null }>("SELECT field_cn FROM pm_data_fields WHERE id=$1", [stableId("safe-source-field", `${sourceFile}|${fieldName}`)]);
  return result.rows[0]?.field_cn ?? null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
