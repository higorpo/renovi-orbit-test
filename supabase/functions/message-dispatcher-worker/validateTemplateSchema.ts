import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import { validateTemplateVariablesSize } from "./templateVariables.ts";

export class TemplateSchemaValidationError extends Error {
  readonly code = "template_schema_invalid";

  constructor(message: string) {
    super(message);
    this.name = "TemplateSchemaValidationError";
  }
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors?.length) return "template_variables failed schema validation";
  return errors
    .map((e) => `${e.instancePath || "/"} ${e.message ?? "invalid"}`.trim())
    .join("; ");
}

/** Exported for unit tests of Ajv error formatting edge cases. */
export { formatAjvErrors };

const ajv = new Ajv({ allErrors: true, strict: false });
const compiledSchemaCache = new Map<string, ValidateFunction>();

function getOrCompileSchema(schema: Record<string, unknown>): ValidateFunction {
  const cacheKey = JSON.stringify(schema);
  const cached = compiledSchemaCache.get(cacheKey);
  if (cached) return cached;

  const validate = ajv.compile(schema);
  compiledSchemaCache.set(cacheKey, validate);
  return validate;
}

/** Clears compiled schema cache (tests only). */
export function resetSchemaCache(): void {
  compiledSchemaCache.clear();
}

/** Validates variables against message_templates.variable_schema (design §4.4, task 57). */
export function validateTemplateVariablesAgainstSchema(
  variables: unknown,
  variableSchema: Record<string, unknown> | null | undefined,
): void {
  validateTemplateVariablesSize(variables);

  const schema = variableSchema ?? {};
  if (Object.keys(schema).length === 0) return;

  const validate = getOrCompileSchema(schema);
  const valid = validate(variables);

  if (!valid) {
    throw new TemplateSchemaValidationError(formatAjvErrors(validate.errors));
  }
}
