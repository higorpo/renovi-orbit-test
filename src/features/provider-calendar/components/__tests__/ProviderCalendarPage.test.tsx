import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ProviderCalendarPage } from "../ProviderCalendarPage";
import type { ScheduledServiceItem } from "../../types/provider-calendar.types";
import { ProviderCalendarEntryBanner } from "../ProviderCalendarEntryBanner";
import { ProviderCalendarErrorState } from "../ProviderCalendarErrorState";
import { ProviderCalendarSkeleton } from "../ProviderCalendarSkeleton";
import { ProviderCalendarHeader } from "../ProviderCalendarHeader";
import { CalendarServiceChip } from "../CalendarServiceChip";
import { CalendarMultiDayBar } from "../CalendarMultiDayBar";
import { CalendarListDaySection } from "../CalendarListDaySection";
import { ProviderCalendarListView } from "../ProviderCalendarListView";
import { ProviderCalendarGridView } from "../ProviderCalendarGridView";

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: vi.fn(() => false),
}));

vi.mock("../../hooks/useProviderCalendarPage", () => ({
  useProviderCalendarPage: vi.fn(),
}));

vi.mock("@/lib/utils/calendarDate", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils/calendarDate")>(
    "@/lib/utils/calendarDate",
  );
  return {
    ...actual,
    todayCalendarIso: () => "2026-06-15",
  };
});

const useBreakpointMd = vi.mocked(
  await import("@/hooks/useBreakpoint").then((m) => m.useBreakpointMd),
);
const useProviderCalendarPage = vi.mocked(
  await import("../../hooks/useProviderCalendarPage").then((m) => m.useProviderCalendarPage),
);

const sampleService: ScheduledServiceItem = {
  serviceRequestId: "sr-1",
  contractedServiceId: "cs-1",
  title: "Pintura",
  platformServiceTitle: "Pintor",
  platformServiceColorKey: "blue",
  scheduledStartDate: "2026-06-15",
  scheduledEndDate: "2026-06-15",
  scheduledShift: "morning",
  status: "PENDING_PAYMENT",
};

const multiDayService: ScheduledServiceItem = {
  ...sampleService,
  contractedServiceId: "cs-multi",
  serviceRequestId: "sr-multi",
  title: "Reforma",
  scheduledStartDate: "2026-06-10",
  scheduledEndDate: "2026-06-12",
};

function pageProviders({ children }: { children: ReactNode }) {
  const client = new QueryClient();
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function basePageResult(overrides: Record<string, unknown> = {}) {
  return {
    viewMode: "list" as const,
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
      weeks: [
        [
          "2026-05-31",
          "2026-06-01",
          "2026-06-02",
          "2026-06-03",
          "2026-06-04",
          "2026-06-05",
          "2026-06-06",
        ],
        [
          "2026-06-07",
          "2026-06-08",
          "2026-06-09",
          "2026-06-10",
          "2026-06-11",
          "2026-06-12",
          "2026-06-13",
        ],
      ],
      services: [] as ScheduledServiceItem[],
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
    ...overrides,
  };
}

describe("ProviderCalendarPage", () => {
  beforeEach(() => {
    useBreakpointMd.mockReturnValue(false);
    useProviderCalendarPage.mockReturnValue(basePageResult() as never);
  });

  it("hides page header on mobile and keeps agenda section", () => {
    render(<ProviderCalendarPage />, { wrapper: pageProviders });
    expect(screen.queryByRole("heading", { name: "Calendário" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Agenda de serviços")).toBeInTheDocument();
  });

  it("shows header on desktop", () => {
    useBreakpointMd.mockReturnValue(true);
    render(<ProviderCalendarPage />, { wrapper: pageProviders });
    expect(screen.getByRole("heading", { name: "Calendário" })).toBeInTheDocument();
  });

  it("renders skeleton while loading", () => {
    useProviderCalendarPage.mockReturnValue(
      basePageResult({ isLoading: true, viewMode: "list" }) as never,
    );
    render(<ProviderCalendarPage />, { wrapper: pageProviders });
    expect(screen.getByLabelText("Carregando agenda em lista")).toBeInTheDocument();
  });

  it("renders error state and retries", () => {
    const refetch = vi.fn();
    useProviderCalendarPage.mockReturnValue(
      basePageResult({ isLoading: false, isError: true, refetch }) as never,
    );
    render(<ProviderCalendarPage />, { wrapper: pageProviders });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("renders grid view on desktop mode", () => {
    useProviderCalendarPage.mockReturnValue(
      basePageResult({ viewMode: "grid" }) as never,
    );
    render(<ProviderCalendarPage />, { wrapper: pageProviders });
    expect(screen.getByText("Agenda mensal")).toBeInTheDocument();
    expect(screen.getByText("Junho de 2026")).toBeInTheDocument();
  });
});

describe("ProviderCalendarHeader", () => {
  it("returns null on mobile", () => {
    useBreakpointMd.mockReturnValue(false);
    const { container } = render(<ProviderCalendarHeader />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ProviderCalendarSkeleton", () => {
  it("renders list and grid skeletons", () => {
    const { rerender } = render(<ProviderCalendarSkeleton viewMode="list" />);
    expect(screen.getByLabelText("Carregando agenda em lista")).toBeInTheDocument();

    rerender(<ProviderCalendarSkeleton viewMode="grid" />);
    expect(screen.getByLabelText("Carregando agenda mensal")).toBeInTheDocument();
  });
});

describe("ProviderCalendarErrorState", () => {
  it("invokes retry callback", () => {
    const onRetry = vi.fn();
    render(<ProviderCalendarErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("ProviderCalendarEntryBanner", () => {
  it("links to the provider calendar route", () => {
    render(
      <MemoryRouter>
        <ProviderCalendarEntryBanner />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /Ver calendário de serviços/i })).toHaveAttribute(
      "href",
      "/dashboard/services/calendar",
    );
  });
});

describe("CalendarServiceChip", () => {
  it("shows span labels and opens on click", () => {
    const onOpen = vi.fn();
    const { rerender } = render(
      <CalendarServiceChip
        item={{ service: sampleService, spanPosition: "start" }}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByText("Início")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pintura/i }));
    expect(onOpen).toHaveBeenCalled();

    rerender(
      <CalendarServiceChip
        item={{ service: sampleService, spanPosition: "middle" }}
        onOpen={onOpen}
        compact
      />,
    );
    expect(screen.getByText("Continua")).toBeInTheDocument();

    rerender(
      <CalendarServiceChip
        item={{ service: sampleService, spanPosition: "end" }}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByText("Último dia")).toBeInTheDocument();
  });
});

describe("CalendarMultiDayBar", () => {
  it("opens service and applies continuation styles", () => {
    const onOpen = vi.fn();
    render(
      <CalendarMultiDayBar
        bar={{
          service: multiDayService,
          startCol: 1,
          span: 3,
          lane: 0,
          continuesFromPreviousWeek: true,
          continuesIntoNextWeek: true,
        }}
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Reforma/i }));
    expect(onOpen).toHaveBeenCalled();
  });
});

describe("CalendarListDaySection", () => {
  it("shows empty state and today badge", () => {
    render(
      <CalendarListDaySection
        entry={{ date: "2026-06-15", services: [] }}
        today="2026-06-15"
        onOpenService={vi.fn()}
      />,
    );
    expect(screen.getByText("Hoje")).toBeInTheDocument();
    expect(screen.getByText("Nenhum serviço agendado para este dia.")).toBeInTheDocument();
  });

  it("lists services and forwards open callback", () => {
    const onOpenService = vi.fn();
    render(
      <CalendarListDaySection
        entry={{
          date: "2026-06-14",
          services: [{ service: sampleService, spanPosition: "single" }],
        }}
        today="2026-06-15"
        onOpenService={onOpenService}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Pintura/i }));
    expect(onOpenService).toHaveBeenCalledWith("sr-1");
  });
});

describe("ProviderCalendarListView", () => {
  it("renders days, loading indicators, and opens matched services", () => {
    const onOpenService = vi.fn();
    const topSentinelRef = { current: null as HTMLDivElement | null };
    const bottomSentinelRef = { current: null as HTMLDivElement | null };

    render(
      <main>
        <ProviderCalendarListView
          list={{
            days: [
              {
                date: "2026-06-15",
                services: [{ service: sampleService, spanPosition: "single" }],
              },
            ],
            today: "2026-06-15",
            isLoading: false,
            isFetchingNextPage: true,
            isLoadingBackward: true,
            isError: false,
            refetch: vi.fn(),
            topSentinelRef,
            bottomSentinelRef,
          }}
          onOpenService={onOpenService}
        />
      </main>,
    );

    expect(screen.getByText("Carregando dias anteriores…")).toBeInTheDocument();
    expect(screen.getByText("Carregando próximos dias…")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pintura/i }));
    expect(onOpenService).toHaveBeenCalledWith(sampleService);
  });

  it("scrolls today section into view when main scroll root is missing", () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    render(
      <ProviderCalendarListView
        list={{
          days: [{ date: "2026-06-15", services: [] }],
          today: "2026-06-15",
          isLoading: false,
          isFetchingNextPage: false,
          isLoadingBackward: false,
          isError: false,
          refetch: vi.fn(),
          topSentinelRef: { current: null },
          bottomSentinelRef: { current: null },
        }}
        onOpenService={vi.fn()}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalled();
  });
});

describe("ProviderCalendarGridView", () => {
  it("navigates months and opens single-day and multi-day services", () => {
    const goToPreviousMonth = vi.fn();
    const goToNextMonth = vi.fn();
    const goToToday = vi.fn();
    const onOpenService = vi.fn();

    const singleA = {
      ...sampleService,
      contractedServiceId: "cs-a",
      title: "Serviço A",
      scheduledStartDate: "2026-06-10",
      scheduledEndDate: "2026-06-10",
    };
    const singleB = {
      ...sampleService,
      contractedServiceId: "cs-b",
      serviceRequestId: "sr-b",
      title: "Serviço B",
      scheduledStartDate: "2026-06-10",
      scheduledEndDate: "2026-06-10",
    };
    const singleC = {
      ...sampleService,
      contractedServiceId: "cs-c",
      serviceRequestId: "sr-c",
      title: "Serviço C",
      scheduledStartDate: "2026-06-10",
      scheduledEndDate: "2026-06-10",
    };

    render(
      <ProviderCalendarGridView
        month={{
          year: 2026,
          monthIndex: 5,
          monthLabel: "Junho de 2026",
          weeks: [
            [
              "2026-06-07",
              "2026-06-08",
              "2026-06-09",
              "2026-06-10",
              "2026-06-11",
              "2026-06-12",
              "2026-06-13",
            ],
          ],
          services: [multiDayService, singleA, singleB, singleC],
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
          goToPreviousMonth,
          goToNextMonth,
          goToToday,
        }}
        onOpenService={onOpenService}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Próximo mês" }));
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
    expect(goToPreviousMonth).toHaveBeenCalled();
    expect(goToNextMonth).toHaveBeenCalled();
    expect(goToToday).toHaveBeenCalled();

    expect(screen.getByText("+1 serviços")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reforma/i }));
    expect(onOpenService).toHaveBeenCalledWith(multiDayService);

    fireEvent.click(screen.getByRole("button", { name: /Serviço A/i }));
    expect(onOpenService).toHaveBeenCalledWith(singleA);
  });
});
