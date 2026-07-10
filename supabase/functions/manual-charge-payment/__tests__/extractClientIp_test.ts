import { assertEquals } from "std/testing/asserts";
import { extractClientIp } from "../extractClientIp.ts";

Deno.test("extractClientIp prefers CF-Connecting-IP", () => {
  const req = new Request("https://example.com", {
    headers: {
      "CF-Connecting-IP": " 203.0.113.10 ",
      "X-Forwarded-For": "198.51.100.1, 203.0.113.50",
    },
  });
  assertEquals(extractClientIp(req), "203.0.113.10");
});

Deno.test("extractClientIp uses first X-Forwarded-For hop when CF header missing", () => {
  const req = new Request("https://example.com", {
    headers: {
      "X-Forwarded-For": "198.51.100.1, 203.0.113.50",
    },
  });
  assertEquals(extractClientIp(req), "198.51.100.1");
});

Deno.test("extractClientIp returns null when no IP headers are present", () => {
  const req = new Request("https://example.com");
  assertEquals(extractClientIp(req), null);
});

Deno.test("extractClientIp returns null for empty X-Forwarded-For hops", () => {
  const req = new Request("https://example.com", {
    headers: { "X-Forwarded-For": " , " },
  });
  assertEquals(extractClientIp(req), null);
});
