import Mustache from "mustache";
import { validateTemplateVariablesAgainstSchema } from "./validateTemplateSchema.ts";

export interface PushTemplateSource {
  subject_template: string | null;
  body_template: string;
  variable_schema: Record<string, unknown>;
}

export interface RenderedPush {
  title: string;
  body: string;
}

/** Push bodies are plain text; Mustache HTML-escaping breaks PT-BR dates (26/03/2026 → &#x2F;). */
function renderPushPlainText(
  template: string,
  view: Record<string, unknown>,
): string {
  const previousEscape = Mustache.escape;
  Mustache.escape = (value: unknown) => String(value ?? "");
  try {
    return Mustache.render(template, view).trim();
  } finally {
    Mustache.escape = previousEscape;
  }
}

/** JSON Schema validation + Mustache render before FCM (task 57, Req.2 AC2). */
export function validateAndRenderPush(
  template: PushTemplateSource,
  templateVariables: Record<string, unknown>,
): RenderedPush {
  validateTemplateVariablesAgainstSchema(
    templateVariables,
    template.variable_schema,
  );

  const view = templateVariables;
  const title = renderPushPlainText(template.subject_template ?? "", view);
  const body = renderPushPlainText(template.body_template, view);

  return { title, body };
}
