// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { ServiceModel } from "@/features/view-services";
import { getPendingPaymentHighlightContent } from "../pendingPaymentHighlight";

type Contracted = NonNullable<ServiceModel["contracted"]>;

function contracted(overrides: Partial<Contracted> = {}): Contracted {
  return {
    id: "cs-1",
    status: "PENDING_PAYMENT",
    agreedSlot: null,
    durationUnit: "hours",
    durationValue: 2,
    scheduledStartDate: "2025-06-15",
    scheduledEndDate: null,
    scheduledShift: "morning",
    provider: null,
    chatId: null,
    updatedAt: null,
    paymentScheduleState: "SCHEDULED",
    ...overrides,
  };
}

describe("getPendingPaymentHighlightContent", () => {
  it("builds client title and scheduled detail", () => {
    const result = getPendingPaymentHighlightContent(contracted(), "client");

    expect(result.title).toBe("Aguardando pagamento");
    expect(result.detail).toBe(
      "Serviço agendado para 15/06/2025, pagamento ainda pendente.",
    );
    expect(result.emphasis).toBe("attention");
  });

  it("adds do cliente for provider audience", () => {
    const result = getPendingPaymentHighlightContent(contracted(), "provider");

    expect(result.title).toBe("Aguardando pagamento do cliente");
    expect(result.detail).toBe(
      "Serviço agendado para 15/06/2025, pagamento ainda pendente.",
    );
    expect(result.emphasis).toBe("attention");
  });

  it("falls back when schedule date is missing", () => {
    const result = getPendingPaymentHighlightContent(
      contracted({ scheduledStartDate: "" }),
      "client",
    );

    expect(result.detail).toBe("Pagamento ainda pendente.");
  });

  it("shows permanent failure alert for client when schedule is FAILED_PERMANENT", () => {
    const result = getPendingPaymentHighlightContent(
      contracted({ paymentScheduleState: "FAILED_PERMANENT" }),
      "client",
    );

    expect(result.title).toBe("Pagamento falhou");
    expect(result.detail).toBe(
      "Atualize suas informações de pagamento manualmente para confirmar o serviço.",
    );
    expect(result.emphasis).toBe("error");
  });

  it("keeps provider pending copy even when schedule is FAILED_PERMANENT", () => {
    const result = getPendingPaymentHighlightContent(
      contracted({ paymentScheduleState: "FAILED_PERMANENT" }),
      "provider",
    );

    expect(result.title).toBe("Aguardando pagamento do cliente");
    expect(result.detail).toBe(
      "Serviço agendado para 15/06/2025, pagamento ainda pendente.",
    );
    expect(result.emphasis).toBe("attention");
  });
});
