import { describe, expect, it } from "vitest";
import { formatPostChargeCancelSuccessMessage } from "../formatPostChargeCancelSuccessMessage";

describe("formatPostChargeCancelSuccessMessage", () => {
  it("defaults to 30 a 60 days when expectedDays is absent", () => {
    expect(formatPostChargeCancelSuccessMessage()).toBe(
      "Cancelamento solicitado. O estorno pode levar de 30 a 60 dias para aparecer na fatura.",
    );
  });

  it("formats range expectedDays for statement copy", () => {
    expect(formatPostChargeCancelSuccessMessage("30-60")).toBe(
      "Cancelamento solicitado. O estorno pode levar de 30 a 60 dias para aparecer na fatura.",
    );
  });

  it("keeps numeric expectedDays as-is", () => {
    expect(formatPostChargeCancelSuccessMessage("45")).toBe(
      "Cancelamento solicitado. O estorno pode levar de 45 dias para aparecer na fatura.",
    );
  });
});
