import { assertEquals } from "std/testing/asserts";
import {
  buildNetCredChargeExtraInfo,
  NETCRED_CHARGE_TEXT_MAX_LENGTH,
  resolveNetCredServiceTitle,
  truncateNetCredChargeText,
} from "../netcredChargeText.ts";

Deno.test("resolveNetCredServiceTitle falls back to Serviço", () => {
  assertEquals(resolveNetCredServiceTitle(null), "Serviço");
  assertEquals(resolveNetCredServiceTitle("   "), "Serviço");
});

Deno.test("buildNetCredChargeExtraInfo prefixes Prestway brand", () => {
  assertEquals(
    buildNetCredChargeExtraInfo("Pintura interna"),
    "Prestway — Pintura interna",
  );
});

Deno.test("truncateNetCredChargeText enforces NetCred 150-char limit", () => {
  const longTitle = "A".repeat(200);
  assertEquals(
    truncateNetCredChargeText(`Prestway — ${longTitle}`).length,
    NETCRED_CHARGE_TEXT_MAX_LENGTH,
  );
});
