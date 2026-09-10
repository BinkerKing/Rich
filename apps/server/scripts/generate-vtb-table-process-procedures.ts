import { readFile, writeFile } from "node:fs/promises";

const SOURCE = "/Users/binkerking/Documents/Riking-Project/8-VBT/04-环境与部署/项目部署/sql/vtb_ods_postgres_setup.sql";
const OUTPUT = new URL("./sql/vtb-table-process-procedures.sql", import.meta.url);

const TARGETS: Record<string, string[]> = {
  usp_vtb_safe2_extract_acc: ["t_safe_accca", "t_safe_acccb"],
  usp_vtb_safe2_extract_exd_contracts: ["t_safe_exda_n"],
  usp_vtb_safe2_extract_exd: ["t_safe_exda_s"],
  usp_vtb_safe2_extract_cfa: ["t_safe_cfac_a", "t_safe_cfac_b", "t_safe_cfad_a", "t_safe_cfad_b", "t_safe_cfada_fogucodeinfo"],
  usp_vtb_safe2_extract_fal: ["t_safe_fal_z02", "t_safe_fald_02", "t_safe_fald_0501", "t_safe_fald_09", "t_safe_falf_01"],
  usp_vtb_safe2_extract_jsh: ["fae_base_info", "fae_manage", "t_safe_jshd", "t_safe_jshe", "t_safe_jshd_f", "t_safe_jshe_g"],
};

function procedureBlock(source: string, name: string): string {
  const signature = `CREATE OR REPLACE PROCEDURE vtb.${name}(`;
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Missing procedure: ${name}`);
  const next = source.indexOf("\nCREATE OR REPLACE PROCEDURE vtb.", start + signature.length);
  return source.slice(start, next < 0 ? source.length : next);
}

function statementAt(body: string, position: number): string {
  const boundary = Math.max(body.lastIndexOf(";\n", position), body.lastIndexOf("BEGIN\n", position));
  const start = boundary < 0 ? 0 : boundary + (body.startsWith("BEGIN\n", boundary) ? "BEGIN\n".length : 2);
  const end = body.indexOf(";\n", position);
  if (end < 0) throw new Error("Unterminated DML statement");
  return body.slice(start, end + 1).trim();
}

function tableStatements(body: string, table: string): string[] {
  const pattern = new RegExp(`(?:DELETE FROM|INSERT INTO|UPDATE) vtb\\.${table}(?:\\s|\\()`, "gi");
  const statements: string[] = [];
  for (const match of body.matchAll(pattern)) {
    const statement = statementAt(body, match.index ?? 0);
    if (!statements.includes(statement)) statements.push(statement);
  }
  const deletes = statements.filter((statement) => /^DELETE FROM/i.test(statement));
  const writes = statements.filter((statement) => !/^DELETE FROM/i.test(statement));
  return [...deletes, ...writes];
}

function render(source: string, origin: string, table: string): string {
  const block = procedureBlock(source, origin);
  const signature = `CREATE OR REPLACE PROCEDURE vtb.${origin}(`;
  const parameterEnd = block.indexOf(")\nLANGUAGE plpgsql");
  const parameters = block.slice(signature.length, parameterEnd).trim();
  const bodyStart = block.indexOf("AS $$") + "AS $$".length;
  const bodyEnd = block.lastIndexOf("$$;");
  const body = block.slice(bodyStart, bodyEnd);
  const statements = tableStatements(body, table);
  if (!statements.length) throw new Error(`${origin} has no DML for ${table}`);
  const procedureName = `usp_vtb_table_${table}`;
  return `/* One target table only. Extracted without changing the original DML from ${origin}. */\nCREATE OR REPLACE PROCEDURE vtb.${procedureName}(\n${parameters}\n)\nLANGUAGE plpgsql\nAS $$\nBEGIN\n${statements.map((statement) => `    ${statement.replaceAll("\n", "\n    ")}`).join("\n\n")}\nEND;\n$$;`;
}

async function main(): Promise<void> {
  const source = await readFile(SOURCE, "utf8");
  const parts = [
    "/* Generated from the VTB PostgreSQL reference script. Do not hand-edit; run generate-vtb-table-process-procedures.ts. */",
    ...Object.entries(TARGETS).flatMap(([origin, tables]) => tables.map((table) => render(source, origin, table))),
  ];
  await writeFile(OUTPUT, `${parts.join("\n\n")}\n`, "utf8");
  console.log(`Generated ${parts.length - 1} one-table VTB procedures.`);
}

void main();
