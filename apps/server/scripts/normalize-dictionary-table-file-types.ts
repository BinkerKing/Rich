import { Pool } from "pg";

const RICH_URL = process.env.RICH_DB_URL
  ?? process.env.DATABASE_URL
  ?? process.env.KE_DATABASE_URL
  ?? "postgresql://binkerking@localhost/rich?host=/tmp&port=5432";

const NOW = new Date().toISOString();

function fileTypeExpression(): string {
  return `
    CASE
      WHEN lower(table_name) ~ '\\.(txt)$' THEN 'txt'
      WHEN lower(table_name) ~ '\\.(csv)$' THEN 'csv'
      WHEN lower(table_name) ~ '\\.(xml)$' THEN 'xml'
      WHEN lower(table_name) ~ '\\.(xls|xlsx)$' THEN 'excel'
      WHEN lower(coalesce(source_kind, '')) LIKE '%xml%' THEN 'xml'
      WHEN coalesce(extra, '{}'::jsonb) ? 'onegenSourceFile' THEN 'txt'
      WHEN lower(coalesce(extra->'fileSource'->>'fileNamePattern', '')) LIKE '%.txt%' THEN 'txt'
      WHEN lower(coalesce(extra->'fileSource'->>'fileNamePattern', '')) LIKE '%.csv%' THEN 'csv'
      WHEN lower(coalesce(extra->'fileSource'->>'fileNamePattern', '')) LIKE '%.xml%' THEN 'xml'
      WHEN lower(coalesce(extra->'fileSource'->>'fileNamePattern', '')) LIKE '%.xls%' THEN 'excel'
      ELSE NULL
    END
  `;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: RICH_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("ALTER TABLE pm_data_tables ADD COLUMN IF NOT EXISTS file_type TEXT");

    const result = await client.query<{ updated_count: string }>(
      `
        WITH detected AS (
          SELECT id, ${fileTypeExpression()} AS detected_file_type
          FROM pm_data_tables
        ),
        updated AS (
          UPDATE pm_data_tables t
          SET file_type = d.detected_file_type,
              source_kind = '文件',
              extra = coalesce(t.extra, '{}'::jsonb) || jsonb_build_object('fileType', d.detected_file_type),
              updated_at = $1
          FROM detected d
          WHERE t.id = d.id
            AND d.detected_file_type IS NOT NULL
            AND (
              t.file_type IS DISTINCT FROM d.detected_file_type
              OR t.source_kind IS DISTINCT FROM '文件'
              OR coalesce(t.extra->>'fileType', '') IS DISTINCT FROM d.detected_file_type
            )
          RETURNING t.id
        )
        SELECT count(*)::text AS updated_count FROM updated
      `,
      [NOW],
    );

    await client.query(
      `
        INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
        SELECT 'dict-table:' || id, project_id, 'dictionary', 'table', id, table_name, coalesce(table_cn,''),
          coalesce(description,''), coalesce(data_layer,'') || ' ' || coalesce(source_kind,'') || ' ' || coalesce(file_type,''),
          table_name || ' ' || coalesce(table_cn,'') || ' ' || coalesce(description,'') || ' ' || coalesce(data_layer,'') || ' ' || coalesce(source_kind,'') || ' ' || coalesce(file_type,''), $1
        FROM pm_data_tables
        WHERE file_type IS NOT NULL
        ON CONFLICT (id) DO UPDATE SET
          subtitle=excluded.subtitle,
          body=excluded.body,
          keywords=excluded.keywords,
          search_text=excluded.search_text,
          updated_at=excluded.updated_at
      `,
      [NOW],
    );

    await client.query("COMMIT");
    console.log(`normalized ${result.rows[0]?.updated_count ?? "0"} dictionary file tables`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
