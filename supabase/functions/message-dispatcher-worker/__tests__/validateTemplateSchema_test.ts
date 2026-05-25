import { assertEquals, assertThrows } from "std/testing/asserts";
import {
  resetSchemaCache,
  TemplateSchemaValidationError,
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
