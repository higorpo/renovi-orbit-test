/**
 * Discriminator for each kind of form block. Used to select the correct renderer
 * (e.g. TextInputBlock, SingleSelectBlock) and validation rules.
 */
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

/**
 * Operators used in visibility rules to show/hide blocks or steps based on
 * other fields' values (e.g. "equals", "isEmpty", "includes").
 */
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

/**
 * Single condition for conditional visibility. When all rules on a block/step
 * evaluate to true (given current formData), the block/step is visible.
 */
export interface VisibilityRule {
  /** Block id whose value is used to evaluate this rule. */
  dependsOn: string;
  /** Comparison to apply between dependsOn value and `value`. */
  operator: VisibilityOperator;
  /** Right-hand side of the comparison; required for most operators, omitted for isEmpty/isNotEmpty. */
  value?: string | number | boolean | string[];
}

/**
 * Option for select-like blocks (single_select, multi_select, radio, property_type,
 * urgency). Rendered as choice with optional emoji, description, and image.
 */
export interface SelectOption {
  /** Value stored in formData when this option is selected. */
  value: string;
  /** Text shown to the user. */
  label: string;
  /** Optional emoji or icon prefix. */
  emoji?: string;
  /** Optional secondary description below the label. */
  description?: string;
  /** When true (e.g. in multi_select), selecting this option may deselect others. */
  exclusive?: boolean;
  /** Arbitrary data for custom logic or filtering. */
  metadata?: Record<string, unknown>;
  /** Image URL; used by image_gallery block. */
  image?: string;
  /** Optional tags for grouping or search. */
  tags?: string[];
}

/**
 * One field or non-input block in the form. Each block has a unique id (used as
 * formData key), a type, label, optional validation/visibility, and type-specific
 * props (options, min/max, config, etc.).
 */
export interface FormBlockV2 {
  /** Unique id; used as key in formData and for visibility dependsOn. */
  id: string;
  /** Block kind; determines renderer and validation. */
  type: FormBlockType;
  /** Label shown above or beside the control. */
  label: string;
  /** When true, the field must have a value to proceed. */
  required?: boolean;
  /** Placeholder for text/textarea/date/time inputs. */
  placeholder?: string;
  /** Hint text shown below the control. */
  helpText?: string;
  /** Rules that must all pass for this block to be visible. */
  visibility?: VisibilityRule[];
  /** Choices for select/radio blocks; also used by property_type and urgency. */
  options?: SelectOption[];
  /** Block-type-specific settings (e.g. slider step, date format). */
  config?: Record<string, unknown>;
  /** Used by slider/number blocks as step increment. */
  step?: number;
  /** Minimum value (number/slider) or used by validation. */
  min?: number;
  /** Maximum value (number/slider) or used by validation. */
  max?: number;
  /** Unit label (e.g. "m²", "%") shown next to number/slider. */
  unit?: string;
  /** Validation constraints and error message overrides. */
  validation?: {
    /** Minimum numeric value. */
    min?: number;
    /** Maximum numeric value. */
    max?: number;
    /** Minimum string length. */
    minLength?: number;
    /** Maximum string length. */
    maxLength?: number;
    /** Regex pattern for string validation. */
    pattern?: string;
    /** Custom message when validation fails. */
    message?: string;
    /** Minimum date (YYYY-MM-DD). Used when type is "date". */
    dateMin?: string;
    /** Maximum date (YYYY-MM-DD). Used when type is "date". */
    dateMax?: string;
    /** Minimum time (HH:mm). Used when type is "time". */
    timeMin?: string;
    /** Maximum time (HH:mm). Used when type is "time". */
    timeMax?: string;
  };
}

/**
 * One step (screen) of the form. Contains an ordered list of blocks; all visible
 * blocks of the current step are shown at once. Steps can have visibility rules.
 */
export interface FormStepV2 {
  /** Unique step id. */
  id: string;
  /** Display order (lower = earlier). */
  order: number;
  /** Step title shown in header/progress. */
  title: string;
  /** Optional icon name or URL for the step header. */
  icon?: string;
  /** Optional description below the title. */
  description?: string;
  /** Rules that must all pass for this step to be visible. */
  visibility?: VisibilityRule[];
  /** Blocks in this step; order preserved. */
  blocks: FormBlockV2[];
}

/**
 * Metadata about the schema (category, lifecycle status, versioning). Used for
 * listing, filtering, and compatibility checks; not for rendering the form.
 */
export interface FormSchemaMetadata {
  /** Slug identifying the category (e.g. for URLs or filters). */
  categorySlug: string;
  /** Optional category id when stored in a backend. */
  categoryId?: string | null;
  /** Lifecycle: draft (editing), active (published), deprecated (hidden). */
  status: "draft" | "active" | "deprecated";
  /** Minimum engine version required to run this schema. */
  minEngineVersion?: string;
  /** ISO date when the schema was created. */
  createdAt?: string;
  /** ISO date of last update. */
  updatedAt?: string;
  /** User or system that last updated the schema. */
  updatedBy?: string | null;
  /** Short description of the form (e.g. for admin lists). */
  description?: string;
  /** Optional tags for search/filtering. */
  tags?: string[];
  /** Schema format or version string (e.g. "2.0"). */
  schemaVersion?: string;
}

/**
 * Presentation/UX options for the form (e.g. progress bar, estimated duration).
 * Applied when rendering the form container.
 */
export interface FormSchemaConfig {
  /** When true, show a progress bar based on completed steps/blocks. */
  showProgressBar?: boolean;
}

/**
 * Root schema for a dynamic form. Identifies the form (version, id, title),
 * holds metadata/config, and defines the ordered steps and their blocks.
 */
export interface FormSchemaV2 {
  /** Schema version; must be "2.0" for this type. */
  version: "2.0";
  /** Unique form id. */
  id: string;
  /** Form title (e.g. in page header). */
  title: string;
  /** Optional form description. */
  description?: string;
  /** Category, status, and versioning info. */
  metadata: FormSchemaMetadata;
  /** UI options (progress bar, estimated time). */
  config: FormSchemaConfig;
  /** Ordered list of steps (screens). */
  steps: FormStepV2[];
}

/**
 * Current form values: map of block id -> value. Used for controlled inputs,
 * visibility evaluation, and validation.
 */
export type FormDataV2 = Record<string, unknown>;

/**
 * Config for preview_summary block: defines which sections and fields appear
 * in the summary. If sections is omitted or empty, sections are derived from
 * form steps (one section per step, with all visible input blocks).
 */
export interface PreviewSummarySectionConfig {
  /** Optional unique id for the section. */
  id?: string;
  /** Section title shown in the summary. */
  title: string;
  /** Optional emoji or icon for the section header. */
  icon?: string;
  /** Block ids to show in this section (order preserved). */
  fieldIds: string[];
}

export interface PreviewSummaryBlockConfig {
  /** Sections to display. If absent or empty, one section per step is used. */
  sections?: PreviewSummarySectionConfig[];
}

/**
 * Used internally by helpers (e.g. getFormProgress, generateMicroSteps). Represents
 * one "micro" step (one block) for progress calculation. Not exposed on FormContextValue.
 */
export interface MicroStep {
  /** Zero-based index of this block among all visible input blocks. */
  index: number;
  /** Id of the step (screen) this block belongs to. */
  stepId: string;
  /** Title of the step, for display in progress. */
  stepTitle: string;
  /** Optional step description. */
  stepDescription?: string;
  /** Optional step icon. */
  stepIcon?: string;
  /** Block id (key in formData). */
  blockId: string;
  /** The block definition. */
  block: FormBlockV2;
  /** Current/total counts for progress (e.g. "3 of 10"). */
  progress: { current: number; total: number };
}

/**
 * Value provided by FormProvider. Gives access to schema, form data, current step,
 * navigation (goToStep, nextStep, prevStep), validation (isStepValid, getVisibleBlocks),
 * and field updates (updateField, setFieldValue). Consumed via useFormContext().
 */
export interface FormContextValue {
  /** The form schema (steps, blocks, metadata). */
  schema: FormSchemaV2;
  /** Current values keyed by block id. */
  formData: FormDataV2;
  /** Zero-based index of the current step (screen). */
  currentStepIndex: number;
  /** The current step object, or null if none. */
  currentStepData: FormStepV2 | null;
  /** Number of visible steps. */
  totalSteps: number;
  /** Steps that pass visibility rules, in order. */
  visibleSteps: FormStepV2[];
  /** Replace the entire form data (e.g. load or reset). */
  setFormData: (data: FormDataV2) => void;
  /** Update a single field by id; merges with existing formData. */
  updateField: (fieldId: string, value: unknown) => void;
  /** Alias for updateField; sets one field value. */
  setFieldValue: (fieldId: string, value: unknown) => void;
  /** Navigate to a step by index. */
  goToStep: (index: number) => void;
  /** Go to the next step if possible. */
  nextStep: () => void;
  /** Go to the previous step if possible. */
  prevStep: () => void;
  /** Whether all visible required blocks in the given step are valid. */
  isStepValid: (stepIndex: number) => boolean;
  /** Blocks of the step that are visible given current formData. */
  getVisibleBlocks: (step: FormStepV2) => FormBlockV2[];
  /** True when currentStepIndex === 0. */
  isFirstStep: boolean;
  /** True when on the last visible step. */
  isLastStep: boolean;
  /** True when current step is valid and user can proceed (e.g. next button enabled). */
  canProceed: boolean;
  /** True when all visible required blocks across all steps have valid values. */
  isFormComplete: () => boolean;
}
