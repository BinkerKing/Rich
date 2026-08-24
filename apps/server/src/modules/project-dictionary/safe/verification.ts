export type SafeDictionarySnapshot = {
  systems: string[];
  tablesBySystem: Record<string, string[]>;
  sourceStageLinkCount: number;
  publishedMappingCount: number;
  verifiedMappingCount: number;
  intermediateMappingCount: number;
};

const REQUIRED_SYSTEMS = ["SAFE_SOURCE", "SAFE_STAGE", "SAFE_MIDDLE"];
const REQUIRED_SOURCE_FILES = ["AIF2.TXT", "BLN2.TXT", "CIF2.TXT", "TRN2.TXT"];
const REQUIRED_STAGE_TABLES = ["AifTab", "BlnTab", "CifTab", "TransactionTab"];

/**
 * Validates only the confirmed SAFE dictionary baseline. It intentionally does
 * not claim an unconfirmed CFAA construction or a production extraction run.
 */
export function verifySafeDictionarySnapshot(snapshot: SafeDictionarySnapshot): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  for (const system of REQUIRED_SYSTEMS) {
    if (!snapshot.systems.includes(system)) issues.push(`缺少 SAFE 系统：${system}`);
  }
  verifyRequiredObjects(snapshot.tablesBySystem.SAFE_SOURCE ?? [], REQUIRED_SOURCE_FILES, "源文件", issues);
  verifyRequiredObjects(snapshot.tablesBySystem.SAFE_STAGE ?? [], REQUIRED_STAGE_TABLES, "贴源表", issues);
  if (snapshot.sourceStageLinkCount <= 0) issues.push("缺少已确认的源文件到贴源层关系");
  if (snapshot.intermediateMappingCount <= 0) issues.push("缺少中间层已发布 Mapping");
  if (snapshot.publishedMappingCount + snapshot.verifiedMappingCount <= 0) issues.push("缺少已发布或已验证的 SAFE Mapping");
  return { ok: issues.length === 0, issues };
}

function verifyRequiredObjects(actual: string[], required: string[], label: string, issues: string[]): void {
  const actualNames = new Set(actual.map(name => name.toLowerCase()));
  for (const name of required) {
    if (!actualNames.has(name.toLowerCase())) issues.push(`缺少${label}：${name}`);
  }
}
