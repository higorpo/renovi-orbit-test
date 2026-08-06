import { assertEquals } from "std/testing/asserts";
import {
  buildServiceRequestContext,
  formatContextForPrompt,
} from "../loadContext.ts";

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
    {
      categoryId: "cat-1",
      serviceTitle: "Troca de torneira",
      categoryTitle: "Hidráulica",
    },
    maxChars,
  );

  assertEquals(ctx.truncated, true);
  assertEquals(ctx.service_request_id, "sr-1");
  assertEquals(ctx.category_id, "cat-1");
  assertEquals(ctx.service_title, "Troca de torneira");
  assertEquals(ctx.category_title, "Hidráulica");
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
    {},
    12_000,
  );
  assertEquals(ctx.truncated, false);
  assertEquals(ctx.form_data, { rooms: 1 });
  assertEquals(ctx.service_title, null);
  assertEquals(ctx.category_title, null);
});

Deno.test("formatContextForPrompt sends catalog titles instead of UUIDs", () => {
  const ctx = buildServiceRequestContext(
    {
      id: "sr-3",
      service_id: "svc-uuid-1",
      title: "Pintura da sala",
      description: "Duas demãos",
      form_data: { rooms: 1 },
    },
    {
      categoryId: "cat-uuid-1",
      serviceTitle: "Pintura de parede",
      categoryTitle: "Pintura",
    },
  );

  const prompt = formatContextForPrompt(ctx);
  const parsed = JSON.parse(prompt) as Record<string, unknown>;

  assertEquals(parsed.service, "Pintura de parede");
  assertEquals(parsed.category, "Pintura");
  assertEquals(parsed.title, "Pintura da sala");
  assertEquals(parsed.description, "Duas demãos");
  assertEquals(parsed.form_data, { rooms: 1 });
  assertEquals("service_id" in parsed, false);
  assertEquals("category_id" in parsed, false);
  assertEquals(prompt.includes("svc-uuid-1"), false);
  assertEquals(prompt.includes("cat-uuid-1"), false);
});

Deno.test("formatContextForPrompt omits missing catalog titles", () => {
  const ctx = buildServiceRequestContext(
    {
      id: "sr-4",
      service_id: null,
      title: "Serviço avulso",
      description: null,
      form_data: null,
    },
  );

  const parsed = JSON.parse(formatContextForPrompt(ctx)) as Record<string, unknown>;
  assertEquals("service" in parsed, false);
  assertEquals("category" in parsed, false);
  assertEquals(parsed.title, "Serviço avulso");
});
