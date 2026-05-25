/**
 * FCM HTTP v1 client — one request per delivery row (design §4.4, task 59).
 */

import * as jose from "jose";
import {
  fetchWithTimeout,
  PROVIDER_HTTP_TIMEOUT_MS,
} from "../_shared/providerHttp.ts";

export const FCM_HTTP_TIMEOUT_MS = PROVIDER_HTTP_TIMEOUT_MS;
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

export class FcmConfigError extends Error {
  readonly code = "fcm_config_missing";

  constructor(message: string) {
    super(message);
    this.name = "FcmConfigError";
  }
}

export interface FcmServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface SendFcmPushInput {
  /** Immutable token from checkout payload — never read live beacons. */
  fcmTokenSnapshot: string;
  title: string;
  body: string;
  correlationId: string;
  deliveryId: string;
}

export type FcmSendSuccess = {
  ok: true;
  vendorMessageId: string;
  httpStatus: number;
};

export type FcmSendFailure = {
  ok: false;
  httpStatus: number;
  errorCode: string;
  errorMessage: string;
};

export type FcmSendResult = FcmSendSuccess | FcmSendFailure;

export interface FcmV1MessageBody {
  message: {
    token: string;
    notification: { title: string; body: string };
    android: { notification: { tag: string } };
    apns: { headers: { "apns-collapse-id": string } };
  };
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export function parseFcmServiceAccount(raw?: string): FcmServiceAccount {
  const json = raw ?? Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!json?.trim()) {
    throw new FcmConfigError("FCM_SERVICE_ACCOUNT is required");
  }
  const parsed = JSON.parse(json) as FcmServiceAccount;
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new FcmConfigError("FCM_SERVICE_ACCOUNT JSON is incomplete");
  }
  return parsed;
}

export function buildFcmV1MessageBody(input: SendFcmPushInput): FcmV1MessageBody {
  const token = input.fcmTokenSnapshot.trim();
  if (!token) {
    throw new Error("fcm_token_snapshot is required");
  }

  return {
    message: {
      token,
      notification: {
        title: input.title,
        body: input.body,
      },
      android: {
        notification: {
          tag: input.correlationId,
        },
      },
      apns: {
        headers: {
          "apns-collapse-id": input.correlationId,
        },
      },
    },
  };
}

export function fcmSendUrl(projectId: string): string {
  return `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
}

export async function getFcmAccessToken(
  serviceAccount: FcmServiceAccount,
  options?: { fetchFn?: typeof fetch },
): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60_000) {
    return cachedAccessToken.token;
  }

  const privateKey = await jose.importPKCS8(
    serviceAccount.private_key.replace(/\\n/g, "\n"),
    "RS256",
  );

  const assertion = await new jose.SignJWT({ scope: FCM_SCOPE })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(serviceAccount.client_email)
    .setAudience(OAUTH_TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const fetchFn = options?.fetchFn ?? fetch;
  const response = await fetchWithTimeout(
    OAUTH_TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    },
    { timeoutMs: FCM_HTTP_TIMEOUT_MS, fetchFn },
  );

  const data = await response.json() as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new FcmConfigError(data.error ?? "FCM OAuth token request failed");
  }

  const expiresInMs = (data.expires_in ?? 3600) * 1000;
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: now + expiresInMs,
  };

  return data.access_token;
}

/** Clears OAuth cache (tests only). */
export function resetFcmAccessTokenCache(): void {
  cachedAccessToken = null;
}

export async function sendFcmPush(
  input: SendFcmPushInput,
  options?: {
    fetchFn?: typeof fetch;
    timeoutMs?: number;
    serviceAccount?: FcmServiceAccount;
    /** Test hook: skip OAuth when set. */
    accessToken?: string;
  },
): Promise<FcmSendResult> {
  const serviceAccount = options?.serviceAccount ?? parseFcmServiceAccount();
  const fetchFn = options?.fetchFn ?? fetch;
  const timeoutMs = options?.timeoutMs ?? FCM_HTTP_TIMEOUT_MS;

  try {
    const accessToken = options?.accessToken ??
      await getFcmAccessToken(serviceAccount, { fetchFn });
    const body = buildFcmV1MessageBody(input);

    const response = await fetchWithTimeout(
      fcmSendUrl(serviceAccount.project_id),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      { timeoutMs, fetchFn },
    );

    const httpStatus = response.status;
    const payload = await response.json() as {
      name?: string;
      error?: { message?: string; status?: string };
    };

    if (response.ok && payload.name) {
      return { ok: true, vendorMessageId: payload.name, httpStatus };
    }

    return {
      ok: false,
      httpStatus,
      errorCode: payload.error?.status ?? "fcm_send_failed",
      errorMessage: payload.error?.message ?? `FCM HTTP ${httpStatus}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "fcm_request_failed";
    return {
      ok: false,
      httpStatus: 0,
      errorCode: err instanceof DOMException && err.name === "AbortError"
        ? "fcm_timeout"
        : "fcm_request_failed",
      errorMessage: message,
    };
  }
}
