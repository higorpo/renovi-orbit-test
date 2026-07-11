import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AcceptProposalDialogSkeleton,
  ProposalDetailsDialogSkeleton,
  ProposalPhotosSkeleton,
  RejectProposalDialogSkeleton,
  RevisionRequestDialogSkeleton,
} from "../proposalDialogSkeletons";

describe("proposalDialogSkeletons", () => {
  it("renders accept, reject, and revision skeletons", () => {
    render(
      <>
        <AcceptProposalDialogSkeleton />
        <RejectProposalDialogSkeleton />
        <RevisionRequestDialogSkeleton />
      </>,
    );

    expect(screen.getByLabelText("Carregando datas disponíveis")).toBeInTheDocument();
    expect(screen.getByLabelText("Carregando formulário de recusa")).toBeInTheDocument();
    expect(screen.getByLabelText("Carregando formulário de revisão")).toBeInTheDocument();
  });

  it("renders details skeleton with and without provider pricing", () => {
    const { rerender } = render(<ProposalDetailsDialogSkeleton />);
    expect(screen.getByLabelText("Carregando detalhes da proposta")).toBeInTheDocument();

    rerender(<ProposalDetailsDialogSkeleton showProviderPricing />);
    expect(screen.getByLabelText("Carregando detalhes da proposta")).toBeInTheDocument();
  });

  it("renders photo skeletons", () => {
    render(<ProposalPhotosSkeleton count={2} />);
    expect(screen.getAllByLabelText("Carregando fotos").length).toBeGreaterThan(0);
  });
});
