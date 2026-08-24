/**
 * Application boundary used by HTTP routes.  The legacy implementation remains
 * behind this adapter while schema, data and SQL planners are migrated in
 * smaller verified changes.
 */
export {
  createDictionaryEntityTable,
  inspectDictionaryEntitySchema,
  testDictionaryEntityConnection,
} from "./schemaService.js";
export {
  queryDictionaryEntityTestData,
  writeDictionaryEntityTestData,
} from "./testDataService.js";
export {
  extractDictionaryEntityTestData,
  prepareDictionaryEntityExtractionSql,
  validateDictionaryMappingSql,
} from "./extractionService.js";

export type {
  DictionaryEntityConnectionTestResult,
  DictionaryEntityExtractionPrepareResult,
  DictionaryEntityExtractionValidationIssue,
  DictionaryEntitySchemaIssue,
  DictionaryEntitySchemaStatusResult,
  DictionaryEntitySyncResult,
  DictionaryEntityTestDataQueryResult,
  DictionaryMappingSqlValidationField,
  DictionaryMappingSqlValidationResult,
} from "../contracts.js";
