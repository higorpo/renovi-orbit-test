import { assertEquals, assertRejects } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchEmailTemplate, fetchPushTemplate } from "../templates.ts";

function mockSupabaseTemplate(
  response: { data: unknown; error: { message: string } | null },
): SupabaseClient {
  return {
    schema: () => ({
      from: () => ({
        select: () => ({
          eq: (_col: string, _val: string) => ({
            eq: (_col2: string, _val2: string) => ({
              maybeSingle: async () => response,
            }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

Deno.test("fetchEmailTemplate returns template row on success", async () => {
  const templateData = {
    template_key: "welcome_template",
    channel: "email",
    subject_template: "Welcome {{name}}",
    body_template: "<p>Hi {{name}}</p>",
    variable_schema: { type: "object" },
    active: true,
  };
  const supabase = mockSupabaseTemplate({ data: templateData, error: null });
  const result = await fetchEmailTemplate(supabase, "welcome_template");

  assertEquals(result.template_key, "welcome_template");
  assertEquals(result.subject_template, "Welcome {{name}}");
  assertEquals(result.body_template, "<p>Hi {{name}}</p>");
});

Deno.test("fetchEmailTemplate throws when template not found", async () => {
  const supabase = mockSupabaseTemplate({ data: null, error: null });
  await assertRejects(
    () => fetchEmailTemplate(supabase, "nonexistent"),
    Error,
    "template_not_found: nonexistent",
  );
});

Deno.test("fetchEmailTemplate throws when template is inactive", async () => {
  const templateData = {
    template_key: "disabled",
    channel: "email",
    subject_template: "Subject",
    body_template: "Body",
    variable_schema: null,
    active: false,
  };
  const supabase = mockSupabaseTemplate({ data: templateData, error: null });
  await assertRejects(
    () => fetchEmailTemplate(supabase, "disabled"),
    Error,
    "template_not_found: disabled",
  );
});

Deno.test("fetchEmailTemplate throws on DB error", async () => {
  const supabase = mockSupabaseTemplate({
    data: null,
    error: { message: "connection refused" },
  });
  await assertRejects(
    () => fetchEmailTemplate(supabase, "welcome_template"),
    Error,
    "template_fetch_failed: connection refused",
  );
});

Deno.test("fetchPushTemplate returns push template row on success", async () => {
  const templateData = {
    template_key: "engagement_push",
    channel: "push",
    subject_template: "{{headline}}",
    body_template: "{{name}} — {{body}}",
    variable_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
    active: true,
  };
  const supabase = mockSupabaseTemplate({ data: templateData, error: null });
  const result = await fetchPushTemplate(supabase, "engagement_push");

  assertEquals(result.template_key, "engagement_push");
  assertEquals(result.channel, "push");
  assertEquals(result.variable_schema.type, "object");
});

Deno.test("fetchPushTemplate throws when template not found", async () => {
  const supabase = mockSupabaseTemplate({ data: null, error: null });
  await assertRejects(
    () => fetchPushTemplate(supabase, "missing_push"),
    Error,
    "template_not_found: missing_push",
  );
});
