import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import {
  parseSafeSourceFile,
  type SafeParsedTestData as ParsedTestData,
  type SafeSourceField,
} from "../src/modules/project-dictionary/safe/sourceFileIngestion.js";

const PROJECT_ID = "vtb-二代safe";
const SYSTEM_ID = "vtb-safe-src";
const RICH_URL = process.env.RICH_DB_URL ?? "postgresql://binkerking@localhost/rich?host=/tmp&port=5432";
const NOW = new Date().toISOString();
const SAMPLE_LIMIT = 50;

const TEST_FILES: Record<string, string> = {
  "AIF2.TXT": "/Users/binkerking/Documents/Riking-Project/8-VBT/马天明给的代码文件/接口文件(测试)/2025-07-15/AIF2.TXT",
  "CIF2.TXT": "/Users/binkerking/Documents/Riking-Project/8-VBT/马天明给的代码文件/接口文件(测试)/2025-07-15/CIF2.TXT",
  "BLN2.TXT": "/Users/binkerking/Documents/Riking-Project/8-VBT/马天明给的代码文件/接口文件(测试)/2025-07-15/BLN2.TXT",
  "TRN2.TXT": "/Users/binkerking/Documents/Riking-Project/8-VBT/马天明给的代码文件/接口文件(测试)/2025-07-15/TRN2.txt",
};

type SourceField = SafeSourceField & {
  source_field_order: number | null;
  field_order: number | null;
};

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: RICH_URL });
  const client = await pool.connect();
  const summaries: Record<string, { records: number; samples: number; columnCounts: Record<string, number> }> = {};
  try {
    await client.query("BEGIN");
    for (const [tableName, sourceFilePath] of Object.entries(TEST_FILES)) {
      const fields = await listSourceFields(client, tableName);
      const testData = await parseTestFile(sourceFilePath, tableName, fields);
      await updateTableTestData(client, tableName, testData);
      summaries[tableName] = {
        records: testData.recordCount,
        samples: testData.sampleCount,
        columnCounts: testData.columnCounts,
      };
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.table(summaries);
}

async function listSourceFields(client: PoolClient, tableName: string): Promise<SourceField[]> {
  const result = await client.query<SourceField>(
    `
      SELECT f.field_name AS "fieldName", f.source_field_order, f.field_order
      FROM pm_data_fields f
      JOIN pm_data_tables t ON t.id=f.table_id
      WHERE f.project_id=$1 AND t.project_id=$1 AND t.system_id=$2 AND t.table_name=$3
      ORDER BY COALESCE(f.source_field_order, f.field_order, 2147483647), f.created_at, f.id
    `,
    [PROJECT_ID, SYSTEM_ID, tableName],
  );
  return result.rows;
}

async function parseTestFile(sourceFilePath: string, sourceFileName: string, fields: SourceField[]): Promise<ParsedTestData> {
  const buffer = await readFile(sourceFilePath);
  return parseSafeSourceFile({
    sourceFilePath,
    sourceFileName,
    buffer,
    fields,
    importedAt: NOW,
    sampleLimit: SAMPLE_LIMIT,
  });
}

async function updateTableTestData(client: PoolClient, tableName: string, testData: ParsedTestData): Promise<void> {
  await client.query(
    `
      UPDATE pm_data_tables
      SET extra = extra || $4::jsonb,
          updated_at = $5
      WHERE project_id=$1 AND system_id=$2 AND table_name=$3
    `,
    [
      PROJECT_ID,
      SYSTEM_ID,
      tableName,
      JSON.stringify({
        testData,
      }),
      NOW,
    ],
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
