import { assertEquals, assertThrows } from "std/testing/asserts";
import { renderEmailFromTemplate } from "../renderEmail.ts";
import { TemplateVariablesSizeError, validateTemplateVariablesSize } from "../templateVariables.ts";

Deno.test("renderEmailFromTemplate substitutes Mustache variables", () => {
  const rendered = renderEmailFromTemplate(
    {
      subject_template: "Welcome, {{name}}!",
      body_template: "<p>Hi {{name}}</p>{{#coupon}}<p>Code: {{coupon}}</p>{{/coupon}}",
    },
    { name: "Ana", coupon: "SAVE10" },
  );

  assertEquals(rendered.subject, "Welcome, Ana!");
  assertEquals(rendered.html, "<p>Hi Ana</p><p>Code: SAVE10</p>");
});

Deno.test("renderEmailFromTemplate omits optional Mustache sections when absent", () => {
  const rendered = renderEmailFromTemplate(
    {
      subject_template: "Hello {{name}}",
      body_template: "{{#coupon}}Coupon{{/coupon}}<p>Done</p>",
    },
    { name: "Bob" },
  );

  assertEquals(rendered.html, "<p>Done</p>");
});

Deno.test("validateTemplateVariablesSize rejects payloads over 8KB", () => {
  const big = { payload: "x".repeat(9000) };
  assertThrows(
    () => validateTemplateVariablesSize(big),
    TemplateVariablesSizeError,
  );
});

Deno.test("renderEmailFromTemplate treats null subject_template as empty", () => {
  const rendered = renderEmailFromTemplate(
    {
      subject_template: null,
      body_template: "<p>{{name}}</p>",
    },
    { name: "Ana" },
  );
  assertEquals(rendered.subject, "");
  assertEquals(rendered.html, "<p>Ana</p>");
});
