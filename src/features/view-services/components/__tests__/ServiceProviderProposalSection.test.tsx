// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { ServiceProviderProposalSection } from "../ServiceProviderProposalSection";

const {
  useLatestProviderProposalMock,
  useServiceRequestProposalComposerMock,
  canEditMock,
} = vi.hoisted(() => ({
  useLatestProviderProposalMock: vi.fn(),
  useServiceRequestProposalComposerMock: vi.fn(),
  canEditMock: vi.fn(() => true),
}));

vi.mock("@/features/negotiation-proposals", () => ({
  LATEST_PROVIDER_PROPOSAL_QUERY_KEY: "latest-proposal",
  canEditServiceRequestProposal: (...args: unknown[]) => canEditMock(...args),
  useLatestProviderProposal: (...args: unknown[]) =>
    useLatestProviderProposalMock(...args),
  useProposalPhotoUrls: () => ({ urls: [] }),
  useServiceRequestProposalComposer: (...args: unknown[]) =>
    useServiceRequestProposalComposerMock(...args),
  ServiceRequestProposalSummaryCard: ({
    onEdit,
  }: {
    onEdit: () => void;
  }) => (
    <button type="button" onClick={onEdit}>
      Editar orçamento
    </button>
  ),
  ServiceRequestProposalSummaryCardSkeleton: () => <div data-testid="proposal-skeleton" />,
  ProposalComposerShellDialog: (props: {
    onOpenChange: (open: boolean) => void;
    onSubmit: () => Promise<void>;
    onPhotoAdd: () => void;
  }) => (
    <div data-testid="composer-dialog">
      <button type="button" onClick={() => props.onOpenChange(false)}>
        close-composer
      </button>
      <button type="button" onClick={() => void props.onSubmit()}>
        submit-composer
      </button>
    </div>
  ),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  useServiceRequestProposalComposerMock.mockReturnValue({
    isOpen: false,
    isSubmitting: false,
    canSubmitProposal: false,
    form: {},
    availabilityFieldArray: {},
    existingPhotoPaths: [],
    newPhotos: [],
    photosCount: 0,
    pricing: null,
    isPricingLoading: false,
    maxDescriptionLength: 500,
    maxPhotos: 5,
    openComposer: vi.fn(),
    closeComposer: vi.fn(),
    addPhotos: vi.fn(),
    removeExistingPhoto: vi.fn(),
    removeNewPhoto: vi.fn(),
    addAvailabilitySlot: vi.fn(),
    removeAvailabilitySlot: vi.fn(),
    submitProposal: vi.fn(),
  });
});

describe("ServiceProviderProposalSection", () => {
  it("shows skeleton while loading", () => {
    useLatestProviderProposalMock.mockReturnValue({ isLoading: true, data: null });
    render(<ServiceProviderProposalSection serviceRequestId="sr-1" />, { wrapper });
    expect(screen.getByTestId("proposal-skeleton")).toBeInTheDocument();
  });

  it("returns null when there is no proposal", () => {
    useLatestProviderProposalMock.mockReturnValue({ isLoading: false, data: null });
    const { container } = render(
      <ServiceProviderProposalSection serviceRequestId="sr-1" />,
      { wrapper },
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders proposal summary and composer", async () => {
    const openComposer = vi.fn();
    const closeComposer = vi.fn();
    const submitProposal = vi.fn().mockResolvedValue(undefined);
    useServiceRequestProposalComposerMock.mockReturnValue({
      isOpen: true,
      isSubmitting: false,
      canSubmitProposal: true,
      form: {},
      availabilityFieldArray: {},
      existingPhotoPaths: [],
      newPhotos: [],
      photosCount: 0,
      pricing: null,
      isPricingLoading: false,
      maxDescriptionLength: 500,
      maxPhotos: 5,
      openComposer,
      closeComposer,
      addPhotos: vi.fn(),
      removeExistingPhoto: vi.fn(),
      removeNewPhoto: vi.fn(),
      addAvailabilitySlot: vi.fn(),
      removeAvailabilitySlot: vi.fn(),
      submitProposal,
    });
    useLatestProviderProposalMock.mockReturnValue({
      isLoading: false,
      data: {
        summary: { status: "PENDING" },
        draft: null,
      },
    });

    render(<ServiceProviderProposalSection serviceRequestId="sr-1" />, { wrapper });
    expect(screen.getByRole("button", { name: "Editar orçamento" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar orçamento" }));
    expect(openComposer).toHaveBeenCalledWith({ mode: "edit" });
    fireEvent.click(screen.getByRole("button", { name: "close-composer" }));
    expect(closeComposer).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "submit-composer" }));
    await waitFor(() => expect(submitProposal).toHaveBeenCalled());

    const composerArgs = useServiceRequestProposalComposerMock.mock.calls[0][0];
    await composerArgs.onSubmitSuccess();
  });
});
