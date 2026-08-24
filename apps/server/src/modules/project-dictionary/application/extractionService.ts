export {
  extractDictionaryEntityTestData,
  prepareDictionaryEntityExtractionSql,
  validateDictionaryMappingSql,
} from "../../../services/projectDictionaryEntitySync.js";

export type {
  DictionaryEntityExtractionPrepareResult,
  DictionaryEntityExtractionValidationIssue,
  DictionaryEntitySyncResult,
  DictionaryMappingSqlValidationField,
  DictionaryMappingSqlValidationResult,
} from "../contracts.js";
