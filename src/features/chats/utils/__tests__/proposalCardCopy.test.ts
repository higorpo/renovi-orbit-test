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
});
