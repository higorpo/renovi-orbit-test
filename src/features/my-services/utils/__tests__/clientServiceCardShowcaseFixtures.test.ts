// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { getClientServiceCardPresentation } from "../clientServiceCardPresentation";
import { buildClientServiceCardShowcaseVariants } from "../clientServiceCardShowcaseFixtures";

describe("buildClientServiceCardShowcaseVariants", () => {
  it("includes permanent payment failure with adjust payment CTA", () => {
    const variants = buildClientServiceCardShowcaseVariants(
      new Date("2025-06-08T12:00:00"),
    );
    const failed = variants.find((variant) => variant.id === "in-progress-payment-failed");

    expect(failed).toBeDefined();
    expect(failed?.label).toBe("Pagamento falhou");
    expect(failed?.group).toBe("Em andamento");

    const presentation = getClientServiceCardPresentation(failed!.model);
    expect(presentation.highlight.title).toBe("Pagamento falhou");
    expect(presentation.highlight.emphasis).toBe("error");
    expect(presentation.primaryAction).toMatchObject({
      label: "Ajustar pagamento",
      intent: "adjust_payment",
    });
  });

  it("includes multi-chat unread, today and cancelled variants", () => {
    const variants = buildClientServiceCardShowcaseVariants(
      new Date("2025-06-08T12:00:00"),
    );

    const unreadMulti = variants.find((variant) => variant.id === "negotiation-unread-multi");
    expect(unreadMulti?.group).toBe("Negociação");
    expect(getClientServiceCardPresentation(unreadMulti!.model).primaryAction.intent).toBe(
      "messages",
    );

    const today = variants.find((variant) => variant.id === "in-progress-today");
    expect(today?.group).toBe("Em andamento");
    expect(today?.model.contracted?.scheduledStartDate).toBe("2025-06-08");

    const awaitingProvider = variants.find(
      (variant) => variant.id === "in-progress-awaiting-provider",
    );
    expect(getClientServiceCardPresentation(awaitingProvider!.model)).toMatchObject({
      highlight: { title: "Aguardando conclusão do prestador" },
      primaryAction: { intent: "details" },
    });

    const evaluate = variants.find((variant) => variant.id === "in-progress-evaluate");
    expect(getClientServiceCardPresentation(evaluate!.model)).toMatchObject({
      highlight: { title: "Aceite a conclusão e avalie o serviço" },
      primaryAction: { label: "Avaliar serviço", intent: "evaluate_service" },
      secondaryAction: { label: "Ver detalhes", intent: "details" },
    });

    const cancelled = variants.find((variant) => variant.id === "cancelled");
    expect(cancelled?.group).toBe("Cancelados");
    expect(getClientServiceCardPresentation(cancelled!.model).highlight.emphasis).toBe(
      "cancelled",
    );
  });

  it("covers every showcase group with a unique variant id", () => {
    const variants = buildClientServiceCardShowcaseVariants(
      new Date("2025-06-08T12:00:00"),
    );
    const ids = variants.map((variant) => variant.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        "negotiation-unread-multi",
        "negotiation-pending-multi",
        "negotiation-proposals-only",
        "negotiation-chats-only",
        "negotiation-waiting",
        "in-progress-today",
        "in-progress-payment",
        "in-progress-payment-failed",
        "in-progress-awaiting-provider",
        "in-progress-evaluate",
        "completed",
        "cancelled",
      ]),
    );

    expect(variants.some((variant) => variant.group === "Concluídos")).toBe(true);
    expect(
      getClientServiceCardPresentation(
        variants.find((variant) => variant.id === "completed")!.model,
      ).highlight,
    ).toBeNull();

    const payment = variants.find((variant) => variant.id === "in-progress-payment");
    expect(payment?.model.contracted?.paymentScheduleState).toBe("SCHEDULED");
    expect(
      getClientServiceCardPresentation(payment!.model).highlight.title,
    ).toMatch(/pagamento/i);
  });
});
