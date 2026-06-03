import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobDetailContent } from "../JobDetailContent";
import { createMinimalJob } from "../../__tests__/fixtures/jobFixtures";

type Slot = {
  startDate: string;
  endDate: string;
  shift: "morning" | "afternoon" | "full_day";
};

const proposalUi = vi.hoisted(() => ({
  isProposalOpen: false,
  isSubmitting: false,
  isPricingLoading: false,
  priceInput: "",
  descriptionDraft: "",
  durationValueInput: "",
  durationUnit: "hours" as "hours" | "days",
  availabilitySlots: [] as Slot[],
  existingPhotoPaths: [] as string[],
  newPhotos: [] as File[],
  photosCount: 0,
  pricing: null,
  maxDescriptionLength: 1200,
  maxPhotos: 5,
  canSubmitProposal: false,
  closeProposalComposer: vi.fn(),
  openComposer: vi.fn(),
  submitProposal: vi.fn(),
  setPriceInput: vi.fn(),
  setDescriptionDraft: vi.fn(),
  setDurationValueInput: vi.fn(),
  setDurationUnit: vi.fn(),
  updateAvailabilitySlot: vi.fn(),
  addAvailabilitySlot: vi.fn(),
  removeExistingPhoto: vi.fn(),
  removeNewPhoto: vi.fn(),
  addPhotos: vi.fn(),
  removeAvailabilitySlot: vi.fn(),
  form: {
    trigger: vi.fn().mockResolvedValue(true),
    watch: vi.fn(),
    setValue: vi.fn(),
    getValues: vi.fn().mockReturnValue({}),
  },
  availabilityFieldArray: {
    fields: [],
    append: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("@/features/negotiation-proposals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/negotiation-proposals")>();
  return {
    ...actual,
    useProposalPhotoUrls: () => ({ urls: [], isLoading: false }),
    useServiceRequestProposalComposer: () => ({
      isOpen: proposalUi.isProposalOpen,
      isSubmitting: proposalUi.isSubmitting,
      isPricingLoading: proposalUi.isPricingLoading,
      priceInput: proposalUi.priceInput,
      descriptionDraft: proposalUi.descriptionDraft,
      durationValueInput: proposalUi.durationValueInput,
      durationUnit: proposalUi.durationUnit,
      availabilitySlots: proposalUi.availabilitySlots,
      existingPhotoPaths: proposalUi.existingPhotoPaths,
      newPhotos: proposalUi.newPhotos,
      photosCount: proposalUi.photosCount,
      pricing: proposalUi.pricing,
      maxDescriptionLength: proposalUi.maxDescriptionLength,
      maxPhotos: proposalUi.maxPhotos,
      canSubmitProposal: proposalUi.canSubmitProposal,
      openComposer: proposalUi.openComposer,
      closeComposer: proposalUi.closeProposalComposer,
      setPriceInput: proposalUi.setPriceInput,
      setDescriptionDraft: proposalUi.setDescriptionDraft,
      setDurationValueInput: proposalUi.setDurationValueInput,
      setDurationUnit: proposalUi.setDurationUnit,
      updateAvailabilitySlot: proposalUi.updateAvailabilitySlot,
      addAvailabilitySlot: proposalUi.addAvailabilitySlot,
      removeAvailabilitySlot: proposalUi.removeAvailabilitySlot,
      addPhotos: proposalUi.addPhotos,
      removeExistingPhoto: proposalUi.removeExistingPhoto,
      removeNewPhoto: proposalUi.removeNewPhoto,
      submitProposal: proposalUi.submitProposal,
      form: proposalUi.form,
      availabilityFieldArray: proposalUi.availabilityFieldArray,
    }),
    useProposalHistory: () => ({
      items: [],
      isLoading: false,
      isError: false,
      errorMessage: null,
    }),
    ServiceRequestProposalComposerDialog: ({
      open,
      onOpenChange,
      onSubmit,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      onSubmit: () => Promise<void>;
    }) =>
      open
        ? createElement(
            "div",
            { role: "dialog", "aria-label": "composer" },
            createElement(
              "button",
              { type: "button", onClick: () => onOpenChange(false) },
              "Fechar",
            ),
            createElement(
              "button",
              { type: "button", onClick: () => void onSubmit() },
              "Enviar orçamento",
            ),
          )
        : null,
  };
});

function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient();
  return render(
    createElement(QueryClientProvider, { client }, ui as ReactNode),
  );
}

function resetProposalUi() {
  proposalUi.isProposalOpen = false;
  proposalUi.isSubmitting = false;
  proposalUi.isPricingLoading = false;
  proposalUi.priceInput = "";
  proposalUi.descriptionDraft = "";
  proposalUi.durationValueInput = "";
  proposalUi.durationUnit = "hours";
  proposalUi.availabilitySlots = [];
  proposalUi.existingPhotoPaths = [];
  proposalUi.newPhotos = [];
  proposalUi.photosCount = 0;
  proposalUi.pricing = null;
  proposalUi.canSubmitProposal = false;
}

describe("JobDetailContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetProposalUi();
    proposalUi.closeProposalComposer.mockReset();
    proposalUi.openComposer.mockReset();
    proposalUi.submitProposal.mockReset();
  });

  it("renders rejection alert when proposal rejected", () => {
    const job = createMinimalJob({
      provider_proposal_status: "REJECTED",
      provider_proposal_client_rejection_response: "Preço alto",
    });
    renderWithQuery(<JobDetailContent job={job} />);
    expect(screen.getByText(/orçamento rejeitado/i)).toBeInTheDocument();
    expect(screen.getByText(/preço alto/i)).toBeInTheDocument();
  });

  it("renders fallback rejection copy when client left no comment", () => {
    const job = createMinimalJob({
      provider_proposal_status: "REJECTED",
      provider_proposal_client_rejection_response: "   ",
    });
    renderWithQuery(<JobDetailContent job={job} />);
    expect(
      screen.getByText(/rejeitou o orçamento sem deixar um comentário/i),
    ).toBeInTheDocument();
  });

  it("renders job detail for browse state", () => {
    const job = createMinimalJob();
    renderWithQuery(<JobDetailContent job={job} isInsideSheet />);
    expect(screen.getByText(job.title)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /estou pronto para enviar um orçamento/i, hidden: true }),
    ).toBeInTheDocument();
  });

  it("hides floating proposal CTA when viewing a non-latest proposal", () => {
    const job = createMinimalJob({
      provider_proposal_id: "old-prop",
      provider_proposal_status: "REVISED",
      is_latest_provider_proposal: false,
    });
    renderWithQuery(<JobDetailContent job={job} />);
    expect(
      screen.queryByRole("button", { name: /estou pronto para enviar um orçamento/i }),
    ).not.toBeInTheDocument();
  });

  it("renders summary when provider proposal exists", () => {
    const job = createMinimalJob({
      provider_proposal_id: "prop-1",
      provider_proposal_status: "PENDING",
      provider_proposed_amount: 500,
    });
    renderWithQuery(<JobDetailContent job={job} />);
    expect(screen.getByText(/seu orçamento mais recente/i)).toBeInTheDocument();
  });

  it("closes proposal composer via dialog onOpenChange", () => {
    proposalUi.isProposalOpen = true;
    renderWithQuery(<JobDetailContent job={createMinimalJob()} />);
    const dialog = screen.getByRole("dialog");
    const closeButtons = within(dialog).getAllByRole("button", { name: /^fechar$/i });
    fireEvent.click(closeButtons[0]);
    expect(proposalUi.closeProposalComposer).toHaveBeenCalled();
  });

  it("calls submitProposal when proposal dialog submits valid payload", async () => {
    proposalUi.isProposalOpen = true;
    proposalUi.priceInput = "500";
    proposalUi.descriptionDraft = "Serviço completo";
    proposalUi.durationValueInput = "2";
    proposalUi.durationUnit = "hours";
    proposalUi.availabilitySlots = [
      { startDate: "2099-06-01", endDate: "", shift: "morning" },
    ];
    proposalUi.canSubmitProposal = true;
    proposalUi.submitProposal.mockResolvedValue(undefined);
    renderWithQuery(<JobDetailContent job={createMinimalJob()} />);
    fireEvent.click(screen.getByRole("button", { name: /enviar orçamento/i }));
    await waitFor(() => {
      expect(proposalUi.submitProposal).toHaveBeenCalled();
    });
  });

  it("opens proposal composer in edit mode from summary card", () => {
    const job = createMinimalJob({
      provider_proposal_id: "prop-1",
      provider_proposal_status: "PENDING",
      provider_proposed_amount: 400,
    });
    renderWithQuery(<JobDetailContent job={job} />);
    fireEvent.click(screen.getByRole("button", { name: /editar orçamento/i }));
    expect(proposalUi.openComposer).toHaveBeenCalledWith({ mode: "edit" });
  });

  it("opens proposal composer from desktop floating actions", () => {
    renderWithQuery(<JobDetailContent job={createMinimalJob()} />);
    const ready = screen.getByRole("button", {
      name: /estou pronto para enviar um orçamento/i,
      hidden: true,
    });
    fireEvent.click(ready);
    expect(proposalUi.openComposer).toHaveBeenCalled();
  });
});
