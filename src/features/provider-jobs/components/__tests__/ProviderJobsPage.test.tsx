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
}));

vi.mock("../../hooks/useProviderLocation", () => ({
  useProviderLocation: () => mocks.location,
}));

vi.mock("../../hooks/useProviderJobs", () => ({
  useProviderJobs: () => mocks.jobs,
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
    mocks.jobs.isLoading = false;
    mocks.jobs.isError = false;
    mocks.jobs.items = [];
    mocks.jobs.hasNextPage = false;
    mocks.location.isUsingDefault = false;
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
});
