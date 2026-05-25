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
