import { describe, expect, it } from "vitest";
import {
  mapPaymentErrorToUserMessage,
  mapPaymentUserMessage,
} from "../mapPaymentUserMessage";

describe("mapPaymentUserMessage", () => {
  it("maps known codes to friendly PT-BR messages", () => {
    expect(mapPaymentUserMessage("REJECTED")).toContain("recusado");
    expect(mapPaymentUserMessage("RATE_LIMIT_EXCEEDED")).toContain("Muitas tentativas");
    expect(mapPaymentUserMessage("CPF_INVALID")).toContain("CPF");
    expect(mapPaymentUserMessage("RISK_ANALYSIS_NO_CONTACT")).toContain(
      "análise de segurança",
    );
    expect(mapPaymentUserMessage("RISK_ANALYSIS_FRAUD_SUSPICION")).toContain(
      "análise de segurança",
    );
  });

  it("never returns raw unknown backend text", () => {
    expect(mapPaymentUserMessage("Some gateway dump xyz")).toBe(
      "Não foi possível concluir a operação. Tente novamente.",
    );
    expect(mapPaymentUserMessage("timeout")).not.toBe("timeout");
  });

  it("uses custom fallback when provided", () => {
    expect(mapPaymentUserMessage(null, { fallback: "Fallback customizado" })).toBe(
      "Fallback customizado",
    );
  });

  it("matches case-insensitively for known codes", () => {
    expect(mapPaymentUserMessage("rejected")).toContain("recusado");
  });
});

describe("mapPaymentErrorToUserMessage", () => {
  it("prefers errorCode over message", () => {
    const error = Object.assign(new Error("raw backend"), { errorCode: "CARD_DECLINED" });
    expect(mapPaymentErrorToUserMessage(error)).toContain("recusado");
  });

  it("maps Error.message when it is a known code", () => {
    expect(mapPaymentErrorToUserMessage(new Error("PAYMENT_TOKEN_INACTIVE"))).toContain(
      "não está mais disponível",
    );
  });

  it("preserves messages already mapped by the API layer", () => {
    const friendly =
      "Seu cartão foi recusado. Tente outro cartão ou entre em contato com o emissor.";
    expect(mapPaymentUserMessage(friendly)).toBe(friendly);
    expect(mapPaymentErrorToUserMessage(new Error(friendly))).toBe(friendly);
  });

  it("hides unknown prose from the backend", () => {
    expect(mapPaymentErrorToUserMessage(new Error("Card declined by issuer XYZ"))).toBe(
      "Não foi possível concluir a operação. Tente novamente.",
    );
  });
});
