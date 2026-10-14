-- 全量基线装载模板（仅在已确认的非生产演练库或获批生产窗口执行）
-- 前置：按目标数据库方言创建 {{target_schema}}.migration_run_ledger，至少含
-- run_id、business_type、source_business_key、target_business_key、loaded_at。
-- 参数：:RUN_ID、:BUSINESS_TYPE（公安查控/法院查控）。

BEGIN TRANSACTION;

-- 以业务主键去重；目标写入必须使用目标方言的 UPSERT/MERGE，禁止裸 INSERT 重跑。
MERGE INTO {{target_schema}}.{{target_table}} AS tgt
USING (
  SELECT {{mapped_columns}}
  FROM {{source_schema}}.{{source_table}}
  WHERE {{source_scope_predicate}}
) AS src
ON (tgt.{{target_business_key}} = src.{{source_business_key}})
WHEN MATCHED THEN UPDATE SET {{updatable_target_columns}}
WHEN NOT MATCHED THEN INSERT ({{target_columns}}) VALUES ({{source_values}});

-- 仅记录本 RUN_ID 实际处理的业务键；唯一约束应为 (run_id, business_type, source_business_key)。
INSERT INTO {{target_schema}}.migration_run_ledger
  (run_id, business_type, source_business_key, target_business_key, loaded_at)
SELECT :RUN_ID, :BUSINESS_TYPE, src.{{source_business_key}}, src.{{source_business_key}}, CURRENT_TIMESTAMP
FROM {{source_schema}}.{{source_table}} AS src
WHERE {{source_scope_predicate}}
  AND NOT EXISTS (
    SELECT 1 FROM {{target_schema}}.migration_run_ledger AS ledger
    WHERE ledger.run_id = :RUN_ID
      AND ledger.business_type = :BUSINESS_TYPE
      AND ledger.source_business_key = src.{{source_business_key}}
  );

COMMIT;
