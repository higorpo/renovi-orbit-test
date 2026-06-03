import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderProposalHistoryItem } from "../../types/proposals.types";
import { ProposalDetailsDialog } from "../ProposalDetailsDialog";
import { ProposalHistoryAccordion } from "../ProposalHistoryAccordion";
import { ProposalPhotosGrid } from "../ProposalPhotosGrid";
import { ProposalComposerShellDialog } from "../ProposalComposerShellDialog";

vi.mock("../ProposalComposer", () => ({
  ProposalComposer: () => <div data-testid="proposal-composer-stub" />,
}));

vi.mock("../../hooks/useProposalHistory", () => ({
  useProposalHistory: () => ({
    items: [],
    isLoading: false,
    isError: false,
    errorMessage: null,
  }),
}));

vi.mock("../../hooks/useProposalPhotoUrls", () => ({
  useProposalPhotoUrls: () => ({ urls: [], isLoading: false }),
}));

const baseProposal: ProviderProposalHistoryItem = {
  id: "p1",
  proposed_amount: 100,
  proposal_description: "Desc",
  proposal_duration_value: 2,
  proposal_duration_unit: "days",
  proposal_suggested_slots: [
    { start_date: "2026-04-01", end_date: "2026-04-02", shift: "morning" },
  ],
  status: "REJECTED",
  tax_rate: 0.1,
  tax_amount: 10,
  final_amount: 90,
  photos: ["path/a.jpg"],
  created_at: "2026-03-20T10:00:00.000Z",
  updated_at: "2026-03-20T10:00:00.000Z",
  client_rejection_response: "Muito caro",
};

const shellProps = {
  open: true,
  isSubmitting: false,
  canSubmit: true,
  onOpenChange: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue(undefined),
  form: { trigger: vi.fn().mockResolvedValue(true) },
  availabilityFieldArray: { fields: [], append: vi.fn(), remove: vi.fn() },
  existingPhotoUrls: [] as string[],
  newPhotos: [] as File[],
  photosCount: 0,
  pricing: null,
  isPricingLoading: false,
  maxDescriptionLength: 1200,
  maxPhotos: 5,
  onPhotoAdd: vi.fn(),
  onExistingPhotoRemove: vi.fn(),
  onNewPhotoRemove: vi.fn(),
  onAvailabilitySlotAdd: vi.fn(),
  onAvailabilitySlotRemove: vi.fn(),
};

describe("ProposalPhotosGrid", () => {
  it("returns null when not loading and no urls", () => {
    const { container } = render(
      <ProposalPhotosGrid
        isLoading={false}
        urls={[]}
        fallbackPhotos={null}
        heading="Fotos do orçamento"
        photoAltPrefix="Foto do orçamento"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders budget photo labels", () => {
    render(
      <ProposalPhotosGrid
        isLoading={false}
        urls={["https://x/1.jpg"]}
        fallbackPhotos={[]}
        heading="Fotos do orçamento"
        photoAltPrefix="Foto do orçamento"
      />,
    );
    expect(screen.getByText(/fotos do orçamento/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /foto do orçamento 1/i })).toBeInTheDocument();
  });
});

describe("ProposalDetailsDialog", () => {
  it("renders budget details when proposal is set", () => {
    render(
      <ProposalDetailsDialog
        proposal={baseProposal}
        onOpenChange={vi.fn()}
        copyVariant="budget"
      />,
    );
    expect(screen.getByText(/detalhes do orçamento/i)).toBeInTheDocument();
    expect(screen.getByText(/muito caro/i)).toBeInTheDocument();
    expect(screen.getByText(/taxa da plataforma/i)).toBeInTheDocument();
    expect(screen.getByText(/valor a receber/i)).toBeInTheDocument();
  });

  it("hides provider pricing when pricing fields are absent", () => {
    render(
      <ProposalDetailsDialog
        proposal={{ ...baseProposal, tax_rate: undefined, tax_amount: undefined, final_amount: undefined }}
        onOpenChange={vi.fn()}
        copyVariant="proposal"
      />,
    );
    expect(screen.getByText(/detalhes da proposta/i)).toBeInTheDocument();
    expect(screen.queryByText(/taxa da plataforma/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/valor a receber/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/muito caro/i)).not.toBeInTheDocument();
  });
});

describe("ProposalHistoryAccordion", () => {
  it("renders history trigger for budget copy", () => {
    render(
      <ProposalHistoryAccordion
        historyOpen={false}
        proposalHistory={[]}
        isHistoryLoading={false}
        isHistoryError={false}
        onHistoryOpenChange={vi.fn()}
        onProposalSelect={vi.fn()}
        copyVariant="budget"
      />,
    );
    expect(screen.getByText(/ver histórico de orçamentos/i)).toBeInTheDocument();
  });
});

describe("ProposalDetailsDialog summary mode", () => {
  it("renders summary card content for provider budget view", () => {
    render(
      <ProposalDetailsDialog
        open
        onOpenChange={vi.fn()}
        summary={{
          serviceRequestId: "sr-1",
          proposalId: "p1",
          isLatestProposal: true,
          status: "PENDING",
          proposedAmount: 100,
          taxRate: 0.1,
          taxAmount: 10,
          description: "Desc",
          photos: null,
          clientRejectionResponse: null,
          revisionReason: null,
          revisionNotes: null,
        }}
        canEdit={false}
        onEdit={vi.fn()}
        copyVariant="budget"
      />,
    );

    expect(screen.getByText(/detalhes do orçamento/i)).toBeInTheDocument();
    expect(screen.queryByText(/seu orçamento mais recente/i)).not.toBeInTheDocument();
    expect(screen.getByText(/taxa da plataforma/i)).toBeInTheDocument();
  });
});

describe("ProposalComposerShellDialog (service request)", () => {
  const serviceRequestShellProps = {
    ...shellProps,
    title: "Enviar orçamento",
    submitLabel: "Enviar orçamento",
    submittingLabel: "Enviando...",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders budget composer shell", () => {
    render(<ProposalComposerShellDialog {...serviceRequestShellProps} />);
    expect(screen.getByRole("heading", { name: /enviar orçamento/i })).toBeInTheDocument();
    expect(screen.getByTestId("proposal-composer-stub")).toBeInTheDocument();
  });

  it("calls onSubmit when submit is clicked", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProposalComposerShellDialog {...serviceRequestShellProps} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /^enviar orçamento$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });
});
