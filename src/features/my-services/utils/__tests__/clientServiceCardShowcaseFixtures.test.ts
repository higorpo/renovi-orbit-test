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
});
