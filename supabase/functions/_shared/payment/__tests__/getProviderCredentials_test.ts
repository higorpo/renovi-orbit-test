import { assertEquals, assertRejects } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../database.types.ts";
import { NetCredAdapter } from "../netcred-adapter.ts";

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
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn,
  });
}

Deno.test("getProviderCredentials returns null for empty document", async () => {
  let fetchCalled = false;
  const adapter = createAdapter(async () => {
    fetchCalled = true;
    return new Response("{}", { status: 200 });
  });

  const result = await adapter.getProviderCredentials("   ---  ");

  assertEquals(result, null);
  assertEquals(fetchCalled, false);
});

Deno.test("getProviderCredentials returns company with active bank account", async () => {
  let requestBody: { variables?: { document?: string } } | undefined;

  const adapter = createAdapter(async (_url, init) => {
    requestBody = JSON.parse(String(init?.body ?? "{}"));
    return new Response(
      JSON.stringify({
        data: {
          companies: {
            edges: [{
              node: {
                id: "1048",
                document: "12345678000199",
                companyState: "APPROVED",
                bankAccounts: {
                  edges: [
                    { node: { id: "ba-inactive", isActive: false } },
                    { node: { id: "ba-active", isActive: true } },
                  ],
                },
              },
            }],
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });

  const result = await adapter.getProviderCredentials("12.345.678/0001-99");

  assertEquals(requestBody?.variables?.document, "12345678000199");
  assertEquals(result, {
    document: "12345678000199",
    companyId: "1048",
    bankAccountId: "ba-active",
    onboardingStatus: "APPROVED",
  });
});

Deno.test("getProviderCredentials returns null when company node is missing", async () => {
  const adapter = createAdapter(async () =>
    new Response(
      JSON.stringify({
        data: { companies: { edges: [] } },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  );

  const result = await adapter.getProviderCredentials("12345678000199");
  assertEquals(result, null);
});

Deno.test("getProviderCredentials omits bankAccountId when none is active", async () => {
  const adapter = createAdapter(async () =>
    new Response(
      JSON.stringify({
        data: {
          companies: {
            edges: [{
              node: {
                id: "1048",
                document: null,
                companyState: "PENDING",
                bankAccounts: {
                  edges: [{ node: { id: "ba-1", isActive: false } }],
                },
              },
            }],
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  );

  const result = await adapter.getProviderCredentials("99999999000191");

  assertEquals(result?.companyId, "1048");
  assertEquals(result?.document, "99999999000191");
  assertEquals(result?.bankAccountId, undefined);
  assertEquals(result?.onboardingStatus, "PENDING");
});

Deno.test("getProviderCredentials rethrows network errors", async () => {
  const adapter = createAdapter(async () => {
    throw new TypeError("dns failure");
  });

  await assertRejects(
    () => adapter.getProviderCredentials("12345678000199"),
    TypeError,
    "dns failure",
  );
});

Deno.test("getProviderCredentials returns null for unexpected non-network errors", async () => {
  const adapter = createAdapter(async () => {
    throw new Error("unexpected");
  });

  const result = await adapter.getProviderCredentials("12345678000199");
  assertEquals(result, null);
});
