import { describe, expect, it } from "vitest";
import {
  resolveRescheduleCardCtas,
  resolveRescheduleCardDescription,
  resolveRescheduleCardHeadline,
  shouldShowRescheduleSlotSection,
} from "../rescheduleCardCopy";

describe("rescheduleCardCopy", () => {
  it("shows provider propose CTA when adjustment was requested", () => {
    const ctas = resolveRescheduleCardCtas("ADJUSTMENT_REQUESTED", "provider", {
      canPropose: true,
      canAccept: false,
      canRequestAdjustment: false,
      canCancel: true,
    });

    expect(ctas.map((cta) => cta.id)).toEqual(["propose", "cancel"]);
    expect(resolveRescheduleCardHeadline("ADJUSTMENT_REQUESTED", "provider")).toBe(
      "Cliente pediu outra data",
    );
  });

  it("hides client accept/adjust CTAs when adjustment was requested", () => {
    const ctas = resolveRescheduleCardCtas("ADJUSTMENT_REQUESTED", "client", {
      canPropose: false,
      canAccept: false,
      canRequestAdjustment: false,
      canCancel: true,
    });

    expect(ctas.map((cta) => cta.id)).toEqual(["cancel"]);
    expect(resolveRescheduleCardHeadline("ADJUSTMENT_REQUESTED", "client")).toBe(
      "Ajuste solicitado",
    );
    expect(resolveRescheduleCardDescription("ADJUSTMENT_REQUESTED", "client")).toContain(
      "prestador foi notificado",
    );
  });

  it("shows original slot section while waiting for a new proposal", () => {
    expect(shouldShowRescheduleSlotSection("ADJUSTMENT_REQUESTED", { start_date: "2026-08-01" })).toBe(
      true,
    );
    expect(shouldShowRescheduleSlotSection("PROPOSED", { start_date: "2026-08-15" })).toBe(true);
  });

  it("renders superseded historical proposal copy without CTAs", () => {
    expect(resolveRescheduleCardHeadline("SUPERSEDED", "client")).toBe("Proposta substituída");
    expect(resolveRescheduleCardDescription("SUPERSEDED", "provider")).toContain(
      "nova data foi proposta",
    );
    expect(
      resolveRescheduleCardCtas("SUPERSEDED", "client", {
        canPropose: false,
        canAccept: false,
        canRequestAdjustment: false,
        canCancel: false,
      }),
    ).toEqual([]);
  });
});
