import { describe, expect, it } from "vitest";
import {
  formatManualPaymentFailureMessage,
  isTerminalManualChargeOutcome,
} from "../manualPaymentErrors";

describe("formatManualPaymentFailureMessage", () => {
  it("ignores raw failureReason and maps by failure code", () => {
    expect(formatManualPaymentFailureMessage("  Cartão bloqueado  ", "CARD_DECLINED")).toContain(
      "recusado",
    );
    expect(formatManualPaymentFailureMessage("gateway dump", "REJECTED")).toContain("recusado");
  });

  it("maps known failure codes when reason is empty", () => {
    expect(formatManualPaymentFailureMessage(null, "CARD_DECLINED")).toContain("recusado");
    expect(formatManualPaymentFailureMessage("   ", "INSUFFICIENT_FUNDS")).toContain(
      "Saldo insuficiente",
    );
  });

  it("returns default message for unknown codes without leaking reason", () => {
    expect(formatManualPaymentFailureMessage("raw reason", "OTHER")).toContain(
      "Não foi possível concluir o pagamento",
    );
    expect(formatManualPaymentFailureMessage(null, null)).toContain(
      "Não foi possível concluir o pagamento",
    );
  });
});

describe("isTerminalManualChargeOutcome", () => {
  it("returns true only for terminal failure outcomes", () => {
    expect(isTerminalManualChargeOutcome("FAILED")).toBe(true);
    expect(isTerminalManualChargeOutcome("FAILED_PERMANENT")).toBe(true);
    expect(isTerminalManualChargeOutcome("PAID")).toBe(false);
    expect(isTerminalManualChargeOutcome("PENDING")).toBe(false);
  });
});
