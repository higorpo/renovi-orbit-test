import { assertEquals, assertThrows } from "std/testing/asserts";
import {
  resetSchemaCache,
  TemplateSchemaValidationError,
  formatAjvErrors,
  validateTemplateVariablesAgainstSchema,
} from "../validateTemplateSchema.ts";

const engagementPushSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    headline: { type: "string" },
    body: { type: "string" },
    deep_link: { type: "string" },
  },
  required: ["name", "headline", "body"],
  additionalProperties: false,
};

Deno.test("validateTemplateVariablesAgainstSchema accepts valid push vars", () => {
  validateTemplateVariablesAgainstSchema(
    { name: "Ana", headline: "Hi", body: "Check in" },
    engagementPushSchema,
  );
});

Deno.test("validateTemplateVariablesAgainstSchema rejects missing required field", () => {
  let thrown: TemplateSchemaValidationError | undefined;
  try {
    validateTemplateVariablesAgainstSchema(
      { name: "Ana", headline: "Hi" },
      engagementPushSchema,
    );
  } catch (err) {
    thrown = err as TemplateSchemaValidationError;
  }
  assertEquals(thrown?.code, "template_schema_invalid");
});

Deno.test("validateTemplateVariablesAgainstSchema rejects additional properties", () => {
  assertThrows(
    () =>
      validateTemplateVariablesAgainstSchema(
        { name: "Ana", headline: "Hi", body: "x", extra: true },
        engagementPushSchema,
      ),
    TemplateSchemaValidationError,
  );
});

Deno.test("validateTemplateVariablesAgainstSchema uses cached compiled schema on second call", () => {
  resetSchemaCache();
  const schema = {
    type: "object",
    properties: { x: { type: "number" } },
    required: ["x"],
  };

  validateTemplateVariablesAgainstSchema({ x: 1 }, schema);
  validateTemplateVariablesAgainstSchema({ x: 2 }, schema);

  assertThrows(
    () => validateTemplateVariablesAgainstSchema({ x: "not a number" }, schema),
    TemplateSchemaValidationError,
  );
});

Deno.test("validateTemplateVariablesAgainstSchema skips empty or null schema", () => {
  validateTemplateVariablesAgainstSchema({ anything: true }, {});
  validateTemplateVariablesAgainstSchema({ anything: true }, null);
  validateTemplateVariablesAgainstSchema({ anything: true }, undefined);
});

Deno.test("formatAjvErrors falls back when errors are empty or missing", () => {
  assertEquals(formatAjvErrors(null), "template_variables failed schema validation");
  assertEquals(formatAjvErrors(undefined), "template_variables failed schema validation");
  assertEquals(formatAjvErrors([]), "template_variables failed schema validation");
});

Deno.test("formatAjvErrors joins Ajv error paths and messages", () => {
  assertEquals(
    formatAjvErrors([
      { instancePath: "/name", message: "must be string" } as never,
      { instancePath: "", message: undefined } as never,
    ]),
    "/name must be string; / invalid",
  );
});
