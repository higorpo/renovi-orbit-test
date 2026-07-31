import { assertEquals } from "std/testing/asserts";
import { parseClaimedSchedules } from "../parseClaimedSchedules.ts";

Deno.test("parseClaimedSchedules returns empty for non-array payloads", () => {
  assertEquals(parseClaimedSchedules(null), []);
  assertEquals(parseClaimedSchedules({}), []);
  assertEquals(parseClaimedSchedules("x"), []);
});

Deno.test("parseClaimedSchedules maps claim rows and drops missing transaction ids", () => {
  const result = parseClaimedSchedules([
    {
      schedule_id: "s-1",
      provider_id: "p-1",
      state: "PAID",
      gateway_transaction_id: "  tx-1  ",
      gateway_slug: "netcred",
      netcred_company_id: 1048,
      paid_at: "2026-07-01T12:00:00Z",
    },
    {
      id: "s-2",
      provider_id: "p-2",
      state: "PAID",
      gateway_transaction_id: null,
      provider_id_ignored: true,
    },
    {
      id: "s-3",
      provider_id: "p-3",
      state: "PAID",
      gateway_transaction_id: "   ",
    },
  ]);

  assertEquals(result, [{
    id: "s-1",
    provider_id: "p-1",
    state: "PAID",
    gateway_transaction_id: "tx-1",
    gateway_slug: "netcred",
    netcred_company_id: "1048",
    paid_at: "2026-07-01T12:00:00Z",
  }]);
});

Deno.test("parseClaimedSchedules defaults gateway_slug and nullable fields", () => {
  const result = parseClaimedSchedules([{
    id: "s-9",
    provider_id: "p-9",
    state: "PAID",
    gateway_transaction_id: "tx-9",
  }]);

  assertEquals(result[0], {
    id: "s-9",
    provider_id: "p-9",
    state: "PAID",
    gateway_transaction_id: "tx-9",
    gateway_slug: "netcred",
    netcred_company_id: null,
    paid_at: null,
  });
});
