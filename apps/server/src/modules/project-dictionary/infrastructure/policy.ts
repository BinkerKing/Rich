import type { ProjectDictionarySystem } from "../../../repos/ProjectManagementRepo.js";

export type ImplementedDictionaryDialect = "postgresql" | "sqlserver";

export function dictionaryEntityDialect(system: ProjectDictionarySystem): ImplementedDictionaryDialect {
  if (system.sqlDialect === "sqlserver" || system.dbType === "sqlserver") return "sqlserver";
  if (system.sqlDialect === "postgresql" || system.dbType === "postgresql") return "postgresql";
  throw new Error("请先在库元配置数据库类型：PostgreSQL 或 SQL Server");
}

export function ensureDictionaryEntityPolicy(system: ProjectDictionarySystem, action: "create_table_allowed" | "insert_test_data_allowed"): void {
  const policy = system.entitySyncPolicy ?? "metadata_only";
  if (action === "create_table_allowed") {
    if (policy === "create_table_allowed" || policy === "insert_test_data_allowed") return;
    throw new Error("库元同步策略未允许创建实体表");
  }
  if (policy === "insert_test_data_allowed") return;
  throw new Error("库元同步策略未允许写入测试数据");
}
