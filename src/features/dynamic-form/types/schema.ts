export type FormBlockType =
  | "text"
  | "textarea"
  | "number"
  | "single_select"
  | "multi_select"
  | "radio"
  | "checkbox"
  | "yes_no"
  | "date"
  | "time"
  | "slider"
  | "property_type"
  | "urgency"
  | "description_ai"
  | "conditional_alert"
  | "static_text"
  | "image_gallery"
  | "preview_summary";

export type VisibilityOperator =
  | "equals"
  | "notEquals"
  | "in"
  | "notIn"
  | "includes"
  | "notIncludes"
  | "greaterThan"
  | "lessThan"
  | "isEmpty"
  | "isNotEmpty";

export interface VisibilityRule {
  dependsOn: string;
  operator: VisibilityOperator;
  value?: string | number | boolean | string[];
}

export interface SelectOption {
  value: string;
  label: string;
  emoji?: string;
  description?: string;
  exclusive?: boolean;
  metadata?: Record<string, unknown>;
  image?: string;
  tags?: string[];
}

export interface FormBlock {
  id: string;
  type: FormBlockType;
  label: string;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  visibility?: VisibilityRule[];
  options?: SelectOption[];
  config?: Record<string, unknown>;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    message?: string;
    dateMin?: string;
    dateMax?: string;
    timeMin?: string;
    timeMax?: string;
  };
}

export interface FormStep {
  id: string;
  order: number;
  title: string;
  icon?: string;
  description?: string;
  visibility?: VisibilityRule[];
  blocks: FormBlock[];
}

export interface FormSchemaMetadata {
  categorySlug: string;
  categoryId?: string | null;
  status: "draft" | "active" | "deprecated";
  minEngineVersion?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string | null;
  description?: string;
  tags?: string[];
  schemaVersion?: string;
}

export interface FormSchemaConfig {
  showProgressBar?: boolean;
}

export interface FormSchema {
  version: "2.0";
  id: string;
  title: string;
  description?: string;
  metadata: FormSchemaMetadata;
  config: FormSchemaConfig;
  steps: FormStep[];
}

export type FormData = Record<string, unknown>;

export interface PreviewSummarySectionConfig {
  id?: string;
  title: string;
  icon?: string;
  fieldIds: string[];
}

export interface PreviewSummaryBlockConfig {
  sections?: PreviewSummarySectionConfig[];
}

export interface StepBlock {
  index: number;
  stepId: string;
  stepTitle: string;
  stepDescription?: string;
  stepIcon?: string;
  blockId: string;
  block: FormBlock;
  progress: { current: number; total: number };
}

export interface FormContextValue {
  schema: FormSchema;
  formData: FormData;
  currentStepIndex: number;
  currentStepData: FormStep | null;
  totalSteps: number;
  visibleSteps: FormStep[];
  setFormData: (data: FormData) => void;
  updateField: (fieldId: string, value: unknown) => void;
  setFieldValue: (fieldId: string, value: unknown) => void;
  goToStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  isStepValid: (stepIndex: number) => boolean;
  getVisibleBlocks: (step: FormStep) => FormBlock[];
  isFirstStep: boolean;
  isLastStep: boolean;
  canProceed: boolean;
  isFormComplete: () => boolean;
}
