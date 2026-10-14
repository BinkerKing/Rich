-- 回滚模板：仅在回滚决策人批准后执行。
-- 只允许回滚 :RUN_ID 写入且未被后续获批 RUN_ID 接管的记录。
-- 参数：:RUN_ID、:BUSINESS_TYPE。

BEGIN TRANSACTION;

DELETE FROM {{target_schema}}.{{target_table}} AS tgt
WHERE EXISTS (
  SELECT 1
  FROM {{target_schema}}.migration_run_ledger AS ledger
  WHERE ledger.run_id = :RUN_ID
    AND ledger.business_type = :BUSINESS_TYPE
    AND ledger.target_business_key = tgt.{{target_business_key}}
    AND NOT EXISTS (
      SELECT 1
      FROM {{target_schema}}.migration_run_ledger AS later
      WHERE later.target_business_key = ledger.target_business_key
        AND later.loaded_at > ledger.loaded_at
    )
);

DELETE FROM {{target_schema}}.migration_run_ledger
WHERE run_id = :RUN_ID AND business_type = :BUSINESS_TYPE;

COMMIT;
