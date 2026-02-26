export type ValidationSeverity = "error" | "warning";

export interface SchemaValidationError {
  code: string;
  message: string;
  path?: string;
  severity: ValidationSeverity;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
  warnings: SchemaValidationError[];
}

export interface StepValidationResult {
  errors: SchemaValidationError[];
  warnings: SchemaValidationError[];
}
