// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { getProviderServiceCardPresentation } from "../providerServiceCardPresentation";
import { buildProviderServiceCardShowcaseVariants } from "../providerServiceCardShowcaseFixtures";

describe("buildProviderServiceCardShowcaseVariants", () => {
  it("builds grouped showcase variants with expected negotiation cases", () => {
    const variants = buildProviderServiceCardShowcaseVariants(
      new Date("2025-06-08T12:00:00"),
    );

    expect(variants.length).toBeGreaterThan(5);
    expect(variants.every((variant) => variant.model.id)).toBe(true);

    const unread = variants.find((variant) => variant.id === "negotiation-unread");
    expect(unread?.group).toBe("Negociação");
    expect(unread?.label).toBe("Nova mensagem recebida");

    const presentation = getProviderServiceCardPresentation(unread!.model);
    expect(presentation.highlight.icon).toBe("new_message");
    expect(presentation.primaryAction.intent).toBe("chat");
  });

  it("includes a revision-requested negotiation variant", () => {
    const variants = buildProviderServiceCardShowcaseVariants(
      new Date("2025-06-08T12:00:00"),
    );
    const revision = variants.find((variant) => variant.id === "negotiation-revision");

    expect(revision).toBeDefined();
    const presentation = getProviderServiceCardPresentation(revision!.model);
    expect(presentation.primaryAction).toMatchObject({
      label: "Revisar proposta",
      intent: "revise_proposal",
    });
  });

  it("includes today, payment-pending and cancelled contract variants", () => {
    const now = new Date("2025-06-08T12:00:00");
    const variants = buildProviderServiceCardShowcaseVariants(now);

    const today = variants.find((variant) => variant.id === "in-progress-today");
    expect(today?.group).toBe("Em andamento");
    expect(today?.model.contracted?.scheduledStartDate).toBe("2025-06-08");

    const payment = variants.find((variant) => variant.id === "in-progress-payment");
    expect(payment?.model.contracted?.status).toBe("PENDING_PAYMENT");
    expect(getProviderServiceCardPresentation(payment!.model).highlight.icon).toBe(
      "payment_pending",
    );

    const cancelled = variants.find((variant) => variant.id === "cancelled-contract");
    expect(cancelled?.group).toBe("Cancelados");
    expect(cancelled?.model.contracted?.status).toBe("CANCELLED");
  });

  it("covers negotiation, completed and cancelled showcase ids", () => {
    const variants = buildProviderServiceCardShowcaseVariants(
      new Date("2025-06-08T12:00:00"),
    );
    const ids = variants.map((variant) => variant.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        "negotiation-unread",
        "negotiation-revision",
        "negotiation-pending",
        "negotiation-pending-expiring",
        "negotiation-active",
        "negotiation-start-chat",
        "negotiation-no-proposal",
        "in-progress-scheduled",
        "in-progress-scheduled-future",
        "in-progress-today",
        "in-progress-unread",
        "in-progress-payment",
        "completed",
        "cancelled-request",
        "cancelled-proposal-rejected",
        "cancelled-contract",
      ]),
    );

    const completed = variants.find((variant) => variant.id === "completed");
    expect(completed?.group).toBe("Concluídos");
    expect(completed?.model.contracted?.status).toBe("COMPLETED");

    const startChat = variants.find((variant) => variant.id === "negotiation-start-chat");
    expect(startChat?.model.chatSummary).toBeNull();
    expect(
      getProviderServiceCardPresentation(startChat!.model).primaryAction.disabled,
    ).toBe(true);

    const rejected = variants.find((variant) => variant.id === "cancelled-proposal-rejected");
    expect(rejected?.model.myProposal?.status).toMatch(/REJECTED/);
  });
});
