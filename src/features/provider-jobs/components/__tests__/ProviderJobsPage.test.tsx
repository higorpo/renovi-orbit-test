import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderJobsPage } from "../ProviderJobsPage";
import { createMinimalJob } from "../../__tests__/fixtures/jobFixtures";

const mocks = vi.hoisted(() => ({
  location: {
    location: { latitude: -27.5, longitude: -48.5 },
    error: null,
    isLoading: false,
    permissionDenied: false,
    insecureContext: false,
    hasFeedLocation: false,
    isUsingDefault: false,
    isNativeApp: false,
    retry: vi.fn(),
  },
  jobs: {
    items: [] as ReturnType<typeof createMinimalJob>[],
    isLoading: false,
    isFetchingNextPage: false,
    isError: false,
    error: null,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  },
  filters: {
    filters: {
      sortMode: "newest" as const,
    },
    setSortMode: vi.fn(),
    resetFilters: vi.fn(),
  },
  useProviderJobsArgs: [] as Array<{
    latitude: number | null;
    longitude: number | null;
    sortMode: string;
  }>,
}));

vi.mock("../../hooks/useProviderLocation", () => ({
  useProviderLocation: () => mocks.location,
}));

vi.mock("../../hooks/useProviderJobs", () => ({
  useProviderJobs: (args: {
    latitude: number | null;
    longitude: number | null;
    sortMode: string;
  }) => {
    mocks.useProviderJobsArgs.push(args);
    return mocks.jobs;
  },
}));

vi.mock("../../hooks/useProviderJobsFilters", () => ({
  useProviderJobsFilters: () => mocks.filters,
}));

vi.mock("../../hooks/useDismissOpportunity", () => ({
  useDismissOpportunity: () => ({
    dismissOpportunity: vi.fn(),
    dismissingId: null,
    isDismissing: false,
  }),
}));

describe("ProviderJobsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useProviderJobsArgs.length = 0;
    mocks.jobs.isLoading = false;
    mocks.jobs.isError = false;
    mocks.jobs.items = [];
    mocks.jobs.hasNextPage = false;
    mocks.location.isUsingDefault = false;
    mocks.location.hasFeedLocation = false;
    mocks.location.location = { latitude: -27.5, longitude: -48.5 };
    mocks.location.permissionDenied = false;
    mocks.location.insecureContext = false;
    mocks.location.isNativeApp = false;
    mocks.filters.filters.sortMode = "newest";
  });

  it("shows skeletons while loading", () => {
    mocks.jobs.isLoading = true;
    const { container } = render(
      <MemoryRouter>
        <ProviderJobsPage />
      </MemoryRouter>,
    );
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it("shows error state", () => {
    mocks.jobs.isError = true;
    render(
      <MemoryRouter>
        <ProviderJobsPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(mocks.jobs.refetch).toHaveBeenCalled();
  });

  it("shows empty state when no items", () => {
    render(
      <MemoryRouter>
        <ProviderJobsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/nenhuma oportunidade/i)).toBeInTheDocument();
  });

  it("shows list and load more", () => {
    mocks.jobs.items = [createMinimalJob({ service_request_id: "j1" })];
    mocks.jobs.hasNextPage = true;
    render(
      <MemoryRouter>
        <ProviderJobsPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByText(/instalar tomada/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /carregar mais/i }));
    expect(mocks.jobs.fetchNextPage).toHaveBeenCalled();
  });

  it("shows location banner when using default", () => {
    mocks.location.isUsingDefault = true;
    render(
      <MemoryRouter>
        <ProviderJobsPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByText(/localização aproximada/i).length).toBeGreaterThan(0);
  });

  it("shows permission-denied banner and wires retry", () => {
    mocks.location.isUsingDefault = true;
    mocks.location.permissionDenied = true;
    mocks.location.insecureContext = false;
    mocks.location.isNativeApp = false;
    render(
      <MemoryRouter>
        <ProviderJobsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/localização bloqueada no navegador/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /tentar novamente/i }));
    expect(mocks.location.retry).toHaveBeenCalled();
  });

  it("shows insecure-context banner copy when HTTPS is missing", () => {
    mocks.location.isUsingDefault = true;
    mocks.location.permissionDenied = true;
    mocks.location.insecureContext = true;
    render(
      <MemoryRouter>
        <ProviderJobsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/conexão sem https/i)).toBeInTheDocument();
  });

  it("shows native app permission-denied copy", () => {
    mocks.location.isUsingDefault = true;
    mocks.location.permissionDenied = true;
    mocks.location.insecureContext = false;
    mocks.location.isNativeApp = true;
    render(
      <MemoryRouter>
        <ProviderJobsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/localização bloqueada no app/i)).toBeInTheDocument();
  });

  it("falls back from nearest to newest when feed GPS is unavailable", () => {
    mocks.location.hasFeedLocation = false;
    mocks.filters.filters.sortMode = "nearest";

    render(
      <MemoryRouter>
        <ProviderJobsPage />
      </MemoryRouter>,
    );

    expect(mocks.filters.setSortMode).toHaveBeenCalledWith("newest");
  });

  it("passes feed coordinates to jobs hook when GPS is available", () => {
    mocks.location.hasFeedLocation = true;
    mocks.location.location = { latitude: -27.5, longitude: -48.5 };
    mocks.location.isUsingDefault = false;
    mocks.filters.filters.sortMode = "nearest";

    render(
      <MemoryRouter>
        <ProviderJobsPage />
      </MemoryRouter>,
    );

    expect(mocks.useProviderJobsArgs.at(-1)).toEqual({
      latitude: -27.5,
      longitude: -48.5,
      sortMode: "nearest",
    });
  });

  it("shows filtered empty state when active sort differs from default", () => {
    mocks.location.hasFeedLocation = true;
    mocks.filters.filters.sortMode = "least_competitive";
    mocks.jobs.items = [];

    render(
      <MemoryRouter>
        <ProviderJobsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/nenhum trabalho encontrado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /limpar filtros/i }));
    expect(mocks.filters.resetFilters).toHaveBeenCalled();
  });
});
