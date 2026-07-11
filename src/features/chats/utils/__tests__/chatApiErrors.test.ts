import { describe, expect, it } from "vitest";
import { CNS_BUSINESS_ERROR_CODES } from "../../types/chats.types";
import { mapCnsRpcError } from "../chatApiErrors";

describe("mapCnsRpcError", () => {
  it("maps known code from message", () => {
    const error = mapCnsRpcError({ message: "NO_ACTIVE_SLOT" });
    expect(error.code).toBe("NO_ACTIVE_SLOT");
    expect(error.message).toContain("Limite");
  });

  it("reads retry_after_seconds from detail JSON", () => {
    const error = mapCnsRpcError({
      message: "RATE_LIMITED",
      details: '{"retry_after_seconds":15}',
    });
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryAfterSeconds).toBe(15);
  });

  it("parses retry_after_seconds when provided as a string", () => {
    const error = mapCnsRpcError({
      message: "RATE_LIMITED",
      details: '{"retry_after_seconds":"8"}',
    });
    expect(error.retryAfterSeconds).toBe(8);
  });

  it("extracts business code from details when message is generic", () => {
    const error = mapCnsRpcError({
      message: "rpc failed",
      details: '{"code":"PROPOSAL_EXPIRED"}',
    });
    expect(error.code).toBe("PROPOSAL_EXPIRED");
    expect(error.message).toContain("expirou");
  });

  it("finds embedded business codes inside longer messages", () => {
    const error = mapCnsRpcError({
      message: "Postgres exception: CONVERSATION_CLOSED while sending",
    });
    expect(error.code).toBe("CONVERSATION_CLOSED");
  });

  it("returns UNKNOWN with original message when code is unrecognized", () => {
    const error = mapCnsRpcError({ message: "something broke" });
    expect(error.code).toBe("UNKNOWN");
    expect(error.message).toBe("something broke");
    expect(error.retryAfterSeconds).toBeUndefined();
  });

  it("falls back to a generic UNKNOWN message when message is empty", () => {
    const error = mapCnsRpcError({ message: "" });
    expect(error.code).toBe("UNKNOWN");
    expect(error.message).toBe("Não foi possível concluir a operação.");
  });

  it("ignores invalid or non-object detail payloads", () => {
    expect(mapCnsRpcError({ message: "NO_ACTIVE_SLOT", details: "not-json" }).code).toBe(
      "NO_ACTIVE_SLOT",
    );
    expect(
      mapCnsRpcError({ message: "NO_ACTIVE_SLOT", details: '["array"]' }).retryAfterSeconds,
    ).toBeUndefined();
    expect(
      mapCnsRpcError({
        message: "RATE_LIMITED",
        details: '{"retry_after_seconds":"NaN"}',
      }).retryAfterSeconds,
    ).toBeUndefined();
  });

  it("maps every known business error code to a PT-BR UI message", () => {
    for (const code of CNS_BUSINESS_ERROR_CODES) {
      const error = mapCnsRpcError({ message: code });
      expect(error.code).toBe(code);
      expect(error.message.length).toBeGreaterThan(0);
      expect(error.message).not.toBe(code);
    }
  });
});
