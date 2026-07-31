import { assertEquals } from "std/testing/asserts";
import {
  buildBankAccountMask,
  isPayoutEventType,
  parsePayoutPayload,
  PAYOUT_INLINE_MAX_MOVEMENTS,
} from "../parsePayoutPayload.ts";

const samplePayoutCreate: Record<string, unknown> = {
  id: 12345,
  amount: "1500.00",
  paid_amount: "0.00",
  payout_status: "PENDING",
  brand: "MCC",
  is_advance: false,
  settling_at: "2026-06-15",
  settled_at: null,
  bank_account: {
    holder: "Provider LTDA",
    agency: "0001",
    number: "1234567-7",
    account_type: "CHECKING",
    bank: { compe: "341", ispb: "60701190", name: "Itaú" },
  },
  company: { id: 1048, name: "Provider", document: "12345678000199" },
  movements: [
    {
      id: 98765,
      transaction_id: 555,
      movement_status: "PENDING",
      movement_type: "CARD_PAYMENT",
      movement_source: "TRANSACTION",
      record_type: "CREDIT",
      base_settle_date: "2026-06-15",
      settling_at: "2026-06-15",
      settled_at: null,
      installment: 1,
      amount: "1470.00",
      net_amount: "1470.00",
      company_id: 1014,
      holder_company_id: 1048,
    },
    {
      id: 98766,
      transaction_id: 555,
      movement_status: "PENDING",
      movement_type: "CARD_PAYMENT",
      movement_source: "TRANSACTION",
      record_type: "CREDIT",
      settling_at: "2026-06-15",
      installment: 1,
      amount: "30.00",
      net_amount: "30.00",
      holder_company_id: 1014,
    },
  ],
};

Deno.test("isPayoutEventType matches CREATE and SETTLE", () => {
  assertEquals(isPayoutEventType("PAYOUT_CREATE"), true);
  assertEquals(isPayoutEventType("payout_settle"), true);
  assertEquals(isPayoutEventType("TRANSACTION_CAPTURE"), false);
});

Deno.test("buildBankAccountMask masks last digits with bank name", () => {
  assertEquals(
    buildBankAccountMask({
      number: "1234567-7",
      bank: { name: "Itaú", compe: "341" },
    }),
    "Itaú ****67-7",
  );
  assertEquals(buildBankAccountMask(null), null);
});

Deno.test("parsePayoutPayload maps CREATE movements to upsert items", () => {
  const result = parsePayoutPayload(samplePayoutCreate);

  assertEquals(result.payload?.id, "12345");
  assertEquals(result.upsertItems.length, 2);
  assertEquals(result.warnings.length, 0);

  const providerLeg = result.upsertItems[0];
  assertEquals(providerLeg.gateway_slug, "netcred");
  assertEquals(providerLeg.gateway_payout_id, "12345");
  assertEquals(providerLeg.gateway_movement_id, "98765");
  assertEquals(providerLeg.gateway_transaction_id, "555");
  assertEquals(providerLeg.holder_company_id, "1048");
  assertEquals(providerLeg.sync_source, "webhook");
  assertEquals(providerLeg.is_refund_clawback, false);
  assertEquals(providerLeg.record_type, "CREDIT");
  assertEquals(providerLeg.gross_amount, "1470.00");
  assertEquals(providerLeg.net_amount, "1470.00");
  assertEquals(providerLeg.bank_account_mask, "Itaú ****67-7");
  assertEquals(providerLeg.brand, "MCC");
  assertEquals(providerLeg.raw_snapshot.payout_id, "12345");
});

Deno.test("parsePayoutPayload marks DEBIT as refund clawback", () => {
  const result = parsePayoutPayload({
    id: "payout-2",
    payout_status: "PAID_OUT",
    is_advance: false,
    movements: [
      {
        id: "mov-debit",
        transaction_id: "tx-1",
        movement_status: "PAID_OUT",
        movement_type: "REFUND",
        movement_source: "REFUND",
        record_type: "DEBIT",
        amount: "20.00",
        net_amount: "20.00",
        holder_company_id: "1048",
        settled_at: "2026-06-15T14:30:00Z",
      },
    ],
  });

  assertEquals(result.upsertItems.length, 1);
  assertEquals(result.upsertItems[0].is_refund_clawback, true);
  assertEquals(result.upsertItems[0].record_type, "DEBIT");
  assertEquals(result.upsertItems[0].settled_at, "2026-06-15T14:30:00Z");
});

Deno.test("parsePayoutPayload warns on unknown enums but still upserts", () => {
  const result = parsePayoutPayload({
    id: "payout-3",
    payout_status: "WEIRD_STATUS",
    movements: [
      {
        id: "mov-1",
        transaction_id: "tx-1",
        movement_status: "SETTLING",
        movement_type: "FUTURE_TYPE",
        movement_source: "CUSTOM",
        record_type: "CREDIT",
        amount: "10.00",
        net_amount: "9.00",
        holder_company_id: "1048",
      },
    ],
  });

  assertEquals(result.upsertItems.length, 1);
  assertEquals(result.upsertItems[0].movement_status, "SETTLING");
  assertEquals(
    result.warnings.includes("unknown_payout_status:WEIRD_STATUS"),
    true,
  );
  assertEquals(
    result.warnings.includes("unknown_movement_status:SETTLING"),
    true,
  );
  assertEquals(result.warnings.includes("unknown_movement_type:FUTURE_TYPE"), true);
  assertEquals(result.warnings.includes("unknown_movement_source:CUSTOM"), true);
});

Deno.test("parsePayoutPayload skips incomplete movements with warning", () => {
  const result = parsePayoutPayload({
    id: "payout-4",
    movements: [
      {
        id: "mov-bad",
        transaction_id: "tx-1",
        movement_status: "PENDING",
        // missing record_type / amounts
      },
      {
        id: "mov-ok",
        transaction_id: "tx-1",
        movement_status: "PENDING",
        record_type: "CREDIT",
        amount: "1.00",
        net_amount: "1.00",
        holder_company_id: "1048",
      },
    ],
  });

  assertEquals(result.upsertItems.length, 1);
  assertEquals(result.upsertItems[0].gateway_movement_id, "mov-ok");
  assertEquals(
    result.warnings.includes("skipped_invalid_movement:mov-bad"),
    true,
  );
});

Deno.test("parsePayoutPayload returns null payload without payout id", () => {
  const result = parsePayoutPayload({ movements: [] });
  assertEquals(result.payload, null);
  assertEquals(result.upsertItems.length, 0);
  assertEquals(result.warnings, ["missing_payout_id"]);
});

Deno.test("PAYOUT_INLINE_MAX_MOVEMENTS is positive", () => {
  assertEquals(PAYOUT_INLINE_MAX_MOVEMENTS > 0, true);
});
