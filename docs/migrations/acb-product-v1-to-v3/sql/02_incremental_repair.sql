-- 增量/补数模板。不得以当前时间替代已登记水位线。
-- 参数：:RUN_ID、:BUSINESS_TYPE、:WATERMARK_FROM、:WATERMARK_TO。
-- 补数时将下列来源替换为经审批的 {{repair_key_table}}，并保留申请单号。

BEGIN TRANSACTION;

MERGE INTO {{target_schema}}.{{target_table}} AS tgt
USING (
  SELECT {{mapped_columns}}
  FROM {{source_schema}}.{{source_table}}
  WHERE {{source_change_column}} > :WATERMARK_FROM
    AND {{source_change_column}} <= :WATERMARK_TO
    AND {{source_scope_predicate}}
) AS src
ON (tgt.{{target_business_key}} = src.{{source_business_key}})
WHEN MATCHED THEN UPDATE SET {{updatable_target_columns}}
WHEN NOT MATCHED THEN INSERT ({{target_columns}}) VALUES ({{source_values}});

INSERT INTO {{target_schema}}.migration_run_ledger
  (run_id, business_type, source_business_key, target_business_key, loaded_at)
SELECT :RUN_ID, :BUSINESS_TYPE, src.{{source_business_key}}, src.{{source_business_key}}, CURRENT_TIMESTAMP
FROM {{source_schema}}.{{source_table}} AS src
WHERE src.{{source_change_column}} > :WATERMARK_FROM
  AND src.{{source_change_column}} <= :WATERMARK_TO
  AND NOT EXISTS (
    SELECT 1 FROM {{target_schema}}.migration_run_ledger AS ledger
    WHERE ledger.run_id = :RUN_ID
      AND ledger.business_type = :BUSINESS_TYPE
      AND ledger.source_business_key = src.{{source_business_key}}
  );

COMMIT;
