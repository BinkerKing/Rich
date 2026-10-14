-- 校验模板：每次全量、增量、补数后执行，并以 :RUN_ID 保存结果。
-- 参数：:RUN_ID、:BUSINESS_TYPE、:WATERMARK_FROM、:WATERMARK_TO。

-- 1. 本批处理数量：应与迁移台账数量一致。
SELECT business_type, COUNT(*) AS loaded_keys
FROM {{target_schema}}.migration_run_ledger
WHERE run_id = :RUN_ID AND business_type = :BUSINESS_TYPE
GROUP BY business_type;

-- 2. 源/目标主键集合差异：期望 0 行。
SELECT src.{{source_business_key}} AS missing_target_key
FROM {{source_schema}}.{{source_table}} AS src
LEFT JOIN {{target_schema}}.{{target_table}} AS tgt
  ON tgt.{{target_business_key}} = src.{{source_business_key}}
WHERE {{source_scope_predicate}}
  AND tgt.{{target_business_key}} IS NULL;

-- 3. 目标业务主键重复：期望 0 行。
SELECT {{target_business_key}}, COUNT(*) AS duplicate_count
FROM {{target_schema}}.{{target_table}}
WHERE {{target_scope_predicate}}
GROUP BY {{target_business_key}}
HAVING COUNT(*) > 1;

-- 4. 关键业务字段差异：确认映射后替换 {{key_field_pairs}}，期望 0 行。
SELECT src.{{source_business_key}}
FROM {{source_schema}}.{{source_table}} AS src
JOIN {{target_schema}}.{{target_table}} AS tgt
  ON tgt.{{target_business_key}} = src.{{source_business_key}}
WHERE {{source_scope_predicate}}
  AND ({{key_field_pairs}});
