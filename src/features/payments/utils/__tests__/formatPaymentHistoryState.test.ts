import { describe, expect, it } from "vitest";
import {
  formatPaymentHistoryDate,
  formatPaymentHistoryState,
} from "../formatPaymentHistoryState";

describe("formatPaymentHistoryState", () => {
  it("maps known states to PT-BR labels and passthrough unknown", () => {
    expect(formatPaymentHistoryState("PAID")).toBe("Pago");
    expect(formatPaymentHistoryState("REFUNDED")).toBe("Reembolsado");
    expect(formatPaymentHistoryState("PARTIALLY_REFUNDED")).toBe("Reembolso parcial");
    expect(formatPaymentHistoryState("REFUND_REQUESTED")).toBe(
      "Reembolso solicitado / em processamento",
    );
    expect(formatPaymentHistoryState("CUSTOM")).toBe("CUSTOM");
  });

  it("formats dates in pt-BR and keeps invalid values", () => {
    expect(formatPaymentHistoryDate("2026-06-26T12:00:00.000Z")).toMatch(/2026/);
    expect(formatPaymentHistoryDate("not-a-date")).toBe("not-a-date");
  });
});
