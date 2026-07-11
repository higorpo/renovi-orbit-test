import { describe, expect, it } from "vitest";
import type { ProposalCountdownSnapshot } from "../proposalCountdown";
import { resolveProposalCountdownCopy } from "../proposalCountdownCopy";

function createSnapshot(
  overrides: Partial<ProposalCountdownSnapshot> = {},
): ProposalCountdownSnapshot {
  return {
    phase: "active",
    expiresAt: null,
    remainingMs: 7_200_000,
    remainingLabel: "2 h",
    isWarning: false,
    isExpired: false,
    ...overrides,
  };
}

describe("resolveProposalCountdownCopy", () => {
  it("returns no copy for inactive or unlabeled countdowns", () => {
    expect(
      resolveProposalCountdownCopy({
        audience: "client",
        copyVariant: "proposal",
        snapshot: createSnapshot({ phase: "inactive" }),
        density: "default",
      }),
    ).toBeNull();

    expect(
      resolveProposalCountdownCopy({
        audience: "provider",
        copyVariant: "proposal",
        snapshot: createSnapshot({ remainingLabel: "" }),
        density: "compact",
      }),
    ).toBeNull();
  });

  it("uses compact client copy with the remaining time", () => {
    expect(
      resolveProposalCountdownCopy({
        audience: "client",
        copyVariant: "budget",
        snapshot: createSnapshot(),
        density: "compact",
      }),
    ).toEqual({
      title: "Prazo para responder",
      body: "Restam 2 h para decidir.",
    });
  });

  it("uses audience-specific compact expired copy", () => {
    const snapshot = createSnapshot({
      phase: "expired",
      isExpired: true,
      remainingLabel: "Prazo encerrado",
    });

    expect(
      resolveProposalCountdownCopy({
        audience: "client",
        copyVariant: "budget",
        snapshot,
        density: "compact",
      }),
    ).toEqual({
      title: "Prazo encerrado",
      body: "O prazo para responder a este orçamento terminou.",
    });
    expect(
      resolveProposalCountdownCopy({
        audience: "provider",
        copyVariant: "proposal",
        snapshot,
        density: "compact",
      }),
    ).toEqual({
      title: "Prazo encerrado",
      body: "O prazo de resposta do cliente terminou.",
    });
  });

  it("highlights warning copy and includes the client deadline", () => {
    const copy = resolveProposalCountdownCopy({
      audience: "client",
      copyVariant: "proposal",
      snapshot: createSnapshot({
        phase: "warning",
        expiresAt: new Date("2026-07-10T18:00:00"),
        remainingLabel: "45 min",
        isWarning: true,
      }),
      density: "default",
    });

    expect(copy?.title).toBe("Prazo quase encerrado");
    expect(copy?.body).toContain("Restam 45 min para decidir.");
    expect(copy?.body).toContain("Aprove ou recuse até 10/07/2026");
  });

  it("uses provider-specific active and warning copy", () => {
    const activeCopy = resolveProposalCountdownCopy({
      audience: "provider",
      copyVariant: "proposal",
      snapshot: createSnapshot(),
      density: "default",
    });
    const warningCopy = resolveProposalCountdownCopy({
      audience: "provider",
      copyVariant: "proposal",
      snapshot: createSnapshot({ phase: "warning", isWarning: true }),
      density: "default",
    });

    expect(activeCopy).toEqual({
      title: "Aguardando resposta do cliente",
      body: "O cliente tem 2 h para decidir.",
    });
    expect(warningCopy).toEqual({
      title: "Prazo quase encerrado",
      body: "O cliente tem 2 h para responder.",
    });
  });

  it("uses the entity label in default expired client copy", () => {
    expect(
      resolveProposalCountdownCopy({
        audience: "client",
        copyVariant: "budget",
        snapshot: createSnapshot({
          phase: "expired",
          remainingLabel: "Prazo encerrado",
          isExpired: true,
        }),
        density: "default",
      }),
    ).toEqual({
      title: "Prazo encerrado",
      body: "O prazo para aprovar ou recusar este orçamento terminou.",
    });
  });
});
