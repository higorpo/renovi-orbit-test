import { assertEquals } from "std/testing/asserts";
import { stripJsonCodeFence } from "../jsonFence.ts";

Deno.test("stripJsonCodeFence leaves plain JSON unchanged", () => {
  assertEquals(stripJsonCodeFence('{"a":1}'), '{"a":1}');
});

Deno.test("stripJsonCodeFence removes complete json fence", () => {
  assertEquals(
    stripJsonCodeFence('```json\n{"a":1}\n```'),
    '{"a":1}',
  );
});

Deno.test("stripJsonCodeFence removes fence without language tag", () => {
  assertEquals(
    stripJsonCodeFence('```\n{"a":1}\n```'),
    '{"a":1}',
  );
});

Deno.test("stripJsonCodeFence strips open fence when close is missing", () => {
  assertEquals(
    stripJsonCodeFence('```json\n{"a":1}'),
    '{"a":1}',
  );
});
