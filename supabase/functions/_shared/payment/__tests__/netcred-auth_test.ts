import { assertEquals, assertRejects } from "std/testing/asserts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../database.types.ts";
import {
  getNetCredToken,
  refreshAuthToken,
  resolveIsProduction,
} from "../netcred-auth.ts";
import {
  ProviderAuthError,
  SandboxCredentialsError,
  NetCredTokenRefreshTimeoutError,
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


Deno.test("resolveIsProduction uses explicit flag and env fallbacks", () => {
  assertEquals(resolveIsProduction(true), true);
  assertEquals(resolveIsProduction(false), false);

  const prevEnv = Deno.env.get("ENVIRONMENT");
  const prevEnv2 = Deno.env.get("ENV");
  Deno.env.delete("ENVIRONMENT");
  Deno.env.set("ENV", "prod");
  try {
    assertEquals(resolveIsProduction(), true);
  } finally {
    if (prevEnv === undefined) Deno.env.delete("ENVIRONMENT");
    else Deno.env.set("ENVIRONMENT", prevEnv);
    if (prevEnv2 === undefined) Deno.env.delete("ENV");
    else Deno.env.set("ENV", prevEnv2);
  }
});

Deno.test("refreshAuthToken throws when credentials are missing", async () => {
  const prevUser = Deno.env.get("NETCRED_USERNAME");
  const prevPass = Deno.env.get("NETCRED_PASSWORD");
  Deno.env.delete("NETCRED_USERNAME");
  Deno.env.delete("NETCRED_PASSWORD");
  const supabase = createSupabaseStub({
    acquireResults: [{ status: "needs_refresh" }],
  });
  try {
    await assertRejects(
      () =>
        refreshAuthToken({
          supabase,
          graphqlUrl: TEST_GRAPHQL_URL,
        }),
      ProviderAuthError,
      "NETCRED_CREDENTIALS_MISSING",
    );
  } finally {
    if (prevUser === undefined) Deno.env.delete("NETCRED_USERNAME");
    else Deno.env.set("NETCRED_USERNAME", prevUser);
    if (prevPass === undefined) Deno.env.delete("NETCRED_PASSWORD");
    else Deno.env.set("NETCRED_PASSWORD", prevPass);
  }
});

Deno.test("refreshAuthToken rejects invalid acquire RPC payload", async () => {
  const supabase = createSupabaseStub({
    acquireResults: [{ token: "x" }],
  });
  await assertRejects(
    () =>
      refreshAuthToken({
        supabase,
        graphqlUrl: TEST_GRAPHQL_URL,
        username: "user",
        password: "pass",
      }),
    ProviderAuthError,
    "NETCRED_TOKEN_RPC_INVALID_RESPONSE",
  );
});

Deno.test("refreshAuthToken rejects cached status without token", async () => {
  const supabase = createSupabaseStub({
    acquireResults: [{ status: "cached" }],
  });
  await assertRejects(
    () =>
      getNetCredToken({
        supabase,
        graphqlUrl: TEST_GRAPHQL_URL,
        username: "user",
        password: "pass",
      }),
    ProviderAuthError,
    "NETCRED_TOKEN_RPC_MISSING_TOKEN",
  );
});

Deno.test("refreshAuthToken maps wait timeout error", async () => {
  const stub = {
    rpc(name: string) {
      if (name === "acquire_or_refresh_netcred_token") {
        return Promise.resolve({
          data: null,
          error: { message: "NETCRED_TOKEN_REFRESH_WAIT_TIMEOUT" },
        });
      }
      if (name === "release_netcred_token_refresh_lock") {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: { message: "unexpected" } });
    },
  } as unknown as SupabaseClient<Database>;

  await assertRejects(
    () =>
      refreshAuthToken({
        supabase: stub,
        graphqlUrl: "https://api.example.com",
        username: "user",
        password: "pass",
      }),
    NetCredTokenRefreshTimeoutError,
  );
});

Deno.test("refreshAuthToken appends /graphql when base URL has no path", async () => {
  let calledUrl = "";
  const supabase = createSupabaseStub({
    acquireResults: [{ status: "needs_refresh" }],
  });

  await refreshAuthToken({
    supabase,
    graphqlUrl: "https://api.example.com/",
    username: "user",
    password: "pass",
    fetchFn: async (input) => {
      calledUrl = String(input);
      return tokenAuthResponse("jwt-1");
    },
  });

  assertEquals(calledUrl, "https://api.example.com/graphql");
});

Deno.test("refreshAuthToken throws ProviderAuthError on commit failure", async () => {
  const supabase = createSupabaseStub({
    acquireResults: [{ status: "needs_refresh" }],
    commitError: { message: "commit failed" },
  });

  await assertRejects(
    () =>
      refreshAuthToken({
        supabase,
        graphqlUrl: TEST_GRAPHQL_URL,
        username: "user",
        password: "pass",
        fetchFn: async () => tokenAuthResponse("jwt-1"),
      }),
    ProviderAuthError,
    "commit failed",
  );
});
