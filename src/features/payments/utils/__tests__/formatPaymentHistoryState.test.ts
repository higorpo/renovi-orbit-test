import { describe, expect, it } from "vitest";
import {
  formatPaymentHistoryDate,
  formatPaymentHistoryState,
} from "../formatPaymentHistoryState";

describe("formatPaymentHistoryState", () => {
  it("maps known states to PT-BR labels", () => {
    expect(formatPaymentHistoryState("PAID")).toBe("Pago");
    expect(formatPaymentHistoryState("REFUNDED")).toBe("Reembolsado");
  });

  it("formats dates in pt-BR", () => {
    expect(formatPaymentHistoryDate("2026-06-26T12:00:00.000Z")).toMatch(/2026/);
  });
});
