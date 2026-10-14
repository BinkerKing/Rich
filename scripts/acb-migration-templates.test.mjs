import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../docs/migrations/acb-product-v1-to-v3/", import.meta.url);

async function template(name) {
  return readFile(new URL(name, root), "utf8");
}

test("migration workbench provides the required controlled-run templates", async () => {
  const [plan, full, incremental, validation, rollback] = await Promise.all([
    template("README.md"),
    template("sql/01_full_load.sql"),
    template("sql/02_incremental_repair.sql"),
    template("sql/03_validation.sql"),
    template("sql/04_rollback.sql"),
  ]);

  assert.match(plan, /公安查控/);
  assert.match(plan, /法院查控/);
  assert.match(plan, /待确认问题清单/);
  assert.match(full, /:RUN_ID/);
  assert.match(incremental, /:RUN_ID/);
  assert.match(validation, /:RUN_ID/);
  assert.match(rollback, /:RUN_ID/);
  assert.doesNotMatch(`${full}${incremental}${validation}${rollback}`, /password\s*=|jdbc:/i);
});
