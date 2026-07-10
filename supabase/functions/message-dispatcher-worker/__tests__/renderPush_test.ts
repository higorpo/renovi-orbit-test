import { assertEquals } from "std/testing/asserts";
import { validateAndRenderPush } from "../renderPush.ts";

const engagementPushSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    headline: { type: "string" },
    body: { type: "string" },
  },
  required: ["name", "headline", "body"],
  additionalProperties: false,
};

Deno.test("validateAndRenderPush renders title and body after schema check", () => {
  const rendered = validateAndRenderPush(
    {
      subject_template: "{{headline}}",
      body_template: "{{name}} — {{body}}",
      variable_schema: engagementPushSchema,
    },
    { name: "Ana", headline: "News", body: "Open app" },
  );

  assertEquals(rendered.title, "News");
  assertEquals(rendered.body, "Ana — Open app");
});

const paymentPushSchema = {
  type: "object",
  properties: {
    service_request_title: { type: "string" },
    service_execution_formatted: { type: "string" },
  },
  required: ["service_request_title", "service_execution_formatted"],
  additionalProperties: true,
};

Deno.test("validateAndRenderPush preserves PT-BR date slashes in plain text", () => {
  const rendered = validateAndRenderPush(
    {
      subject_template: "Pagamento confirmado — {{service_request_title}}",
      body_template:
        "Pagamento aprovado para {{service_request_title}}, agendado para {{service_execution_formatted}}.",
      variable_schema: paymentPushSchema,
    },
    {
      service_request_title: "Instalação elétrica",
      service_execution_formatted: "26/03/2026, turno da manhã",
    },
  );

  assertEquals(rendered.title, "Pagamento confirmado — Instalação elétrica");
  assertEquals(
    rendered.body,
    "Pagamento aprovado para Instalação elétrica, agendado para 26/03/2026, turno da manhã.",
  );
});

Deno.test("validateAndRenderPush uses empty title when subject_template is null", () => {
  const rendered = validateAndRenderPush(
    {
      subject_template: null,
      body_template: "{{body}}",
      variable_schema: engagementPushSchema,
    },
    { name: "Ana", headline: "H", body: "Open" },
  );
  assertEquals(rendered.title, "");
  assertEquals(rendered.body, "Open");
});

Deno.test("validateAndRenderPush stringifies nullish mustache values without HTML escape", () => {
  const rendered = validateAndRenderPush(
    {
      subject_template: "{{missing}}",
      body_template: "Hello {{name}}",
      variable_schema: {
        type: "object",
        properties: { name: { type: "string" } },
        additionalProperties: true,
      },
    },
    { name: "Ana", missing: null },
  );
  assertEquals(rendered.title, "");
  assertEquals(rendered.body, "Hello Ana");
});
