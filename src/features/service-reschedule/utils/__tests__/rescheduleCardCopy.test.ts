import { describe, expect, it } from "vitest";
import {
  resolveEndedRescheduleCardCopy,
  resolveRescheduleCardCtas,
  resolveRescheduleCardDescription,
  resolveRescheduleCardHeadline,
  resolveRescheduleSlotSectionLabel,
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

  it("resolves proposed/accepted/cancelled/expired headlines by role", () => {
    expect(resolveRescheduleCardHeadline("PROPOSED", "client")).toBe("Nova data proposta");
    expect(resolveRescheduleCardHeadline("PROPOSED", "provider")).toBe(
      "Aguardando confirmação do cliente",
    );
    expect(resolveRescheduleCardHeadline("ACCEPTED", "client")).toBe("Reagendamento confirmado");
    expect(resolveRescheduleCardHeadline("CANCELLED", "client")).toBe("Reagendamento cancelado");
    expect(resolveRescheduleCardHeadline("EXPIRED", "provider")).toBe("Reagendamento expirado");
    expect(resolveRescheduleCardHeadline("REQUESTED", "provider")).toBe("Reagendamento solicitado");
    expect(resolveRescheduleCardHeadline("REQUESTED", "client")).toBe(
      "Aguardando proposta do prestador",
    );
  });

  it("resolves descriptions for proposed, accepted, cancelled and expired", () => {
    expect(resolveRescheduleCardDescription("PROPOSED", "client")).toContain("confirme");
    expect(resolveRescheduleCardDescription("PROPOSED", "provider")).toContain("aceitar");
    expect(resolveRescheduleCardDescription("ADJUSTMENT_REQUESTED", "provider")).toContain(
      "nova proposta",
    );
    expect(resolveRescheduleCardDescription("ACCEPTED", "client")).toContain("confirmado");
    expect(resolveRescheduleCardDescription("CANCELLED", "client")).toContain("data original");
    expect(resolveRescheduleCardDescription("EXPIRED", "client")).toContain("expirou");
    expect(resolveRescheduleCardDescription("REQUESTED", "provider")).toContain("Proponha");
    expect(resolveRescheduleCardDescription("REQUESTED", "client")).toContain("prestador");
  });

  it("shows client accept and adjustment CTAs only when proposed and flags allow", () => {
    expect(
      resolveRescheduleCardCtas("PROPOSED", "client", {
        canPropose: false,
        canAccept: true,
        canRequestAdjustment: true,
        canCancel: false,
      }).map((cta) => cta.id),
    ).toEqual(["accept", "request_adjustment"]);

    expect(
      resolveRescheduleCardCtas("PROPOSED", "client", {
        canPropose: false,
        canAccept: false,
        canRequestAdjustment: false,
        canCancel: false,
      }),
    ).toEqual([]);
  });

  it("labels slot sections for range vs single day and hides ended statuses", () => {
    expect(resolveRescheduleSlotSectionLabel("PROPOSED")).toBe("Data proposta");
    expect(resolveRescheduleSlotSectionLabel("PROPOSED", true)).toBe("Período proposto");
    expect(resolveRescheduleSlotSectionLabel("REQUESTED", true)).toBe("Período original");
    expect(resolveRescheduleSlotSectionLabel("CANCELLED")).toBeNull();
    expect(shouldShowRescheduleSlotSection("CANCELLED", { start_date: "2026-08-01" })).toBe(false);
    expect(shouldShowRescheduleSlotSection("PROPOSED", null)).toBe(false);
  });

  it("returns ended-card copy for inactive requests", () => {
    expect(resolveEndedRescheduleCardCopy()).toEqual({
      headline: "Reagendamento encerrado",
      description: "Esta solicitação não está mais ativa.",
    });
  });
});
