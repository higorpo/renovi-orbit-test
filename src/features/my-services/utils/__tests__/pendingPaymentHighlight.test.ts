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
  });

  it("adds do cliente for provider audience", () => {
    const result = getPendingPaymentHighlightContent(contracted(), "provider");

    expect(result.title).toBe("Aguardando pagamento do cliente");
    expect(result.detail).toBe(
      "Serviço agendado para 15/06/2025, pagamento ainda pendente.",
    );
  });

  it("falls back when schedule date is missing", () => {
    const result = getPendingPaymentHighlightContent(
      contracted({ scheduledStartDate: "" }),
      "client",
    );

    expect(result.detail).toBe("Pagamento ainda pendente.");
  });
});
