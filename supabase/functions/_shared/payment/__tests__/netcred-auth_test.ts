import { assertEquals, assertRejects } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../database.types.ts";
import {
  getNetCredToken,
  refreshAuthToken,
} from "../netcred-auth.ts";
import {
  ProviderAuthError,
  SandboxCredentialsError,
} from "../errors.ts";

const TEST_GRAPHQL_URL = "https://api.netcredbrasil.com.br/graphql";

type RpcArgs = {
  p_new_token?: string;
  p_expires_at?: string;
  p_is_sandbox?: boolean;
};

function createSupabaseStub(options: {
  acquireResults: unknown[];
  commitResult?: unknown;
  commitError?: { message: string } | null;
}): SupabaseClient<Database> {
  let acquireIndex = 0;

  const stub = {
    rpc(name: string, args?: RpcArgs) {
      if (name === "acquire_or_refresh_netcred_token") {
        if (args?.p_new_token) {
          if (options.commitError) {
            return Promise.resolve({ data: null, error: options.commitError });
          }
          return Promise.resolve({
            data: options.commitResult ?? {
              status: "refreshed",
              token: args.p_new_token,
              expires_at: args.p_expires_at,
            },
            error: null,
          });
        }

        const result = options.acquireResults[acquireIndex] ??
          options.acquireResults[options.acquireResults.length - 1];
        acquireIndex += 1;
        return Promise.resolve({ data: result, error: null });
      }

      if (name === "release_netcred_token_refresh_lock") {
        return Promise.resolve({ data: null, error: null });
      }

      return Promise.resolve({
        data: null,
        error: { message: `unexpected rpc ${name}` },
      });
    },
  };

  return stub as unknown as SupabaseClient<Database>;
}

function tokenAuthResponse(token: string, sandbox = false): Response {
  return new Response(
    JSON.stringify({
      data: {
        tokenAuth: {
          token,
          errors: [],
          user: { sandbox },
        },
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

Deno.test("getNetCredToken returns cached token without tokenAuth call", async () => {
  const fetchCalls: string[] = [];
  const supabase = createSupabaseStub({
    acquireResults: [{ status: "cached", token: "cached-jwt" }],
  });

  const token = await getNetCredToken({
    supabase,
    graphqlUrl: TEST_GRAPHQL_URL,
    fetchFn: async () => {
      fetchCalls.push("tokenAuth");
      return tokenAuthResponse("unused");
    },
  });

  assertEquals(token, "cached-jwt");
  assertEquals(fetchCalls.length, 0);
});

Deno.test("refreshAuthToken calls tokenAuth once when cache is stale", async () => {
  let tokenAuthCalls = 0;
  const supabase = createSupabaseStub({
    acquireResults: [{ status: "needs_refresh" }],
  });

  const token = await refreshAuthToken({
    supabase,
    graphqlUrl: TEST_GRAPHQL_URL,
    username: "user",
    password: "pass",
    isProduction: true,
    fetchFn: async () => {
      tokenAuthCalls += 1;
      return tokenAuthResponse("fresh-jwt");
    },
  });

  assertEquals(token, "fresh-jwt");
  assertEquals(tokenAuthCalls, 1);
});

Deno.test("concurrent refresh path reuses cached token on second acquire", async () => {
  let tokenAuthCalls = 0;
  const supabase = createSupabaseStub({
    acquireResults: [
      { status: "needs_refresh" },
      { status: "cached", token: "winner-jwt" },
    ],
  });

  const first = refreshAuthToken({
    supabase,
    graphqlUrl: TEST_GRAPHQL_URL,
    username: "user",
    password: "pass",
    fetchFn: async () => {
      tokenAuthCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return tokenAuthResponse("late-jwt");
    },
  });

  const second = refreshAuthToken({
    supabase,
    graphqlUrl: TEST_GRAPHQL_URL,
    username: "user",
    password: "pass",
    fetchFn: async () => {
      tokenAuthCalls += 1;
      return tokenAuthResponse("other-jwt");
    },
  });

  const [firstToken, secondToken] = await Promise.all([first, second]);
  assertEquals(firstToken, "late-jwt");
  assertEquals(secondToken, "winner-jwt");
  assertEquals(tokenAuthCalls, 1);
});

Deno.test("sandbox assertion rejects production tokenAuth with sandbox user", async () => {
  const criticalMessages: string[] = [];
  const supabase = createSupabaseStub({
    acquireResults: [{ status: "needs_refresh" }],
  });

  await assertRejects(
    () =>
      refreshAuthToken({
        supabase,
        graphqlUrl: TEST_GRAPHQL_URL,
        username: "user",
        password: "pass",
        isProduction: true,
        captureCritical: (message) => {
          criticalMessages.push(message);
        },
        fetchFn: async () => tokenAuthResponse("sandbox-jwt", true),
      }),
    SandboxCredentialsError,
  );

  assertEquals(
    criticalMessages.includes("SANDBOX_CREDENTIALS_IN_PRODUCTION"),
    true,
  );
});

Deno.test("tokenAuth failure emits critical capture and throws ProviderAuthError", async () => {
  const criticalMessages: string[] = [];
  const supabase = createSupabaseStub({
    acquireResults: [{ status: "needs_refresh" }],
  });

  await assertRejects(
    () =>
      refreshAuthToken({
        supabase,
        graphqlUrl: TEST_GRAPHQL_URL,
        username: "user",
        password: "pass",
        captureCritical: (message) => {
          criticalMessages.push(message);
        },
        fetchFn: async () =>
          new Response(
            JSON.stringify({
              data: {
                tokenAuth: {
                  token: null,
                  errors: [{ message: "invalid credentials" }],
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      }),
    ProviderAuthError,
  );

  assertEquals(criticalMessages.includes("NETCRED_AUTH_FAILURE"), true);
});
