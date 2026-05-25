import { assertEquals } from "std/testing/asserts";
import {
  extractResendVendorMessageId,
  extractSvixEventId,
} from "../reconcile.ts";
import { SVIX_ID_HEADER } from "../svix.ts";

Deno.test("extractSvixEventId reads svix-id header", () => {
  const req = new Request("https://example.com", {
    headers: { [SVIX_ID_HEADER]: "msg_svix_abc" },
  });
  assertEquals(extractSvixEventId(req), "msg_svix_abc");
});

Deno.test("extractResendVendorMessageId prefers email_id", () => {
  assertEquals(
    extractResendVendorMessageId({
      type: "email.delivered",
      data: { email_id: "re_123", id: "other" },
    }),
    "re_123",
  );
});

Deno.test("extractResendVendorMessageId returns null when data missing", () => {
  assertEquals(
    extractResendVendorMessageId({ type: "email.delivered" }),
    null,
  );
});
