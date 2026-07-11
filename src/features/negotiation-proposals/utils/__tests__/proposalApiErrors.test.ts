import { describe, expect, it } from "vitest";
import { mapProposalRpcError } from "../proposalApiErrors";

describe("mapProposalRpcError", () => {
  it("maps a direct business error code to its user-facing message", () => {
    expect(mapProposalRpcError({ message: "PROPOSAL_EXPIRED" })).toEqual({
      code: "PROPOSAL_EXPIRED",
      message: "Esta proposta expirou.",
    });
  });

  it("uses a business error code from JSON details", () => {
    expect(
      mapProposalRpcError({
        message: "RPC failed",
        details: JSON.stringify({ code: "PAYMENT_FIELDS_REQUIRED" }),
      }),
    ).toEqual({
      code: "PAYMENT_FIELDS_REQUIRED",
      message: "Complete os dados de pagamento antes de confirmar.",
    });
  });

  it("extracts a business code embedded in the backend message", () => {
    expect(
      mapProposalRpcError({
        message: "request_proposal_revision failed: REVISION_LIMIT_EXCEEDED",
      }),
    ).toEqual({
      code: "REVISION_LIMIT_EXCEEDED",
      message: "Limite de revisões de proposta atingido.",
    });
  });

  it.each([
    [15, 15],
    ["30", 30],
  ])("normalizes retry_after_seconds value %j", (retryValue, expected) => {
    expect(
      mapProposalRpcError({
        message: "RATE_LIMITED",
        details: JSON.stringify({ retry_after_seconds: retryValue }),
      }),
    ).toEqual({
      code: "RATE_LIMITED",
      message: "Muitas ações em pouco tempo. Aguarde um instante.",
      retryAfterSeconds: expected,
    });
  });

  it("preserves an unknown backend message and ignores malformed details", () => {
    expect(
      mapProposalRpcError({
        message: "Database connection failed",
        details: "{invalid-json",
      }),
    ).toEqual({
      code: "UNKNOWN",
      message: "Database connection failed",
    });
  });

  it("uses a generic fallback when an unknown backend message is empty", () => {
    expect(mapProposalRpcError({ message: "" })).toEqual({
      code: "UNKNOWN",
      message: "Não foi possível concluir a operação.",
    });
  });
});
