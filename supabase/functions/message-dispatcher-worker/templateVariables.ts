/** Max serialized template_variables size (design §11.4). */
export const MAX_TEMPLATE_VARIABLES_BYTES = 8192;

export class TemplateVariablesSizeError extends Error {
  readonly code = "template_variables_too_large";

  constructor(byteLength: number) {
    super(`template_variables exceeds ${MAX_TEMPLATE_VARIABLES_BYTES} bytes (${byteLength})`);
    this.name = "TemplateVariablesSizeError";
  }
}

export function templateVariablesByteLength(variables: unknown): number {
  return new TextEncoder().encode(JSON.stringify(variables ?? {})).length;
}

export function validateTemplateVariablesSize(variables: unknown): void {
  const bytes = templateVariablesByteLength(variables);
  if (bytes > MAX_TEMPLATE_VARIABLES_BYTES) {
    throw new TemplateVariablesSizeError(bytes);
  }
}
