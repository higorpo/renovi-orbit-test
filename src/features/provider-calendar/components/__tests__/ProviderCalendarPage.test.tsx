import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProviderCalendarPage } from "../ProviderCalendarPage";

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: vi.fn(() => false),
}));

vi.mock("../../hooks/useProviderCalendarPage", () => ({
  useProviderCalendarPage: vi.fn(),
}));

const useProviderCalendarPage = vi.mocked(
  await import("../../hooks/useProviderCalendarPage").then((m) => m.useProviderCalendarPage),
);

function renderPage() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProviderCalendarPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProviderCalendarPage", () => {
  beforeEach(() => {
    useProviderCalendarPage.mockReturnValue({
      viewMode: "list",
      list: {
        days: [],
        today: "2026-06-15",
        isLoading: false,
        isFetchingNextPage: false,
        isLoadingBackward: false,
        isError: false,
        refetch: vi.fn(),
        topSentinelRef: { current: null },
        bottomSentinelRef: { current: null },
      },
      month: {
        year: 2026,
        monthIndex: 5,
        monthLabel: "Junho de 2026",
        weeks: [],
        services: [],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
        goToPreviousMonth: vi.fn(),
        goToNextMonth: vi.fn(),
        goToToday: vi.fn(),
      },
      handleOpenService: vi.fn(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("hides page header on mobile and keeps agenda section", () => {
    renderPage();
    expect(screen.queryByRole("heading", { name: "Calendário" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Agenda de serviços")).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Modo de visualização do calendário" }),
    ).not.toBeInTheDocument();
  });
});
