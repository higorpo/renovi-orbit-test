import { assertEquals } from "std/testing/asserts";
import { timingSafeEqualStrings } from "../timingSafeEqual.ts";

Deno.test("timingSafeEqualStrings returns true for identical strings", () => {
  assertEquals(timingSafeEqualStrings("secret-value", "secret-value"), true);
});

Deno.test("timingSafeEqualStrings returns false for different content", () => {
  assertEquals(timingSafeEqualStrings("secret-value", "secret-valuX"), false);
});

Deno.test("timingSafeEqualStrings returns false for different lengths", () => {
  assertEquals(timingSafeEqualStrings("abc", "abcd"), false);
});

Deno.test("timingSafeEqualStrings returns true for empty strings", () => {
  assertEquals(timingSafeEqualStrings("", ""), true);
});

Deno.test("timingSafeEqualStrings handles unicode of equal byte length", () => {
  assertEquals(timingSafeEqualStrings("café", "café"), true);
  assertEquals(timingSafeEqualStrings("café", "cafe"), false);
});
