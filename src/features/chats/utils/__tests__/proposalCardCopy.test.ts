import { describe, expect, it } from "vitest";
import {
  resolveProposalCardCtas,
  resolveProposalCardDescription,
  resolveProposalCardDetailsLabel,
  resolveProposalCardHeadline,
} from "../proposalCardCopy";

describe("proposalCardCopy", () => {
  it("maps proposal statuses to PT-BR headlines", () => {
    expect(resolveProposalCardHeadline("PENDING", "client")).toBe("Proposta recebida");
    expect(resolveProposalCardHeadline("PENDING", "provider")).toBe("Proposta enviada");
    expect(resolveProposalCardHeadline("ACCEPTED", "client")).toBe("Proposta aceita");
  });

  it("shows client CTAs only for pending proposals", () => {
    const ctas = resolveProposalCardCtas("PENDING", "client");
    expect(ctas.map((cta) => cta.id)).toEqual(["accept", "reject", "request_revision"]);
    expect(ctas.find((cta) => cta.id === "request_revision")?.disabled).toBe(false);
  });

  it("disables request revision CTA when revision limit is reached", () => {
    const ctas = resolveProposalCardCtas("PENDING", "client", 2);
    expect(ctas.find((cta) => cta.id === "request_revision")?.disabled).toBe(true);
  });

  it("shows provider edit CTA when revision was requested", () => {
    const ctas = resolveProposalCardCtas("REVISION_REQUESTED", "provider");
    expect(ctas).toEqual([{ id: "edit_proposal", label: "Editar proposta", variant: "default" }]);
  });

  it("shows revision-specific details label for provider when revision was requested", () => {
    expect(resolveProposalCardDetailsLabel("REVISION_REQUESTED", "provider")).toBe(
      "Ver detalhes da proposta",
    );
    expect(resolveProposalCardDetailsLabel("REVISION_REQUESTED", "client")).toBe(
      "Ver detalhes da proposta",
    );
    expect(resolveProposalCardDetailsLabel("PENDING", "provider")).toBe("Ver detalhes da proposta");
  });

  it("describes pending state differently per role", () => {
    expect(resolveProposalCardDescription("PENDING", "client")).toContain("sua análise");
    expect(resolveProposalCardDescription("PENDING", "provider")).toContain("cliente");
  });

  it("describes REVISED from the viewer perspective", () => {
    expect(resolveProposalCardHeadline("REVISED", "client")).toBe("Proposta recusada");
    expect(resolveProposalCardHeadline("REVISED", "provider")).toBe("Proposta revisada");
    expect(resolveProposalCardDescription("REVISED", "client")).toBe(
      "Uma nova versão da proposta está disponível.",
    );
    expect(resolveProposalCardDescription("REVISED", "provider")).toBe(
      "Esta versão foi substituída por uma nova proposta que você enviou.",
    );
  });

  it("describes rejected state from the viewer perspective", () => {
    expect(resolveProposalCardDescription("REJECTED", "client")).toBe(
      "Você optou por não seguir com esta proposta.",
    );
    expect(resolveProposalCardDescription("REJECTED", "provider")).toBe(
      "O cliente optou por não seguir com esta proposta.",
    );
    expect(resolveProposalCardDescription("REJECTED_AUTOMATICALLY", "client")).toBe(
      "Esta proposta foi encerrada automaticamente.",
    );
    expect(resolveProposalCardDescription("REJECTED_AUTOMATICALLY", "provider")).toBe(
      "O cliente seguiu com outra proposta ou encerrou o pedido.",
    );
  });
});
