import Mustache from "mustache";
import { validateTemplateVariablesSize } from "./templateVariables.ts";

export interface RenderedEmail {
  subject: string;
  html: string;
}

export interface EmailTemplateSource {
  subject_template: string | null;
  body_template: string;
}

/** Mustache render for email subject/body (design §4.4, task 56). */
export function renderEmailFromTemplate(
  template: EmailTemplateSource,
  templateVariables: Record<string, unknown>,
): RenderedEmail {
  validateTemplateVariablesSize(templateVariables);

  const view = templateVariables as Record<string, unknown>;
  const subjectTemplate = template.subject_template ?? "";
  const subject = Mustache.render(subjectTemplate, view).trim();
  const html = Mustache.render(template.body_template, view);

  return { subject, html };
}
