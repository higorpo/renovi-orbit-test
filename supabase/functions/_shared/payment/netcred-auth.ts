import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types.ts";
import { getEnvSecret } from "../getEnvSecret.ts";
import {
  CRITICAL_ALERTS,
  captureNetcredAuthFailureCritical,
  captureSandboxCredentialsCritical,
} from "../observability/critical-alerts.ts";
import { withGatewaySpan } from "../observability/gateway-spans.ts";
import { fetchWithTimeout } from "../providerHttp.ts";
import {
  ProviderAuthError,
  SandboxCredentialsError,
  NetCredTokenRefreshTimeoutError,
} from "./errors.ts";
import { resolveNetCredApiBaseUrl } from "./constants.ts";

const TOKEN_AUTH_MUTATION = `
mutation tokenAuth($username: String!, $password: String!) {
  tokenAuth(username: $username, password: $password) {
    token
    refreshExpiresIn
    errors { code field message }
    user {
      id
      username
      sandbox
    }
  }
}
`;

export type NetCredTokenAcquireStatus = "cached" | "needs_refresh" | "refreshed";

export type NetCredTokenAcquireResult = {
  status: NetCredTokenAcquireStatus;
  token?: string;
  expires_at?: string;
  is_sandbox?: boolean;
};

export type NetCredAuthDeps = {
  supabase: SupabaseClient<Database>;
  fetchFn?: typeof fetch;
  graphqlUrl?: string;
  username?: string;
  password?: string;
  isProduction?: boolean;
  captureCritical?: (
    message: string,
    extra?: Record<string, unknown>,
  ) => void;
};

type TokenAuthGraphQLResponse = {
  data?: {
    tokenAuth?: {
      token?: string | null;
      refreshExpiresIn?: number | null;
      errors?: Array<{ code?: string; message?: string }> | null;
      user?: { sandbox?: boolean | null } | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
};

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const AUTH_ERROR_MESSAGE_MAX_LENGTH = 200;

const STABLE_AUTH_ERROR_CODES = new Set([
  "NETCRED_CREDENTIALS_MISSING",
  "NETCRED_TOKEN_RPC_INVALID_RESPONSE",
  "NETCRED_TOKEN_RPC_MISSING_TOKEN",
  "NETCRED_TOKEN_REFRESH_WAIT_TIMEOUT",
  "NETCRED_AUTH_FAILURE",
  "NETCRED_CREDENTIALS_INVALID",
]);

function resolveGraphqlUrl(override?: string): string {
  if (override) {
    return override.includes("/graphql")
      ? override
      : `${override.replace(/\/+$/, "")}/graphql`;
  }
  return `${resolveNetCredApiBaseUrl((key) => Deno.env.get(key))}/graphql`;
}

export function resolveIsProduction(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  const env = (
    Deno.env.get("ENVIRONMENT") ??
    Deno.env.get("ENV") ??
    "production"
  ).toLowerCase();
  return env === "production" || env === "prod";
}

function resolveCredentials(
  deps: NetCredAuthDeps,
): { username: string; password: string } {
  if (deps.username?.trim() && deps.password?.trim()) {
    return {
      username: deps.username.trim(),
      password: deps.password.trim(),
    };
  }

  try {
    return {
      username: getEnvSecret("NETCRED_USERNAME"),
      password: getEnvSecret("NETCRED_PASSWORD"),
    };
  } catch {
    throw new ProviderAuthError("NETCRED_CREDENTIALS_MISSING");
  }
}

function parseAcquireResult(data: unknown): NetCredTokenAcquireResult {
  const row = data as NetCredTokenAcquireResult | null;
  if (!row?.status) {
    throw new ProviderAuthError("NETCRED_TOKEN_RPC_INVALID_RESPONSE");
  }
  if (
    (row.status === "cached" || row.status === "refreshed") &&
    (!row.token || typeof row.token !== "string")
  ) {
    throw new ProviderAuthError("NETCRED_TOKEN_RPC_MISSING_TOKEN");
  }
  return row;
}

async function callTokenAuth(
  deps: NetCredAuthDeps,
  username: string,
  password: string,
): Promise<{ token: string; sandbox: boolean; refreshExpiresIn?: number }> {
  let httpStatus = 0;

  return withGatewaySpan(
    "tokenAuth",
    "netcred",
    async () => {
      const fetchFn = deps.fetchFn ?? fetch;
      const response = await fetchWithTimeout(
        resolveGraphqlUrl(deps.graphqlUrl),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: TOKEN_AUTH_MUTATION,
            variables: { username, password },
          }),
        },
        { fetchFn },
      );

      httpStatus = response.status;
      const body = (await response.json()) as TokenAuthGraphQLResponse;
      const tokenAuth = body.data?.tokenAuth;
      const gatewayErrors = tokenAuth?.errors ?? body.errors;

      if (!response.ok || gatewayErrors?.length || !tokenAuth?.token) {
        const message = gatewayErrors?.[0]?.message ??
          body.errors?.[0]?.message ??
          `tokenAuth HTTP ${response.status}`;
        throw new ProviderAuthError(message);
      }

      const refreshExpiresIn = tokenAuth.refreshExpiresIn;
      return {
        token: tokenAuth.token,
        sandbox: Boolean(tokenAuth.user?.sandbox),
        refreshExpiresIn:
          typeof refreshExpiresIn === "number" && Number.isFinite(refreshExpiresIn)
            ? refreshExpiresIn
            : undefined,
      };
    },
    () => ({
      http_status: httpStatus,
      outcome: "success",
    }),
  );
}

async function releaseRefreshLock(deps: NetCredAuthDeps): Promise<void> {
  try {
    await deps.supabase.rpc("release_netcred_token_refresh_lock");
  } catch {
    // Best-effort unlock after tokenAuth failure.
  }
}

function truncateAuthMessage(message: string): string {
  return message.length <= AUTH_ERROR_MESSAGE_MAX_LENGTH
    ? message
    : message.slice(0, AUTH_ERROR_MESSAGE_MAX_LENGTH);
}

function resolveAuthErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (STABLE_AUTH_ERROR_CODES.has(message)) return message;
  if (message.includes("NETCRED_TOKEN_REFRESH_WAIT_TIMEOUT")) {
    return "NETCRED_TOKEN_REFRESH_WAIT_TIMEOUT";
  }
  if (message.toLowerCase().includes("invalid credentials")) {
    return "NETCRED_CREDENTIALS_INVALID";
  }
  return "NETCRED_AUTH_FAILURE";
}

function captureAuthFailure(
  deps: NetCredAuthDeps,
  error: unknown,
): void {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const extra = {
    gateway_slug: "netcred",
    error_type: "AUTH_FAILURE",
    error_code: resolveAuthErrorCode(error),
    error: truncateAuthMessage(rawMessage),
  };

  if (deps.captureCritical) {
    deps.captureCritical(CRITICAL_ALERTS.NETCRED_AUTH_FAILURE, extra);
    return;
  }

  captureNetcredAuthFailureCritical(error, extra);
}

function captureSandboxFailure(deps: NetCredAuthDeps): void {
  const extra = {
    gateway_slug: "netcred",
    error_type: "SANDBOX_CREDENTIALS",
  };

  if (deps.captureCritical) {
    deps.captureCritical(CRITICAL_ALERTS.SANDBOX_CREDENTIALS_IN_PRODUCTION, extra);
    return;
  }

  captureSandboxCredentialsCritical(extra);
}

/**
 * Refreshes the NetCred platform JWT when within 60 minutes of expiry.
 * Uses acquire_or_refresh_netcred_token RPC for FOR UPDATE + advisory lock serialization.
 */
export async function refreshAuthToken(deps: NetCredAuthDeps): Promise<string> {
  const { data, error } = await deps.supabase.rpc("acquire_or_refresh_netcred_token");

  if (error) {
    if (error.message.includes("NETCRED_TOKEN_REFRESH_WAIT_TIMEOUT")) {
      throw new NetCredTokenRefreshTimeoutError();
    }
    captureAuthFailure(deps, error);
    throw new ProviderAuthError(error.message);
  }

  const acquired = parseAcquireResult(data);
  if (acquired.status === "cached" || acquired.status === "refreshed") {
    if (resolveIsProduction(deps.isProduction) && acquired.is_sandbox) {
      captureSandboxFailure(deps);
      throw new SandboxCredentialsError();
    }
    return acquired.token!;
  }

  try {
    const credentials = resolveCredentials(deps);
    const auth = await callTokenAuth(deps, credentials.username, credentials.password);

    if (resolveIsProduction(deps.isProduction) && auth.sandbox) {
      captureSandboxFailure(deps);
      await releaseRefreshLock(deps);
      throw new SandboxCredentialsError();
    }

    const ttlMs = auth.refreshExpiresIn
      ? auth.refreshExpiresIn * 1000
      : TOKEN_TTL_MS;
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    const { data: committed, error: commitError } = await deps.supabase.rpc(
      "acquire_or_refresh_netcred_token",
      {
        p_new_token: auth.token,
        p_expires_at: expiresAt,
        p_is_sandbox: auth.sandbox,
      },
    );

    if (commitError) {
      captureAuthFailure(deps, commitError);
      await releaseRefreshLock(deps);
      throw new ProviderAuthError(commitError.message);
    }

    const committedResult = parseAcquireResult(committed);
    return committedResult.token!;
  } catch (error) {
    if (
      error instanceof SandboxCredentialsError ||
      error instanceof ProviderAuthError
    ) {
      if (!(error instanceof SandboxCredentialsError)) {
        captureAuthFailure(deps, error);
      }
      await releaseRefreshLock(deps);
      throw error;
    }

    captureAuthFailure(deps, error);
    await releaseRefreshLock(deps);
    throw new ProviderAuthError(
      error instanceof Error ? error.message : "NETCRED_AUTH_FAILURE",
    );
  }
}

/** Returns a valid NetCred JWT, refreshing when needed. */
export async function getNetCredToken(deps: NetCredAuthDeps): Promise<string> {
  return refreshAuthToken(deps);
}
