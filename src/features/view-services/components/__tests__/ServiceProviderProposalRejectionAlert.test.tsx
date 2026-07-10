// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceProviderProposalRejectionAlert } from "../ServiceProviderProposalRejectionAlert";

const { useLatestProviderProposalMock } = vi.hoisted(() => ({
  useLatestProviderProposalMock: vi.fn(),
}));

vi.mock("@/features/negotiation-proposals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/negotiation-proposals")>();
  return {
    ...actual,
    useLatestProviderProposal: useLatestProviderProposalMock,
  };
});

describe("ServiceProviderProposalRejectionAlert", () => {
  it("renders rejection alert with client response", () => {
    useLatestProviderProposalMock.mockReturnValue({
      isLoading: false,
      data: {
        summary: {
          status: "REJECTED",
          clientRejectionResponse: "Preço alto",
        },
      },
    });

    render(<ServiceProviderProposalRejectionAlert serviceRequestId="sr-1" />);

    expect(screen.getByText(/orçamento rejeitado/i)).toBeInTheDocument();
    expect(screen.getByText(/preço alto/i)).toBeInTheDocument();
  });

  it("renders fallback copy when client left no comment", () => {
    useLatestProviderProposalMock.mockReturnValue({
      isLoading: false,
      data: {
        summary: {
          status: "REJECTED",
          clientRejectionResponse: "   ",
        },
      },
    });

    render(<ServiceProviderProposalRejectionAlert serviceRequestId="sr-1" />);

    expect(
      screen.getByText(/rejeitou o orçamento sem deixar um comentário/i),
    ).toBeInTheDocument();
  });

  it("renders nothing when proposal is loading", () => {
    useLatestProviderProposalMock.mockReturnValue({
      isLoading: true,
      data: null,
    });

    const { container } = render(
      <ServiceProviderProposalRejectionAlert serviceRequestId="sr-1" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
