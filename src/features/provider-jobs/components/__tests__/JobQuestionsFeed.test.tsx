import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobQuestionsFeed } from "../JobQuestionsFeed";

const mockUseProviderJobQuestions = vi.fn();
const mockUseQuestionResponseImageUrls = vi.fn();

vi.mock("../../hooks/useProviderJobQuestions", () => ({
  useProviderJobQuestions: (id: string) => mockUseProviderJobQuestions(id),
}));

vi.mock("@/features/client-budgets/hooks/useQuestionResponseImageUrls", () => ({
  useQuestionResponseImageUrls: (paths: string[]) =>
    mockUseQuestionResponseImageUrls(paths),
}));

describe("JobQuestionsFeed", () => {
  it("shows loading copy while questions load", () => {
    mockUseProviderJobQuestions.mockReturnValue({
      items: [],
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    render(<JobQuestionsFeed serviceRequestId="sr-1" />);
    expect(screen.getByText(/carregando perguntas/i)).toBeInTheDocument();
  });

  it("shows error state and refetches when retry is clicked", () => {
    const refetch = vi.fn();
    mockUseProviderJobQuestions.mockReturnValue({
      items: [],
      isLoading: false,
      isError: true,
      refetch,
    });

    render(<JobQuestionsFeed serviceRequestId="sr-1" />);
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows empty message when there are no questions", () => {
    mockUseProviderJobQuestions.mockReturnValue({
      items: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<JobQuestionsFeed serviceRequestId="sr-2" />);
    expect(screen.getByText(/ainda não há perguntas/i)).toBeInTheDocument();
  });

  it("renders own-question badge and client response block", () => {
    mockUseProviderJobQuestions.mockReturnValue({
      items: [
        {
          id: "q1",
          is_own_question: true,
          provider_first_name: null,
          created_at: "2026-04-01T12:00:00.000Z",
          question: "Qual o prazo?",
          client_response: "Até sexta.",
          client_response_images: [],
          client_responded_at: "2026-04-02T10:00:00.000Z",
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseQuestionResponseImageUrls.mockReturnValue({ urls: [], isLoading: false });

    render(<JobQuestionsFeed serviceRequestId="sr-3" />);
    expect(screen.getByText(/pergunta feita por você/i)).toBeInTheDocument();
    expect(screen.getByText("Até sexta.")).toBeInTheDocument();
    expect(screen.getByText(/respondida em/i)).toBeInTheDocument();
  });

  it("renders other provider label when not own question", () => {
    mockUseProviderJobQuestions.mockReturnValue({
      items: [
        {
          id: "q2",
          is_own_question: false,
          provider_first_name: "Ana",
          created_at: "2026-04-01T12:00:00.000Z",
          question: "Inclui material?",
          client_response: null,
          client_response_images: ["img/a.jpg"],
          client_responded_at: null,
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseQuestionResponseImageUrls.mockReturnValue({
      urls: ["https://signed.example/a.jpg"],
      isLoading: false,
    });

    render(<JobQuestionsFeed serviceRequestId="sr-4" />);
    expect(screen.getByText(/pergunta de ana/i)).toBeInTheDocument();
    const img = screen.getByRole("img", { name: /imagem da resposta 1/i });
    expect(img).toHaveAttribute("src", "https://signed.example/a.jpg");
    fireEvent.error(img);
  });

  it("shows skeleton placeholders while response images load", () => {
    mockUseProviderJobQuestions.mockReturnValue({
      items: [
        {
          id: "q3",
          is_own_question: true,
          provider_first_name: null,
          created_at: "2026-04-01T12:00:00.000Z",
          question: "Fotos?",
          client_response: null,
          client_response_images: ["/p1.jpg", "/p2.jpg"],
          client_responded_at: null,
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseQuestionResponseImageUrls.mockReturnValue({ urls: [], isLoading: true });

    const { container } = render(<JobQuestionsFeed serviceRequestId="sr-5" />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("omits image section when urls resolve empty", () => {
    mockUseProviderJobQuestions.mockReturnValue({
      items: [
        {
          id: "q4",
          is_own_question: true,
          provider_first_name: null,
          created_at: "2026-04-01T12:00:00.000Z",
          question: "Só texto",
          client_response: "Ok",
          client_response_images: ["/x.jpg"],
          client_responded_at: null,
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    mockUseQuestionResponseImageUrls.mockReturnValue({ urls: [], isLoading: false });

    render(<JobQuestionsFeed serviceRequestId="sr-6" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("uses fallback professional label when provider name is missing", () => {
    mockUseProviderJobQuestions.mockReturnValue({
      items: [
        {
          id: "q5",
          is_own_question: false,
          provider_first_name: null,
          created_at: "2026-04-01T12:00:00.000Z",
          question: "Horário?",
          client_response: null,
          client_response_images: [],
          client_responded_at: null,
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<JobQuestionsFeed serviceRequestId="sr-7" />);
    expect(screen.getByText(/pergunta de profissional/i)).toBeInTheDocument();
  });
});
