import { assertEquals, assertThrows } from "std/testing/asserts";
import {
  MAX_TEMPLATE_VARIABLES_BYTES,
  templateVariablesByteLength,
  TemplateVariablesSizeError,
  validateTemplateVariablesSize,
} from "../templateVariables.ts";

Deno.test("MAX_TEMPLATE_VARIABLES_BYTES is 8192", () => {
  assertEquals(MAX_TEMPLATE_VARIABLES_BYTES, 8192);
});

Deno.test("templateVariablesByteLength handles null/undefined as empty object", () => {
  // null ?? {} → {} → "{}" → 2 bytes; undefined ?? {} → {} → "{}" → 2 bytes
  assertEquals(templateVariablesByteLength(null), 2);
  assertEquals(templateVariablesByteLength(undefined), 2);
});

Deno.test("templateVariablesByteLength counts UTF-8 bytes for emoji payload", () => {
  const vars = { emoji: "🎉" };
  const bytes = templateVariablesByteLength(vars);
  const jsonStr = JSON.stringify(vars);
  // 🎉 is 4 bytes in UTF-8 but 2 chars in JS string; encoded byte length > string .length
  assertEquals(bytes > jsonStr.length, true);
  assertEquals(bytes > 0, true);
});

Deno.test("validateTemplateVariablesSize passes for small payload", () => {
  validateTemplateVariablesSize({ name: "Ana" });
});

Deno.test("validateTemplateVariablesSize passes at exactly limit boundary", () => {
  const targetBytes = MAX_TEMPLATE_VARIABLES_BYTES;
  const overhead = new TextEncoder().encode(JSON.stringify({ data: "" })).length;
  const fillLength = targetBytes - overhead;
  const vars = { data: "a".repeat(fillLength) };
  const actualBytes = templateVariablesByteLength(vars);
  assertEquals(actualBytes <= MAX_TEMPLATE_VARIABLES_BYTES, true);
  validateTemplateVariablesSize(vars);
});

Deno.test("validateTemplateVariablesSize throws for payload over 8KB", () => {
  const big = { payload: "x".repeat(9000) };
  assertThrows(
    () => validateTemplateVariablesSize(big),
    TemplateVariablesSizeError,
  );
});

Deno.test("TemplateVariablesSizeError has correct code", () => {
  const err = new TemplateVariablesSizeError(9000);
  assertEquals(err.code, "template_variables_too_large");
  assertEquals(err.name, "TemplateVariablesSizeError");
  assertEquals(err.message.includes("9000"), true);
});
