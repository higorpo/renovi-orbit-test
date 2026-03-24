import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMinimalJob } from "../../__tests__/fixtures/jobFixtures";
import { JobDetailFloatingActions } from "../JobDetailFloatingActions";
import { JobDetailMetadataBadges } from "../JobDetailMetadataBadges";
import { JobDetailRequestSections } from "../JobDetailRequestSections";
import { JobDetailSkeleton } from "../JobDetailSkeleton";
import { JobQuestionPromptCard } from "../JobQuestionPromptCard";
import { JobQuestionsFeed } from "../JobQuestionsFeed";
import { ProviderProposalPhotosGrid } from "../ProviderProposalPhotosGrid";
import { ProviderProposalDetailsDialog } from "../ProviderProposalDetailsDialog";
import { ProviderProposalHistoryAccordion } from "../ProviderProposalHistoryAccordion";
import { JobQuestionComposerDialog } from "../JobQuestionComposerDialog";
import { ProviderProposalComposerDialog } from "../ProviderProposalComposerDialog";
import { mapSuggestedEquipmentToPt, mapSuggestedMaterialsToPt } from "../../utils/suggestedItemsMapper";
import type { ProviderProposalHistoryItem } from "../../api/providerProposals.api";

vi.mock("@/features/request-quote", () => ({
  useServiceRequestPhotoUrls: () => ({
    urls: ["https://photo.test/1.jpg"],
    isLoading: false,
  }),
}));

const mockQuestions = vi.fn();
vi.mock("../../hooks/useProviderJobQuestions", () => ({
  useProviderJobQuestions: () => mockQuestions(),
}));

vi.mock("@/features/client-budgets/hooks/useQuestionResponseImageUrls", () => ({
  useQuestionResponseImageUrls: (paths: string[] | null | undefined) => {
    const p = paths ?? [];
    if (p.length === 0) return { urls: [], isLoading: false };
    return {
      urls: p.map((_, i) => `https://signed.test/${i}.jpg`),
      isLoading: false,
    };
  },
}));

const mockProposalPhotoUrls = vi.fn();
vi.mock("../../hooks/useProviderProposalPhotoUrls", () => ({
  useProviderProposalPhotoUrls: () => mockProposalPhotoUrls(),
}));

describe("JobDetail sections", () => {
  it("renders JobDetailSkeleton", () => {
    render(<JobDetailSkeleton />);
    expect(screen.getByLabelText(/carregando detalhes/i)).toBeInTheDocument();
  });

  it("renders JobDetailMetadataBadges when hints exist", () => {
    const job = createMinimalJob({
      estimated_duration_hint: "1_day",
      scope_complexity: "medium",
    });
    render(<JobDetailMetadataBadges job={job} />);
    expect(screen.getByText(/1 dia/i)).toBeInTheDocument();
    expect(screen.getByText(/complexidade/i)).toBeInTheDocument();
  });

  it("renders JobDetailMetadataBadges empty when no metadata", () => {
    const job = createMinimalJob({
      estimated_duration_hint: null,
      scope_complexity: null,
    });
    const { container } = render(<JobDetailMetadataBadges job={job} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders JobDetailRequestSections with gallery and tags", () => {
    const job = createMinimalJob({
      photos: ["a.jpg", "b.jpg"],
      tags: ["tag1"],
    });
    const eq = mapSuggestedEquipmentToPt(job.suggested_equipment);
    const mat = mapSuggestedMaterialsToPt(job.suggested_materials);
    render(<JobDetailRequestSections job={job} suggestedEquipmentPt={eq} suggestedMaterialsPt={mat} />);
    expect(screen.getByText(/descrição/i)).toBeInTheDocument();
    expect(screen.getByText(/fotos \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText("tag1")).toBeInTheDocument();
  });

  it("renders JobDetailFloatingActions and fires callbacks", () => {
    const onAsk = vi.fn();
    const onProposal = vi.fn();
    render(
      <JobDetailFloatingActions
        isInsideSheet
        onAskQuestion={onAsk}
        onOpenProposalComposer={onProposal}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /fazer orçamento/i }));
    expect(onProposal).toHaveBeenCalled();
  });

  it("renders JobQuestionPromptCard with suggested questions", async () => {
    const onAsk = vi.fn();
    const onUse = vi.fn();
    render(
      <JobQuestionPromptCard
        suggestedQuestions={["Pergunta A"]}
        onAskQuestion={onAsk}
        onUseSuggestedQuestion={onUse}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /fazer pergunta/i }));
    expect(onAsk).toHaveBeenCalled();
    fireEvent.click(screen.getByText(/ver perguntas sugeridas/i));
    await waitFor(() => {
      expect(screen.getByText("Pergunta A")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /usar pergunta sugerida/i }));
    expect(onUse).toHaveBeenCalledWith("Pergunta A");
  });
});

describe("JobQuestionsFeed", () => {
  beforeEach(() => {
    mockQuestions.mockReset();
  });

  it("shows loading", () => {
    mockQuestions.mockReturnValue({
      items: [],
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    render(<JobQuestionsFeed serviceRequestId="sr-1" />);
    expect(screen.getByText(/carregando perguntas/i)).toBeInTheDocument();
  });

  it("shows error with retry", () => {
    const refetch = vi.fn();
    mockQuestions.mockReturnValue({
      items: [],
      isLoading: false,
      isError: true,
      refetch,
    });
    render(<JobQuestionsFeed serviceRequestId="sr-1" />);
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("lists questions", () => {
    mockQuestions.mockReturnValue({
      items: [
        {
          id: "q1",
          question: "Oi?",
          client_response: "Sim",
          client_response_images: [],
          created_at: "2026-03-20T10:00:00.000Z",
          client_responded_at: "2026-03-20T11:00:00.000Z",
          is_own_question: true,
          provider_first_name: "Ana",
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<JobQuestionsFeed serviceRequestId="sr-1" />);
    expect(screen.getByText("Oi?")).toBeInTheDocument();
    expect(screen.getByText("Sim")).toBeInTheDocument();
  });

  it("renders signed URLs for client response images", () => {
    mockQuestions.mockReturnValue({
      items: [
        {
          id: "q1",
          question: "Manda foto?",
          client_response: "",
          client_response_images: ["clients/x/question-responses/sr/q/1.jpg"],
          created_at: "2026-03-20T10:00:00.000Z",
          client_responded_at: "2026-03-20T11:00:00.000Z",
          is_own_question: true,
          provider_first_name: "Ana",
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<JobQuestionsFeed serviceRequestId="sr-1" />);
    expect(screen.getByRole("img", { name: /imagem da resposta 1/i })).toHaveAttribute(
      "src",
      "https://signed.test/0.jpg",
    );
  });
});

describe("ProviderProposalPhotosGrid", () => {
  it("returns null when not loading and no urls", () => {
    const { container } = render(
      <ProviderProposalPhotosGrid isLoading={false} urls={[]} fallbackPhotos={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows skeletons while loading", () => {
    render(
      <ProviderProposalPhotosGrid
        isLoading
        urls={[]}
        fallbackPhotos={["a", "b"]}
      />,
    );
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("renders images", () => {
    render(
      <ProviderProposalPhotosGrid
        isLoading={false}
        urls={["https://x/1.jpg"]}
        fallbackPhotos={[]}
      />,
    );
    expect(screen.getByRole("img", { name: /foto do orçamento 1/i })).toBeInTheDocument();
  });
});

const baseProposal: ProviderProposalHistoryItem = {
  id: "p1",
  proposed_amount: 100,
  proposal_description: "Desc",
  proposal_duration_value: 2,
  proposal_duration_unit: "days",
  proposal_suggested_slots: [
    { start_date: "2026-04-01", end_date: "2026-04-02", shift: "morning" },
  ],
  status: "rejected",
  tax_rate: 0.1,
  tax_amount: 10,
  final_amount: 90,
  photos: ["path/a.jpg"],
  created_at: "2026-03-20T10:00:00.000Z",
  updated_at: "2026-03-20T10:00:00.000Z",
  client_rejection_response: "Muito caro",
};

describe("ProviderProposalDetailsDialog", () => {
  beforeEach(() => {
    mockProposalPhotoUrls.mockReturnValue({ urls: ["https://signed/a.jpg"], isLoading: false });
  });

  it("renders proposal fields when open", () => {
    const onChange = vi.fn();
    render(
      <ProviderProposalDetailsDialog proposal={baseProposal} onOpenChange={onChange} />,
    );
    expect(screen.getByText(/detalhes do orçamento/i)).toBeInTheDocument();
    expect(screen.getByText(/muito caro/i)).toBeInTheDocument();
  });
});

describe("ProviderProposalHistoryAccordion", () => {
  it("notifies parent when accordion opens from closed state", () => {
    const onOpen = vi.fn();
    render(
      <ProviderProposalHistoryAccordion
        historyOpen={false}
        proposalHistory={[]}
        isHistoryLoading={false}
        isHistoryError={false}
        onHistoryOpenChange={onOpen}
        onProposalSelect={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/ver histórico de orçamentos/i));
    expect(onOpen).toHaveBeenCalledWith(true);
  });

  it("covers loading, error, empty, and list states", () => {
    const { rerender } = render(
      <ProviderProposalHistoryAccordion
        historyOpen
        proposalHistory={[]}
        isHistoryLoading
        isHistoryError={false}
        onHistoryOpenChange={vi.fn()}
        onProposalSelect={vi.fn()}
      />,
    );
    expect(document.querySelector(".animate-pulse")).toBeTruthy();

    rerender(
      <ProviderProposalHistoryAccordion
        historyOpen
        proposalHistory={[]}
        isHistoryLoading={false}
        isHistoryError
        onHistoryOpenChange={vi.fn()}
        onProposalSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/não foi possível carregar o histórico/i)).toBeInTheDocument();

    rerender(
      <ProviderProposalHistoryAccordion
        historyOpen
        proposalHistory={[]}
        isHistoryLoading={false}
        isHistoryError={false}
        onHistoryOpenChange={vi.fn()}
        onProposalSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/nenhum orçamento encontrado/i)).toBeInTheDocument();

    const onSelect = vi.fn();
    rerender(
      <ProviderProposalHistoryAccordion
        historyOpen
        proposalHistory={[baseProposal]}
        isHistoryLoading={false}
        isHistoryError={false}
        onHistoryOpenChange={vi.fn()}
        onProposalSelect={onSelect}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /ver detalhes do orçamento/i }),
    );
    expect(onSelect).toHaveBeenCalledWith(baseProposal);
  });
});

describe("JobQuestionComposerDialog", () => {
  it("submits valid question", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onDraft = vi.fn();
    const onOpen = vi.fn();
    render(
      <JobQuestionComposerDialog
        open
        questionDraft=""
        isSubmitting={false}
        maxQuestionLength={1000}
        onOpenChange={onOpen}
        onQuestionDraftChange={onDraft}
        onSubmit={onSubmit}
      />,
    );
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Minha dúvida" } });
    fireEvent.click(screen.getByRole("button", { name: /^enviar pergunta$/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });
});

const defaultComposerProps = {
  open: true,
  isSubmitting: false,
  isPricingLoading: false,
  priceInput: "100",
  descriptionDraft: "Descrição do serviço",
  durationValueInput: "1",
  durationUnit: "hours" as const,
  availabilitySlots: [
    { startDate: "2099-06-01", endDate: "", shift: "morning" as const },
  ],
  existingPhotoUrls: [] as string[],
  newPhotos: [] as File[],
  photosCount: 0,
  pricing: {
    original_amount: 100,
    tax_rate: 0.1,
    tax_amount: 10,
    final_amount: 90,
    pricing_signature: "sig",
  },
  maxDescriptionLength: 1200,
  maxPhotos: 5,
  canSubmit: true,
  onOpenChange: vi.fn(),
  onPriceInputChange: vi.fn(),
  onDescriptionDraftChange: vi.fn(),
  onDurationValueInputChange: vi.fn(),
  onDurationUnitChange: vi.fn(),
  onAvailabilitySlotChange: vi.fn(),
  onAvailabilitySlotAdd: vi.fn(),
  onAvailabilitySlotRemove: vi.fn(),
  onPhotoAdd: vi.fn(),
  onExistingPhotoRemove: vi.fn(),
  onNewPhotoRemove: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue(undefined),
};

describe("ProviderProposalComposerDialog", () => {
  it("renders and submits when canSubmit", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enviar orçamento/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it("shows validation errors when required fields are empty", async () => {
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        canSubmit
        priceInput=""
        descriptionDraft=""
        pricing={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enviar orçamento/i }));
    await waitFor(() => {
      expect(screen.getByText(/informe quanto você quer cobrar/i)).toBeInTheDocument();
    });
  });

  it("switches to days and shows end date field", () => {
    const onUnit = vi.fn();
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        durationUnit="days"
        onDurationUnitChange={onUnit}
      />,
    );
    expect(screen.getByLabelText(/^fim$/i)).toBeInTheDocument();
  });

  it("shows inclusive range hint error when end date is before start", () => {
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        durationUnit="days"
        availabilitySlots={[
          { startDate: "2099-06-10", endDate: "2099-06-01", shift: "morning" },
        ]}
      />,
    );
    expect(
      screen.getByText(/data final não pode ser anterior à inicial/i),
    ).toBeInTheDocument();
  });

  it("shows pricing skeleton while loading", () => {
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        isPricingLoading
        pricing={null}
      />,
    );
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("calls onOpenChange(false) when cancel is pressed", () => {
    const onOpenChange = vi.fn();
    render(
      <ProviderProposalComposerDialog {...defaultComposerProps} onOpenChange={onOpenChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows submitting label while request is in flight", () => {
    render(<ProviderProposalComposerDialog {...defaultComposerProps} isSubmitting />);
    expect(screen.getByText(/^enviando/i)).toBeInTheDocument();
  });

  it("shows inclusive day range hint when dates are valid in days mode", () => {
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        durationUnit="days"
        durationValueInput="2"
        availabilitySlots={[
          { startDate: "2099-06-01", endDate: "2099-06-02", shift: "morning" },
        ]}
      />,
    );
    expect(screen.getByText(/intervalo: 2 dias/i)).toBeInTheDocument();
  });

  it("shows singular day label for a one-day range", () => {
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        durationUnit="days"
        durationValueInput="1"
        availabilitySlots={[
          { startDate: "2099-06-05", endDate: "2099-06-05", shift: "morning" },
        ]}
      />,
    );
    expect(screen.getByText(/intervalo: 1 dia/i)).toBeInTheDocument();
  });

  it("surfaces missing end date error for days mode on submit", async () => {
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        durationUnit="days"
        durationValueInput="2"
        availabilitySlots={[
          { startDate: "2099-06-01", endDate: "", shift: "morning" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enviar orçamento/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/informe a data de fim para orçamentos em dias/i),
      ).toBeInTheDocument();
    });
  });

  it("surfaces invalid end date error", async () => {
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        durationUnit="days"
        durationValueInput="1"
        availabilitySlots={[
          { startDate: "2099-06-01", endDate: "not-a-date", shift: "morning" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enviar orçamento/i }));
    await waitFor(() => {
      expect(screen.getByText(/data de fim inválida/i)).toBeInTheDocument();
    });
  });

  it("rejects start dates before today", async () => {
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        availabilitySlots={[
          { startDate: "2000-01-01", endDate: "", shift: "morning" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enviar orçamento/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/data de início não pode ser anterior à data atual/i),
      ).toBeInTheDocument();
    });
  });

  it("rejects invalid start date values", async () => {
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        availabilitySlots={[
          { startDate: "invalid", endDate: "", shift: "morning" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enviar orçamento/i }));
    await waitFor(() => {
      expect(screen.getByText(/data de início inválida/i)).toBeInTheDocument();
    });
  });

  it("requires at least one availability option", async () => {
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        availabilitySlots={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enviar orçamento/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/informe entre 1 e 3 opções de disponibilidade/i),
      ).toBeInTheDocument();
    });
  });

  it("flags when inclusive days do not match duration value", async () => {
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        durationUnit="days"
        durationValueInput="3"
        availabilitySlots={[
          { startDate: "2099-06-01", endDate: "2099-06-02", shift: "morning" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enviar orçamento/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/o intervalo deve ter exatamente 3 dias/i),
      ).toBeInTheDocument();
    });
  });

  it("uses singular dia when duration is one day but range mismatches", async () => {
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        durationUnit="days"
        durationValueInput="1"
        availabilitySlots={[
          { startDate: "2099-06-01", endDate: "2099-06-03", shift: "morning" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enviar orçamento/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/o intervalo deve ter exatamente 1 dia\b/i),
      ).toBeInTheDocument();
    });
  });

  it("notifies parent when photos are chosen", () => {
    const onPhotoAdd = vi.fn();
    render(
      <ProviderProposalComposerDialog {...defaultComposerProps} onPhotoAdd={onPhotoAdd} />,
    );
    const input = document.getElementById("proposal-photos") as HTMLInputElement;
    const file = new File(["x"], "shot.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onPhotoAdd).toHaveBeenCalled();
  });

  it("removes an existing proposal photo", () => {
    const onExistingPhotoRemove = vi.fn();
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        existingPhotoUrls={["https://example.com/p.jpg"]}
        onExistingPhotoRemove={onExistingPhotoRemove}
      />,
    );
    const dialog = screen.getByRole("dialog");
    const removers = within(dialog).getAllByRole("button", { name: /^remover$/i });
    const enabled = removers.filter((b) => !(b as HTMLButtonElement).disabled);
    fireEvent.click(enabled[0]);
    expect(onExistingPhotoRemove).toHaveBeenCalledWith(0);
  });

  it("removes a newly attached photo", () => {
    const onNewPhotoRemove = vi.fn();
    const file = new File(["x"], "new.png", { type: "image/png" });
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        newPhotos={[file]}
        photosCount={1}
        onNewPhotoRemove={onNewPhotoRemove}
      />,
    );
    const dialog = screen.getByRole("dialog");
    const removers = within(dialog).getAllByRole("button", { name: /^remover$/i });
    const enabled = removers.filter((b) => !(b as HTMLButtonElement).disabled);
    fireEvent.click(enabled[0]);
    expect(onNewPhotoRemove).toHaveBeenCalledWith(0);
  });

  it("requests another availability row when under the limit", () => {
    const onAvailabilitySlotAdd = vi.fn();
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        onAvailabilitySlotAdd={onAvailabilitySlotAdd}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /adicionar opção/i }));
    expect(onAvailabilitySlotAdd).toHaveBeenCalled();
  });

  it("disables add option when three slots exist", () => {
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        availabilitySlots={[
          { startDate: "2099-06-01", endDate: "", shift: "morning" },
          { startDate: "2099-06-02", endDate: "", shift: "afternoon" },
          { startDate: "2099-06-03", endDate: "", shift: "full_day" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /adicionar opção/i })).toBeDisabled();
  });

  it("removes a slot when more than one exists", () => {
    const onAvailabilitySlotRemove = vi.fn();
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        availabilitySlots={[
          { startDate: "2099-06-01", endDate: "", shift: "morning" },
          { startDate: "2099-06-02", endDate: "", shift: "afternoon" },
        ]}
        onAvailabilitySlotRemove={onAvailabilitySlotRemove}
      />,
    );
    const removeButtons = screen.getAllByRole("button", { name: /^remover$/i });
    fireEvent.click(removeButtons[removeButtons.length - 1]);
    expect(onAvailabilitySlotRemove).toHaveBeenCalled();
  });

  it("fires duration unit change handler", () => {
    const onDurationUnitChange = vi.fn();
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        onDurationUnitChange={onDurationUnitChange}
      />,
    );
    fireEvent.change(screen.getByLabelText(/^unidade$/i), {
      target: { value: "days" },
    });
    expect(onDurationUnitChange).toHaveBeenCalledWith("days");
  });

  it("blocks submit when duration is not a positive integer", async () => {
    render(
      <ProviderProposalComposerDialog
        {...defaultComposerProps}
        durationValueInput="0"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enviar orçamento/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/tempo estimado deve ser maior que zero/i),
      ).toBeInTheDocument();
    });
  });
});
