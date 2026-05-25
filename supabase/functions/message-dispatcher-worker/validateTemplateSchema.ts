import Ajv, { type ErrorObject } from "ajv";
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

const ajv = new Ajv({ allErrors: true, strict: false });

/** Validates variables against message_templates.variable_schema (design §4.4, task 57). */
export function validateTemplateVariablesAgainstSchema(
  variables: unknown,
  variableSchema: Record<string, unknown> | null | undefined,
): void {
  validateTemplateVariablesSize(variables);

  const schema = variableSchema ?? {};
  if (Object.keys(schema).length === 0) return;

  const validate = ajv.compile(schema);
  const valid = validate(variables);

  if (!valid) {
    throw new TemplateSchemaValidationError(formatAjvErrors(validate.errors));
  }
}
