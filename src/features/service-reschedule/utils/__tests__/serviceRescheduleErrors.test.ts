import { describe, expect, it } from "vitest";
import { mapServiceRescheduleRpcError } from "../serviceRescheduleErrors";

describe("mapServiceRescheduleRpcError", () => {
  it("maps known business codes from the error message to UI copy", () => {
    const result = mapServiceRescheduleRpcError({
      message: "ACTIVE_RESCHEDULE_EXISTS",
    });

    expect(result).toEqual({
      code: "ACTIVE_RESCHEDULE_EXISTS",
      message: "Já existe uma solicitação de reagendamento em andamento.",
    });
  });

  it("extracts code from JSON details when message is not a code", () => {
    const result = mapServiceRescheduleRpcError({
      message: "rpc failed",
      details: JSON.stringify({ code: "FORBIDDEN" }),
    });

    expect(result.code).toBe("FORBIDDEN");
    expect(result.message).toBe("Você não tem permissão para esta ação.");
  });

  it("finds embedded business codes inside free-form messages", () => {
    const result = mapServiceRescheduleRpcError({
      message: "Error: CLIENT_RESCHEDULE_WINDOW_CLOSED while requesting",
    });

    expect(result.code).toBe("CLIENT_RESCHEDULE_WINDOW_CLOSED");
    expect(result.message).toContain("prazo");
  });

  it("returns UNKNOWN with original message when no code matches", () => {
    const result = mapServiceRescheduleRpcError({
      message: "something unexpected",
    });

    expect(result).toEqual({
      code: "UNKNOWN",
      message: "something unexpected",
    });
  });

  it("falls back to default UNKNOWN message when message is empty", () => {
    const result = mapServiceRescheduleRpcError({ message: "" });

    expect(result.code).toBe("UNKNOWN");
    expect(result.message).toBe("Não foi possível concluir o reagendamento.");
  });

  it("parses retry_after_seconds from details as number or numeric string", () => {
    expect(
      mapServiceRescheduleRpcError({
        message: "OFFLINE",
        details: JSON.stringify({ code: "OFFLINE", retry_after_seconds: 15 }),
      }).retryAfterSeconds,
    ).toBe(15);

    expect(
      mapServiceRescheduleRpcError({
        message: "OFFLINE",
        details: JSON.stringify({ retry_after_seconds: "30" }),
      }).retryAfterSeconds,
    ).toBe(30);
  });

  it("ignores non-object or invalid JSON details", () => {
    expect(
      mapServiceRescheduleRpcError({
        message: "FORBIDDEN",
        details: "not-json",
      }).code,
    ).toBe("FORBIDDEN");

    expect(
      mapServiceRescheduleRpcError({
        message: "unknown",
        details: JSON.stringify(["array"]),
      }).code,
    ).toBe("UNKNOWN");
  });
});
