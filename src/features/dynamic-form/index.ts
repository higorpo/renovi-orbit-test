/**
 * Dynamic form feature — Public API.
 * Schema-driven forms: one step = one screen (all blocks of that step).
 */

export { FormProvider, useFormContext } from "./components/FormContext";
export { MicroStepForm } from "./components/MicroStepForm/MicroStepForm";
export type { MicroStepFormProps } from "./components/MicroStepForm/MicroStepForm";
export { MicroStepFormSkeleton } from "./components/MicroStepForm/MicroStepFormSkeleton";
export { ProgressBar } from "./components/ProgressBar";
export { MicroStepRenderer } from "./components/MicroStepRenderer";
export { SchemaError } from "./components/MicroStepForm/SchemaError";
export { FormDemoPage } from "./components/FormDemoPage/FormDemoPage";

export { useFieldValidation, getValidationErrorMessage } from "./hooks/useFieldValidation";
export type {
  UseFieldValidationOptions,
  FieldValidationResult,
  ValidationState,
} from "./hooks/useFieldValidation";

export type {
  FormSchemaV2,
  FormDataV2,
  FormBlockV2,
  FormStepV2,
  FormContextValue,
  FormBlockType,
  SelectOption,
  FormSchemaMetadata,
  FormSchemaConfig,
  PreviewSummarySectionConfig,
  PreviewSummaryBlockConfig,
} from "./types";
export {
  getVisibleStepsV2,
  getVisibleBlocksV2,
  isBlockComplete,
  isStepCompleteV2,
  validateBlock,
  getRelatedAlerts,
  getFormProgress,
  getBlockById,
  checkVisibilityRule,
  isBlockVisible,
  isStepVisible,
} from "./types/formSchemaV2/helpers";
export {
  DEFAULT_PROPERTY_TYPE_OPTIONS,
  DEFAULT_URGENCY_OPTIONS,
  normalizeSchemaV2,
} from "./types/formSchemaV2/defaults";

export {
  validateFormSchemaV2,
  formatValidationErrors,
  getValidationSummary,
} from "./utils/schemaValidator";
export type {
  SchemaValidationResult,
  SchemaValidationError,
  ValidationSeverity,
} from "./utils/schemaValidator";
