import { describe, expect, it } from "vitest";
import {
  formatJourneyOccurredAt,
  presentServiceJourneyMilestone,
  presentServiceJourneyMilestones,
} from "../presentServiceJourney";
import type { ServiceJourneyMilestone } from "../../types/serviceJourney.types";

describe("formatJourneyOccurredAt", () => {
  it("formats today as Hoje, HH:mm in BRT", () => {
    // 2026-08-10 15:30 BRT = 18:30Z
    const now = new Date("2026-08-10T20:00:00.000Z");
    const iso = "2026-08-10T18:30:00.000Z";
    expect(formatJourneyOccurredAt(iso, now)).toBe("Hoje, 15:30");
  });

  it("formats yesterday as Ontem, HH:mm in BRT", () => {
    const now = new Date("2026-08-10T20:00:00.000Z");
    const iso = "2026-08-09T18:30:00.000Z";
    expect(formatJourneyOccurredAt(iso, now)).toBe("Ontem, 15:30");
  });

  it("uses absolute date+time outside today/yesterday (no relative-only copy)", () => {
    const now = new Date("2026-08-10T20:00:00.000Z");
    const iso = "2026-08-07T18:30:00.000Z";
    expect(formatJourneyOccurredAt(iso, now)).toBe("07/08/2026, 15:30");
  });

  it("returns empty string for invalid dates", () => {
    expect(formatJourneyOccurredAt("not-a-date")).toBe("");
  });
});

describe("presentServiceJourneyMilestones", () => {
  const base = (
    overrides: Partial<ServiceJourneyMilestone> &
      Pick<ServiceJourneyMilestone, "key" | "status">,
  ): ServiceJourneyMilestone => ({
    occurredAt: null,
    ...overrides,
  });

  it("maps payment label by status", () => {
    expect(
      presentServiceJourneyMilestone(
        base({ key: "payment", status: "completed", occurredAt: "2026-08-10T18:30:00.000Z" }),
        { now: new Date("2026-08-10T20:00:00.000Z") },
      ).label,
    ).toBe("Pagamento confirmado");

    expect(
      presentServiceJourneyMilestone(base({ key: "payment", status: "current" })).label,
    ).toBe("Pagamento pendente");
  });

  it("maps guidance subtexts for current and upcoming milestones", () => {
    expect(
      presentServiceJourneyMilestone(base({ key: "quote_approved", status: "current" }))
        .secondaryText,
    ).toBe("Aguardando sua aprovação");

    expect(
      presentServiceJourneyMilestone(base({ key: "payment", status: "current" }))
        .secondaryText,
    ).toBe("Aguardando pagamento");

    expect(
      presentServiceJourneyMilestone(
        base({ key: "quote_received", status: "upcoming" }),
      ).secondaryText,
    ).toBe("Aguardando orçamento");

    expect(
      presentServiceJourneyMilestone(
        base({ key: "service_scheduled", status: "upcoming" }),
      ).secondaryText,
    ).toBe("Confirmação da agenda");

    expect(
      presentServiceJourneyMilestone(
        base({ key: "service_executed", status: "upcoming" }),
      ).secondaryText,
    ).toBe("Aguardando execução");

    expect(
      presentServiceJourneyMilestone(base({ key: "rating", status: "upcoming" }))
        .secondaryText,
    ).toBe("Conte sua experiência");

    expect(
      presentServiceJourneyMilestone(base({ key: "rating", status: "current" }))
        .secondaryText,
    ).toBe("Conte sua experiência");

    expect(
      presentServiceJourneyMilestone(base({ key: "rating", status: "current" }), {
        ratingOptional: true,
      }).secondaryText,
    ).toBe("Avaliação opcional");
  });

  it("labels only the immediate next upcoming milestone as Próximo passo", () => {
    const presented = presentServiceJourneyMilestones([
      base({
        key: "request_created",
        status: "completed",
        occurredAt: "2026-08-10T18:30:00.000Z",
      }),
      base({ key: "professionals_interested", status: "current" }),
      base({ key: "quote_received", status: "upcoming" }),
      base({ key: "quote_approved", status: "upcoming" }),
      base({ key: "payment", status: "upcoming" }),
      base({ key: "service_scheduled", status: "upcoming" }),
      base({ key: "service_executed", status: "upcoming" }),
      base({ key: "rating", status: "upcoming" }),
    ]);

    expect(presented.find((m) => m.key === "quote_received")?.secondaryText).toBe(
      "Próximo passo",
    );
    expect(presented.find((m) => m.key === "quote_approved")?.secondaryText).toBe(
      "Aguardando aprovação",
    );
    expect(presented.find((m) => m.key === "payment")?.secondaryText).toBe(
      "Aguardando pagamento",
    );
    expect(presented.find((m) => m.key === "service_scheduled")?.secondaryText).toBe(
      "Confirmação da agenda",
    );
  });

  it("uses timestamps as secondary text for completed milestones", () => {
    const presented = presentServiceJourneyMilestones(
      [
        base({
          key: "request_created",
          status: "completed",
          occurredAt: "2026-08-10T18:30:00.000Z",
        }),
        base({ key: "payment", status: "current" }),
      ],
      { now: new Date("2026-08-10T20:00:00.000Z") },
    );

    expect(presented[0]?.secondaryText).toBe("Hoje, 15:30");
    expect(presented[1]?.label).toBe("Pagamento pendente");
  });

  it("keeps cancelled and dispute labels from constants", () => {
    expect(
      presentServiceJourneyMilestone(base({ key: "cancelled", status: "current" }))
        .label,
    ).toBe("Pedido cancelado");
    expect(
      presentServiceJourneyMilestone(base({ key: "cancelled", status: "current" }))
        .secondaryText,
    ).toBe("Jornada encerrada");
    expect(
      presentServiceJourneyMilestone(base({ key: "in_dispute", status: "current" }))
        .label,
    ).toBe("Em disputa");
    expect(
      presentServiceJourneyMilestone(base({ key: "in_dispute", status: "current" }))
        .secondaryText,
    ).toBe("Aguardando análise");
  });
});
