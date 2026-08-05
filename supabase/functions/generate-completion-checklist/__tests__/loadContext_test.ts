import { assertEquals } from "std/testing/asserts";
import { buildServiceRequestContext } from "../loadContext.ts";

Deno.test("buildServiceRequestContext truncates oversized form_data", () => {
  const maxChars = 500;
  const huge = "x".repeat(maxChars + 500);
  const ctx = buildServiceRequestContext(
    {
      id: "sr-1",
      service_id: "svc-1",
      title: "Troca de torneira",
      description: "Vazamento",
      form_data: { notes: huge },
    },
    "cat-1",
    maxChars,
  );

  assertEquals(ctx.truncated, true);
  assertEquals(ctx.service_request_id, "sr-1");
  assertEquals(ctx.category_id, "cat-1");
  assertEquals((ctx.original_chars ?? 0) > maxChars, true);
  assertEquals((ctx.truncated_chars ?? 0) <= maxChars, true);
  const serialized = JSON.stringify({
    title: ctx.title,
    description: ctx.description,
    form_data: ctx.form_data,
  });
  assertEquals(serialized.length <= maxChars, true);
});

Deno.test("buildServiceRequestContext keeps small payloads untruncated", () => {
  const ctx = buildServiceRequestContext(
    {
      id: "sr-2",
      service_id: null,
      title: "Pintura",
      description: "Sala",
      form_data: { rooms: 1 },
    },
    null,
    12_000,
  );
  assertEquals(ctx.truncated, false);
  assertEquals(ctx.form_data, { rooms: 1 });
});
