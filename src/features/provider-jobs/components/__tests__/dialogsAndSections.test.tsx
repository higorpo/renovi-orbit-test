import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMinimalJob } from "../../__tests__/fixtures/jobFixtures";
import { JobDetailFloatingActions } from "../JobDetailFloatingActions";
import { JobDetailMetadataBadges } from "../JobDetailMetadataBadges";
import { JobDetailRequestSections } from "../JobDetailRequestSections";
import { JobDetailSkeleton } from "../JobDetailSkeleton";
import { JobQuestionPromptCard } from "../JobQuestionPromptCard";
import { JobQuestionsFeed } from "../JobQuestionsFeed";
import { JobQuestionComposerDialog } from "../JobQuestionComposerDialog";
import { mapSuggestedEquipmentToPt, mapSuggestedMaterialsToPt } from "../../utils/suggestedItemsMapper";

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
vi.mock("@/features/negotiation-proposals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/negotiation-proposals")>();
  return {
    ...actual,
    useProposalPhotoUrls: () => mockProposalPhotoUrls(),
  };
});

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
