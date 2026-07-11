// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderServiceProposalDialogs } from "../ProviderServiceProposalDialogs";

vi.mock("@/features/negotiation-proposals", () => ({
  ProposalComposerDialog: ({
    open,
    chatId,
  }: {
    open: boolean;
    chatId: string;
  }) => (open ? <div data-testid="composer-dialog">Composer {chatId}</div> : null),
  ProposalDetailsDialog: ({
    open,
    isLoading,
  }: {
    open: boolean;
    isLoading: boolean;
  }) =>
    open ? (
      <div data-testid="details-dialog">
        Details {isLoading ? "loading" : "ready"}
      </div>
    ) : null,
  canEditServiceRequestProposal: (status?: string) => status === "REVISION_REQUESTED",
}));

describe("ProviderServiceProposalDialogs", () => {
  it("renders nothing when composer and details are closed", () => {
    const { container } = render(
      <ProviderServiceProposalDialogs
        dialogs={{
          composerOpen: false,
          composerContext: null,
          composerInitialProposal: null,
          handleComposerOpenChange: vi.fn(),
          invalidateAfterProposalMutation: vi.fn(),
          detailsOpen: false,
          proposalDetailQuery: {
            data: undefined,
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
          },
          handleDetailsDialogOpenChange: vi.fn(),
          openComposerEditFromDetails: vi.fn(),
        } as never}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders composer and details dialogs when open", () => {
    render(
      <ProviderServiceProposalDialogs
        dialogs={{
          composerOpen: true,
          composerContext: {
            chatId: "chat-1",
            serviceRequestId: "sr-1",
          },
          composerInitialProposal: { id: "proposal-1" },
          handleComposerOpenChange: vi.fn(),
          invalidateAfterProposalMutation: vi.fn(),
          detailsOpen: true,
          proposalDetailQuery: {
            data: { id: "proposal-1", status: "REVISION_REQUESTED" },
            isLoading: false,
            isError: false,
            refetch: vi.fn(),
          },
          handleDetailsDialogOpenChange: vi.fn(),
          openComposerEditFromDetails: vi.fn(),
        } as never}
      />,
    );

    expect(screen.getByTestId("composer-dialog")).toHaveTextContent("Composer chat-1");
    expect(screen.getByTestId("details-dialog")).toHaveTextContent("Details ready");
  });
});
