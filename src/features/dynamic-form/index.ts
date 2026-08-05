export { FormProvider, useFormContext } from "./components/FormContext";
export { DynamicForm } from "./components/DynamicForm/DynamicForm";
export type { DynamicFormProps } from "./components/DynamicForm/DynamicForm";
export { DynamicFormSkeleton } from "./components/DynamicForm/DynamicFormSkeleton";
export { ProgressBar } from "./components/ProgressBar";
export { StepRenderer } from "./components/StepRenderer";
export { SchemaError } from "./components/DynamicForm/SchemaError";
export { FormDemoPage } from "./components/FormDemoPage/FormDemoPage";
export type { FormDemoPageProps } from "./components/FormDemoPage/FormDemoPage";

export { useFieldValidation, getValidationErrorMessage } from "./hooks/useFieldValidation";
export type {
  UseFieldValidationOptions,
  FieldValidationResult,
  ValidationState,
} from "./hooks/useFieldValidation";

export type {
  FormSchema,
  FormData,
  FormBlock,
  FormStep,
  FormContextValue,
  FormBlockType,
  SelectOption,
  FormSchemaMetadata,
  FormSchemaConfig,
  PreviewSummarySectionConfig,
  PreviewSummaryBlockConfig,
  CompletionCriterionBlockConfig,
  CompletionCriterionValue,
} from "./types";
export {
  FORM_BLOCK_TYPES,
  COMPLETION_CHECKLIST_BLOCK_TYPES,
} from "./types/schema";
export {
  getVisibleSteps,
  getVisibleBlocks,
  isBlockComplete,
  isStepComplete,
  validateBlockValue,
  getRelatedAlerts,
  getFormProgress,
  getBlockById,
  getDisplayValue,
  evaluateVisibilityRule,
  isBlockVisible,
  isStepVisible,
} from "./types/helpers";
export {
  DEFAULT_PROPERTY_TYPE_OPTIONS,
  DEFAULT_URGENCY_OPTIONS,
  normalizeSchema,
} from "./types/defaults";

export {
  validateFormSchema,
  formatValidationErrors,
  getValidationSummary,
} from "./utils/schemaValidator";
export type {
  SchemaValidationResult,
  SchemaValidationError,
  ValidationSeverity,
} from "./utils/schemaValidator";
export {
  INPUT_BLOCK_TYPES,
  buildSummaryEntries,
  buildSummarySections,
  buildSummarySectionsFromConfig,
  getFormCompleteness,
} from "./utils/summaryDisplay";
export type {
  SummaryEntry,
  SummarySection,
  FormCompleteness,
} from "./utils/summaryDisplay";

export {
  getCompletionCriterionConfig,
  validateCompletionCriterionValue,
  isCompletionCriterionValue,
  DEFAULT_EVIDENCE_MIN,
  DEFAULT_EVIDENCE_MAX,
} from "./utils/completionCriterion";
export {
  validateCompletionChecklistSchema,
  isCompletionChecklistBlockType,
  countCompletionCriteria,
} from "./utils/completionChecklist";
export type { CompletionChecklistValidationResult } from "./utils/completionChecklist";

export { CompletionCriterionBlock } from "./components/blocks/CompletionCriterionBlock";
export type { CompletionCriterionBlockProps } from "./components/blocks/CompletionCriterionBlock";
export { StaticTextBlock } from "./components/blocks/StaticTextBlock";
