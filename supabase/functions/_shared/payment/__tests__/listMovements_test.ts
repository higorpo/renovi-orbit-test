import { assertEquals } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../database.types.ts";
import { NetCredAdapter } from "../netcred-adapter.ts";
import {
  mapSettlementMovementToUpsertItem,
  maskBankAccount,
} from "../mapSettlementMovementUpsert.ts";

const TEST_GRAPHQL_URL = "https://api.netcredbrasil.com.br/graphql";

function createSupabaseStub(): SupabaseClient<Database> {
  return {
    rpc(name: string) {
      if (name === "acquire_or_refresh_netcred_token") {
        return Promise.resolve({
          data: { status: "cached", token: "jwt-token" },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: `unexpected ${name}` } });
    },
  } as unknown as SupabaseClient<Database>;
}

function createAdapter(fetchFn: typeof fetch): NetCredAdapter {
  return new NetCredAdapter({
    supabase: createSupabaseStub(),
    platformBankAccountId: "2052",
    platformCompanyId: "1014",
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn,
  });
}

Deno.test("maskBankAccount hides full account number", () => {
  assertEquals(
    maskBankAccount({
      bankName: "Nubank",
      bankCompe: "260",
      accountNumber: "123456-7",
    }),
    "Nubank ****4567",
  );
  assertEquals(
    maskBankAccount({ bankCompe: "001", accountNumber: null }),
    "001",
  );
});

Deno.test("mapSettlementMovementToUpsertItem uses pre_payout fallback", () => {
  const item = mapSettlementMovementToUpsertItem(
    {
      id: "m1",
      amount: "10.00",
      netAmount: "9.50",
      movementStatus: "PENDING",
      recordType: "CREDIT",
      transactionId: "tx-1",
      payoutId: null,
      holderCompanyId: "1048",
    },
    "graphql_reconcile",
  );
  assertEquals(item?.gateway_payout_id, "pre_payout:tx-1");
  assertEquals(item?.sync_source, "graphql_reconcile");
});

Deno.test("listMovementsByTransactionId maps GraphQL edges", async () => {
  const bodies: unknown[] = [];
  const adapter = createAdapter(async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({
        data: {
          movements: {
            totalCount: 1,
            pageInfo: { hasNextPage: false, endCursor: null },
            edges: [{
              node: {
                id: "98765",
                amount: "1500.00",
                netAmount: "1470.00",
                movementStatus: "PENDING",
                movementType: "CARD_PAYMENT",
                movementSource: "TRANSACTION",
                recordType: "CREDIT",
                installment: 1,
                settlingAt: "2026-06-15",
                settledAt: null,
                isAdvance: false,
                brand: "MCC",
                bankAccountNumber: "9999",
                bankAccountBank: { compe: "260", name: "Nubank" },
                holderCompany: { id: "1048", name: "Provider" },
                company: { id: "1014" },
                payout: {
                  id: "12345",
                  payoutStatus: "PENDING",
                  brand: null,
                  isAdvance: false,
                },
                transaction: { id: "444677" },
              },
            }],
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });

  const movements = await adapter.listMovementsByTransactionId("444677");
  assertEquals(movements.length, 1);
  assertEquals(movements[0]?.id, "98765");
  assertEquals(movements[0]?.holderCompanyId, "1048");
  assertEquals(movements[0]?.payoutId, "12345");
  assertEquals(movements[0]?.transactionId, "444677");

  const requestBody = bodies[0] as { variables: Record<string, unknown> };
  assertEquals(requestBody.variables.transactionId, "444677");
});

Deno.test("listMovementsByPayoutId pages until hasNextPage is false", async () => {
  let page = 0;
  const adapter = createAdapter(async () => {
    page += 1;
    if (page === 1) {
      return new Response(
        JSON.stringify({
          data: {
            movements: {
              pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
              edges: [{
                node: {
                  id: "1",
                  amount: "1.00",
                  netAmount: "1.00",
                  movementStatus: "PENDING",
                  recordType: "CREDIT",
                  transaction: { id: "tx-1" },
                },
              }],
            },
          },
        }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({
        data: {
          movements: {
            pageInfo: { hasNextPage: false, endCursor: null },
            edges: [{
              node: {
                id: "2",
                amount: "2.00",
                netAmount: "2.00",
                movementStatus: "PAID_OUT",
                recordType: "CREDIT",
                settledAt: "2026-06-16T10:00:00Z",
                transaction: { id: "tx-1" },
              },
            }],
          },
        },
      }),
      { status: 200 },
    );
  });

  const movements = await adapter.listMovementsByPayoutId("payout-9");
  assertEquals(movements.map((m) => m.id), ["1", "2"]);
  assertEquals(page, 2);
});
