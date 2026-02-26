export { FormProvider, useFormContext } from "./components/FormContext";
export { DynamicForm } from "./components/DynamicForm/DynamicForm";
export type { DynamicFormProps } from "./components/DynamicForm/DynamicForm";
export { DynamicFormSkeleton } from "./components/DynamicForm/DynamicFormSkeleton";
export { ProgressBar } from "./components/ProgressBar";
export { StepRenderer } from "./components/StepRenderer";
export { SchemaError } from "./components/DynamicForm/SchemaError";
export { FormDemoPage } from "./components/FormDemoPage/FormDemoPage";

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
} from "./types";
export {
  getVisibleSteps,
  getVisibleBlocks,
  isBlockComplete,
  isStepComplete,
  validateBlockValue,
  getRelatedAlerts,
  getFormProgress,
  getBlockById,
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
