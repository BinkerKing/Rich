# SAFE Dictionary Architecture Implementation Plan

> **For Codex:** Execute task-by-task with test-first changes; do not alter SAFE mapping semantics, page routes, or public HTTP payloads.

**Goal:** Move SAFE source/stage parsing, test-data ingestion, and dictionary execution planning behind small modules with deterministic regression tests.

**Architecture:** Keep the existing project-management UI and API as the compatibility surface. Extract pure SAFE parsers and file-ingestion logic into `modules/project-dictionary/safe`, then make scripts thin database writers. Keep the current extraction service as the public facade while progressively moving shared pure SQL helpers into `sql-engine`.

**Tech Stack:** TypeScript, Vitest, Hono, PostgreSQL project storage, PostgreSQL/SQL Server external entity execution.

---

### Task 1: SAFE source-to-stage parser

**Files:**
- Create: `apps/server/src/modules/project-dictionary/safe/sourceStageMapping.ts`
- Modify: `apps/server/scripts/sync-vtb-onegen-source-stage-mapping.ts`
- Test: `apps/server/test/projectDictionarySafeSourceStage.test.ts`

1. Write fixtures for the four confirmed OneGen source files, the `REPORT.TXT` exclusion, and generated stage fields.
2. Verify tests fail because the pure parser does not exist.
3. Move only parsing and normalization functions; leave SQL writes and transaction boundaries in the script.
4. Verify the parser returns the same table/field mappings and source order.

### Task 2: SAFE UTF-16 file ingestion parser

**Files:**
- Create: `apps/server/src/modules/project-dictionary/safe/sourceFileIngestion.ts`
- Modify: `apps/server/scripts/import-vtb-source-test-data.ts`
- Test: `apps/server/test/projectDictionarySafeSourceFile.test.ts`

1. Add a UTF-16LE fixture with a BOM, empty trailing columns, and a row with excess columns.
2. Verify test failure before implementation.
3. Extract byte decoding, `|` splitting, field projection, and column-count diagnostics into a pure function.
4. Preserve the current 50-row sample cap and database update payload.

### Task 3: SAFE execution verification fixture

**Files:**
- Create: `apps/server/src/modules/project-dictionary/safe/verification.ts`
- Test: `apps/server/test/projectDictionarySafeVerification.test.ts`

1. Define a non-sensitive fixture expressing confirmed source → stage → middle → message links and explicitly excluded/unconfirmed links.
2. Verify the verifier rejects an unconfirmed direct CFAA construction rule and accepts confirmed source/stage and CFAAN/EXDAN evidence links.
3. Keep this as validation only; it must never generate or alter mapping rules.

### Task 4: Regression verification

**Files:**
- Test: `apps/server/test/projectDictionaryFoundation.test.ts`
- Test: all `apps/server/test/projectDictionarySafe*.test.ts`

1. Run only SAFE module tests during development.
2. Run the full server suite and workspace typecheck.
3. Run the optional real-database acceptance command only when `RICH_DB_URL` and an explicitly approved SAFE test environment are provided; never connect automatically to a production source.
