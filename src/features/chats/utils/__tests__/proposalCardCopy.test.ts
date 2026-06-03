import { describe, expect, it } from "vitest";
import {
  resolveProposalCardCtas,
  resolveProposalCardDescription,
  resolveProposalCardHeadline,
} from "../proposalCardCopy";

describe("proposalCardCopy", () => {
  it("maps proposal statuses to PT-BR headlines", () => {
    expect(resolveProposalCardHeadline("PENDING")).toBe("Proposta enviada");
    expect(resolveProposalCardHeadline("ACCEPTED")).toBe("Proposta aceita");
  });

  it("shows client CTAs only for pending proposals", () => {
    const ctas = resolveProposalCardCtas("PENDING", "client");
    expect(ctas.map((cta) => cta.id)).toEqual(["accept", "reject", "request_revision"]);
  });

  it("shows provider edit CTA when revision was requested", () => {
    const ctas = resolveProposalCardCtas("REVISION_REQUESTED", "provider");
    expect(ctas).toEqual([{ id: "edit_proposal", label: "Editar proposta", variant: "default" }]);
  });

  it("describes pending state differently per role", () => {
    expect(resolveProposalCardDescription("PENDING", "client")).toContain("sua análise");
    expect(resolveProposalCardDescription("PENDING", "provider")).toContain("cliente");
  });

  it("treats REVISED as rejected in headline with new-version description", () => {
    expect(resolveProposalCardHeadline("REVISED")).toBe("Proposta recusada");
    expect(resolveProposalCardDescription("REVISED", "client")).toBe(
      "Uma nova versão da proposta está disponível.",
    );
    expect(resolveProposalCardDescription("REVISED", "provider")).toBe(
      "Uma nova versão da proposta está disponível.",
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
