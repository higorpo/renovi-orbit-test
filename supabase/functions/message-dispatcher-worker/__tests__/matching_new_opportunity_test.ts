import { assertEquals, assertThrows } from "std/testing/asserts";
import { renderEmailFromTemplate } from "../renderEmail.ts";
import { validateAndRenderPush } from "../renderPush.ts";
import { TemplateSchemaValidationError } from "../validateTemplateSchema.ts";
import {
  MATCHING_NEW_OPPORTUNITY_EMAIL_TEMPLATE,
  MATCHING_NEW_OPPORTUNITY_PUSH_TEMPLATE,
  MATCHING_NEW_OPPORTUNITY_TEMPLATE_VARIABLES,
  MATCHING_NEW_OPPORTUNITY_VARIABLE_SCHEMA,
} from "./fixtures/matchingNewOpportunityTemplate.ts";
import { validateTemplateVariablesAgainstSchema } from "../validateTemplateSchema.ts";

Deno.test("matching.new_opportunity push schema accepts trigger variables", () => {
  validateTemplateVariablesAgainstSchema(
    MATCHING_NEW_OPPORTUNITY_TEMPLATE_VARIABLES,
    MATCHING_NEW_OPPORTUNITY_VARIABLE_SCHEMA,
  );
});

Deno.test("matching.new_opportunity push schema rejects distance_km", () => {
  assertThrows(
    () =>
      validateTemplateVariablesAgainstSchema(
        { ...MATCHING_NEW_OPPORTUNITY_TEMPLATE_VARIABLES, distance_km: 3.2 },
        MATCHING_NEW_OPPORTUNITY_VARIABLE_SCHEMA,
      ),
    TemplateSchemaValidationError,
  );
});

Deno.test("matching.new_opportunity push template renders title and body", () => {
  const rendered = validateAndRenderPush(
    MATCHING_NEW_OPPORTUNITY_PUSH_TEMPLATE,
    { ...MATCHING_NEW_OPPORTUNITY_TEMPLATE_VARIABLES },
  );

  assertEquals(rendered.title, "");
  assertEquals(rendered.body, "Fix kitchen sink — Pinheiros");
});

Deno.test("matching.new_opportunity email template renders subject and html", () => {
  const rendered = renderEmailFromTemplate(
    MATCHING_NEW_OPPORTUNITY_EMAIL_TEMPLATE,
    { ...MATCHING_NEW_OPPORTUNITY_TEMPLATE_VARIABLES },
  );

  assertEquals(rendered.subject, "Nova oportunidade: Fix kitchen sink");
  assertEquals(rendered.html.includes("<strong>Fix kitchen sink</strong>"), true);
  assertEquals(rendered.html.includes("Plumbing"), true);
  assertEquals(rendered.html.includes("Pinheiros"), true);
  assertEquals(rendered.html.includes("normal"), true);
  assertEquals(rendered.html.includes("dashboard"), true);
});
