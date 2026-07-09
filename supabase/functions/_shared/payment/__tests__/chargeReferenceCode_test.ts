import { assertEquals } from "std/testing/asserts";
import { resolveChargeReferenceCode } from "../chargeReferenceCode.ts";

Deno.test("resolveChargeReferenceCode prefers gateway_reference_code", () => {
  assertEquals(
    resolveChargeReferenceCode({
      gatewayReferenceCode: "11111111-2222-3333-4444-555555555555",
      contractedServiceId: "be2fed77-cedd-4f34-bd07-14693e763298",
    }),
    "11111111-2222-3333-4444-555555555555",
  );
});

Deno.test("resolveChargeReferenceCode falls back to contracted_service_id", () => {
  assertEquals(
    resolveChargeReferenceCode({
      gatewayReferenceCode: null,
      contractedServiceId: "be2fed77-cedd-4f34-bd07-14693e763298",
    }),
    "be2fed77-cedd-4f34-bd07-14693e763298",
  );
});
