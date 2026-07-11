import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProposalDetailView } from "../../types/proposalDetails.types";
import { ProposalComposerDialog } from "../ProposalComposerDialog";

const resetComposer = vi.fn();
const loadFromDetail = vi.fn();
const submit = vi.fn();
const addPhotos = vi.fn();
const removeExistingPhoto = vi.fn();
const removeNewPhoto = vi.fn();
const addAvailabilitySlot = vi.fn();
const removeAvailabilitySlot = vi.fn();

vi.mock("../../hooks/useProposalComposer", () => ({
  useProposalComposer: () => ({
    form: { trigger: vi.fn().mockResolvedValue(true) },
    availabilityFieldArray: { fields: [], append: vi.fn(), remove: vi.fn() },
    existingPhotoPaths: ["path/a.jpg"],
    newPhotos: [],
    photosCount: 1,
    pricing: null,
    isPricingLoading: false,
    maxDescriptionLength: 2000,
    maxPhotos: 5,
    canSubmit: true,
    resetComposer,
    loadFromDetail,
    addPhotos,
    removeExistingPhoto,
    removeNewPhoto,
    addAvailabilitySlot,
    removeAvailabilitySlot,
    isSubmitting: false,
    submit,
  }),
}));

vi.mock("../../hooks/useProposalPhotoUrls", () => ({
  useProposalPhotoUrls: () => ({ urls: ["https://cdn.example/a.jpg"], isLoading: false }),
}));

vi.mock("../ProposalComposerShellDialog", () => ({
  ProposalComposerShellDialog: (props: {
    title: string;
    submitLabel: string;
    onSubmit: () => void;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div>
      <h2>{props.title}</h2>
      <button type="button" onClick={props.onSubmit}>
        {props.submitLabel}
      </button>
      <button type="button" onClick={() => props.onOpenChange(false)}>
        Fechar
      </button>
    </div>
  ),
}));

const initialProposal = {
  id: "p1",
  service_request_id: "sr-1",
  provider_id: "provider-1",
  status: "PENDING",
  version: 1,
  revision_count: 0,
  revision_reason: null,
  revision_notes: null,
  submitted_at: null,
  expired_at: null,
  expires_at: null,
  proposed_amount: 100,
  proposal_description: "Desc",
  proposal_duration_value: 2,
  proposal_duration_unit: "days",
  proposal_suggested_slots: [],
  selected_slot: null,
  photos: ["path/a.jpg"],
  client_rejection_response: null,
  created_at: "2026-03-20T10:00:00.000Z",
  updated_at: "2026-03-20T10:00:00.000Z",
} as ProposalDetailView;

describe("ProposalComposerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submit.mockResolvedValue(true);
  });

  it("resets the composer when opened in create mode", () => {
    render(
      <ProposalComposerDialog
        open
        onOpenChange={vi.fn()}
        chatId="chat-1"
        serviceRequestId="sr-1"
      />,
    );

    expect(resetComposer).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Enviar proposta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar proposta" })).toBeInTheDocument();
  });

  it("loads an existing proposal when opened in edit mode", () => {
    render(
      <ProposalComposerDialog
        open
        onOpenChange={vi.fn()}
        chatId="chat-1"
        serviceRequestId="sr-1"
        mode="edit"
        initialProposal={initialProposal}
      />,
    );

    expect(loadFromDetail).toHaveBeenCalledWith(initialProposal);
    expect(screen.getByRole("heading", { name: "Revisar proposta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar revisão" })).toBeInTheDocument();
  });

  it("resets when the dialog closes", () => {
    const { rerender } = render(
      <ProposalComposerDialog
        open
        onOpenChange={vi.fn()}
        chatId="chat-1"
        serviceRequestId="sr-1"
      />,
    );

    resetComposer.mockClear();
    rerender(
      <ProposalComposerDialog
        open={false}
        onOpenChange={vi.fn()}
        chatId="chat-1"
        serviceRequestId="sr-1"
      />,
    );

    expect(resetComposer).toHaveBeenCalled();
  });

  it("closes after a successful submit", async () => {
    const onOpenChange = vi.fn();
    render(
      <ProposalComposerDialog
        open
        onOpenChange={onOpenChange}
        chatId="chat-1"
        serviceRequestId="sr-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Enviar proposta" }));

    await waitFor(() => {
      expect(submit).toHaveBeenCalledOnce();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("keeps the dialog open when submit fails", async () => {
    submit.mockResolvedValue(false);
    const onOpenChange = vi.fn();
    render(
      <ProposalComposerDialog
        open
        onOpenChange={onOpenChange}
        chatId="chat-1"
        serviceRequestId="sr-1"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Enviar proposta" }));

    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
