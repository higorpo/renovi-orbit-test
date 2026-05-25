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
  const title = Mustache.render(template.subject_template ?? "", view).trim();
  const body = Mustache.render(template.body_template, view).trim();

  return { title, body };
}
