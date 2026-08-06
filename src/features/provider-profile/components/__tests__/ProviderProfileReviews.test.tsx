import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProviderProfileReviews } from "../ProviderProfileReviews";
import { usePublicProviderRatings } from "../../hooks/usePublicProviderRatings";

vi.mock("../../hooks/usePublicProviderRatings", () => ({
  usePublicProviderRatings: vi.fn(),
}));

const usePublicProviderRatingsMock = vi.mocked(usePublicProviderRatings);

function mockHook(
  overrides: Partial<ReturnType<typeof usePublicProviderRatings>> = {},
) {
  return {
    items: [],
    isLoading: false,
    isFetchingNextPage: false,
    isError: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  } as ReturnType<typeof usePublicProviderRatings>;
}

describe("ProviderProfileReviews", () => {
  beforeEach(() => {
    usePublicProviderRatingsMock.mockReset();
  });

  it("shows empty state when there are no ratings", () => {
    usePublicProviderRatingsMock.mockReturnValue(mockHook());
    render(<ProviderProfileReviews providerId="pid-1" />);
    expect(screen.getByText("Ainda sem avaliações")).toBeInTheDocument();
  });

  it("renders rating items and load more", () => {
    const fetchNextPage = vi.fn();
    usePublicProviderRatingsMock.mockReturnValue(
      mockHook({
        items: [
          {
            id: "r1",
            overall_score: 5,
            comment: "Excelente serviço",
            submitted_at: "2026-08-01T12:00:00Z",
          },
        ],
        hasNextPage: true,
        fetchNextPage,
      }),
    );

    render(<ProviderProfileReviews providerId="pid-1" />);
    expect(screen.getByText("Excelente serviço")).toBeInTheDocument();
    expect(screen.getByText("5.0")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /carregar mais/i }));
    expect(fetchNextPage).toHaveBeenCalledOnce();
  });

  it("shows error message when loading fails", () => {
    usePublicProviderRatingsMock.mockReturnValue(mockHook({ isError: true }));
    render(<ProviderProfileReviews providerId="pid-1" />);
    expect(
      screen.getByText(/não foi possível carregar as avaliações/i),
    ).toBeInTheDocument();
  });
});
