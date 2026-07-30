import { beforeEach, describe, expect, it, vi } from "vitest";
import { FunctionsHttpError } from "@supabase/supabase-js";
import {
  invokeProviderKycEdgeFunction,
  invokeProviderKycRpc,
  mapEdgeErrorPayload,
  providerKycApiErrorToMessage,
} from "../providerKycApiClient";
import { PROVIDER_KYC_EDGE, PROVIDER_KYC_RPC } from "../providerKyc.rpc";
import { logger } from "@/lib/logger";
import { metrics } from "@/lib/sentry";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

const { supabase } = await import("@/lib/supabase/client");
const invokeMock = vi.mocked(supabase.functions.invoke);
const rpcMock = vi.mocked(supabase.rpc);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("invokeProviderKycRpc", () => {
  it("returns validated data on success", async () => {
    rpcMock.mockResolvedValue({
      data: { upload_session_id: "s-1", storage_path_prefix: "prefix/" },
      error: null,
    });

    const result = await invokeProviderKycRpc(
      PROVIDER_KYC_RPC.createUploadSession,
      { p_document_key: "identity" },
      (value): value is Record<string, unknown> =>
        value !== null && typeof value === "object",
      "invalid_upload_session",
    );

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      upload_session_id: "s-1",
      storage_path_prefix: "prefix/",
    });
  });

  it("maps RPC errors preferring JSON detail code", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: "raw",
        details: '{"code":"KYC_ALREADY_SUBMITTED"}',
        code: "P0001",
      },
    });

    const result = await invokeProviderKycRpc(
      PROVIDER_KYC_RPC.submitProviderKyc,
      {},
      (value): value is Record<string, unknown> =>
        value !== null && typeof value === "object",
      "invalid",
    );

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("KYC_ALREADY_SUBMITTED");
    expect(result.error?.message).toMatch(/Não foi possível/);
    expect(logger.error).toHaveBeenCalledWith(
      "provider_kyc_api_error",
      expect.objectContaining({
        source: PROVIDER_KYC_RPC.submitProviderKyc,
        code: "KYC_ALREADY_SUBMITTED",
      }),
    );
    expect(metrics.count).toHaveBeenCalledWith("provider_kyc.api_error", 1, {
      source: PROVIDER_KYC_RPC.submitProviderKyc,
      code: "KYC_ALREADY_SUBMITTED",
    });
  });

  it("falls back to error.code when details are not a JSON object", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: "boom",
        details: "not-json",
        code: "22P02",
      },
    });

    const result = await invokeProviderKycRpc(
      PROVIDER_KYC_RPC.registerUploadPath,
      {},
      (value): value is Record<string, unknown> =>
        value !== null && typeof value === "object",
      "invalid",
    );

    expect(result.error?.code).toBe("22P02");
  });

  it("ignores non-object JSON details and uses message when code is missing", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        message: "FALLBACK_MSG",
        details: '["array"]',
      },
    });

    const result = await invokeProviderKycRpc(
      PROVIDER_KYC_RPC.submitProviderKyc,
      {},
      (value): value is Record<string, unknown> =>
        value !== null && typeof value === "object",
      "invalid",
    );

    expect(result.error?.code).toBe("FALLBACK_MSG");
  });

  it("returns INVALID_RESPONSE when validator rejects payload", async () => {
    rpcMock.mockResolvedValue({
      data: "not-an-object",
      error: null,
    });

    const result = await invokeProviderKycRpc(
      PROVIDER_KYC_RPC.createUploadSession,
      {},
      (value): value is Record<string, unknown> =>
        value !== null && typeof value === "object",
      "invalid_upload_session",
    );

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe("INVALID_RESPONSE");
    expect(logger.error).toHaveBeenCalledWith(
      "invalid_upload_session",
      expect.objectContaining({ rpc: PROVIDER_KYC_RPC.createUploadSession }),
    );
  });
});

describe("invokeProviderKycEdgeFunction", () => {
  it("returns payload on success", async () => {
    invokeMock.mockResolvedValue({
      data: { submission_id: "sub-1", email_dispatched: true },
      error: null,
    });

    const result = await invokeProviderKycEdgeFunction(
      PROVIDER_KYC_EDGE.dispatchKycEmail,
      { retry_only: true },
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.payload.submission_id).toBe("sub-1");
    expect(invokeMock).toHaveBeenCalledWith(PROVIDER_KYC_EDGE.dispatchKycEmail, {
      body: { retry_only: true },
    });
  });

  it("invokes without body when omitted", async () => {
    invokeMock.mockResolvedValue({
      data: { ok: true },
      error: null,
    });

    await invokeProviderKycEdgeFunction(PROVIDER_KYC_EDGE.dispatchKycEmail);

    expect(invokeMock).toHaveBeenCalledWith(PROVIDER_KYC_EDGE.dispatchKycEmail, {});
  });

  it("parses FunctionsHttpError body", async () => {
    const response = new Response(
      JSON.stringify({ error_code: "INVALID_DOCUMENT", field: "document" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
    const httpError = new FunctionsHttpError(
      "Edge Function returned a non-2xx status code",
    );
    Object.defineProperty(httpError, "context", { value: response });

    invokeMock.mockResolvedValue({ data: null, error: httpError });

    const result = await invokeProviderKycEdgeFunction(
      PROVIDER_KYC_EDGE.dispatchKycEmail,
      {},
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.payload.error_code).toBe("INVALID_DOCUMENT");
  });

  it("falls back when FunctionsHttpError body cannot be parsed", async () => {
    const response = {
      status: 502,
      json: vi.fn().mockRejectedValue(new Error("bad json")),
    };
    const httpError = new FunctionsHttpError(
      "Edge Function returned a non-2xx status code",
    );
    Object.defineProperty(httpError, "context", { value: response });

    invokeMock.mockResolvedValue({ data: null, error: httpError });

    const result = await invokeProviderKycEdgeFunction(
      PROVIDER_KYC_EDGE.dispatchKycEmail,
      {},
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
    expect(result.payload).toEqual({});
  });

  it("handles FunctionsHttpError without context", async () => {
    const httpError = new FunctionsHttpError(
      "Edge Function returned a non-2xx status code",
    );
    Object.defineProperty(httpError, "context", { value: undefined });

    invokeMock.mockResolvedValue({ data: null, error: httpError });

    const result = await invokeProviderKycEdgeFunction(
      PROVIDER_KYC_EDGE.dispatchKycEmail,
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
  });

  it("maps generic invoke errors", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: "network down" },
    });

    const result = await invokeProviderKycEdgeFunction(
      PROVIDER_KYC_EDGE.dispatchKycEmail,
      {},
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.payload.error).toBe("network down");
  });

  it("treats 200 responses with error field as failure", async () => {
    invokeMock.mockResolvedValue({
      data: { error: "validation failed" },
      error: null,
    });

    const result = await invokeProviderKycEdgeFunction(
      PROVIDER_KYC_EDGE.dispatchKycEmail,
      {},
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.payload.error).toBe("validation failed");
  });

  it("treats 200 responses with error_code as failure", async () => {
    invokeMock.mockResolvedValue({
      data: { error_code: "RATE_LIMIT" },
      error: null,
    });

    const result = await invokeProviderKycEdgeFunction(
      PROVIDER_KYC_EDGE.dispatchKycEmail,
      {},
    );

    expect(result.ok).toBe(false);
    expect(result.payload.error_code).toBe("RATE_LIMIT");
  });

  it("maps array payloads to empty records", async () => {
    invokeMock.mockResolvedValue({
      data: [1, 2, 3],
      error: null,
    });

    const result = await invokeProviderKycEdgeFunction(
      PROVIDER_KYC_EDGE.dispatchKycEmail,
      {},
    );

    expect(result.ok).toBe(true);
    expect(result.payload).toEqual({});
  });
});

describe("mapEdgeErrorPayload / providerKycApiErrorToMessage", () => {
  it("maps edge payload fields preferring error_code", () => {
    expect(
      mapEdgeErrorPayload(
        { error_code: "INVALID_DOCUMENT", error: "ignored", field: "document" },
        "fallback",
      ),
    ).toEqual({
      message: "INVALID_DOCUMENT",
      errorCode: "INVALID_DOCUMENT",
      field: "document",
    });

    expect(mapEdgeErrorPayload({ error: "boom" }, "fallback")).toEqual({
      message: "boom",
      errorCode: undefined,
      field: undefined,
    });

    expect(mapEdgeErrorPayload({}, "fallback")).toEqual({
      message: "fallback",
      errorCode: undefined,
      field: undefined,
    });
  });

  it("converts API errors to user messages", () => {
    expect(providerKycApiErrorToMessage(null)).toBeNull();
    expect(
      providerKycApiErrorToMessage({ code: "X", message: "falhou" }),
    ).toBe("falhou");
  });
});
