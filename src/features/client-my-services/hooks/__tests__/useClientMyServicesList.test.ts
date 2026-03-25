import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/features/auth";
import { useClientMyServicesList } from "../useClientMyServicesList";
import * as serviceRequestsApi from "../../api/serviceRequests.api";
import * as mapper from "../../utils/serviceRequestCardMapper";
import type { ServiceRequestCardModel } from "../../types/client-my-services.types";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(() => ({ user: { id: "client-1" } })),
}));

vi.mock("../../api/serviceRequests.api", () => ({
  listServiceRequests: vi.fn(),
}));

vi.mock("../../utils/serviceRequestCardMapper", () => ({
  mapToServiceRequestCardModel: vi.fn(),
}));

const listServiceRequests = vi.mocked(serviceRequestsApi.listServiceRequests);
const mapToServiceRequestCardModel = vi.mocked(mapper.mapToServiceRequestCardModel);

const baseParams = {
  statusTabId: "all" as const,
  search: "",
  categoryId: null as string | null,
  cityName: null as string | null,
  neighborhoodName: null as string | null,
  dateFrom: null as string | null,
  dateTo: null as string | null,
  hasProposals: null as boolean | null,
  hasImages: null as boolean | null,
  serviceRequestId: null as string | null,
};

const cardModel: ServiceRequestCardModel = {
  id: "sr-1",
  title: "Job",
  description: null,
  descriptionPreview: "",
  formData: null,
  formSchema: null,
  status: "open",
  statusTabId: "waiting_proposals",
  createdAt: "2025-03-01T00:00:00Z",
  updatedAt: "2025-03-01T00:00:00Z",
  address: null,
  service: null,
  photoPaths: [],
};

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useClientMyServicesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mapToServiceRequestCardModel.mockImplementation(() => cardModel);
  });

  it("maps API items and exposes totalCount", async () => {
    listServiceRequests.mockResolvedValue({
      data: {
        items: [{ id: "sr-1" } as never],
        total_count: 5,
        page: 1,
        page_size: 20,
      },
      error: null,
    });

    const { result } = renderHook(
      () => useClientMyServicesList(baseParams),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe("sr-1");
    expect(result.current.totalCount).toBe(5);
    expect(listServiceRequests).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "client-1", page: 1, pageSize: 20 })
    );
  });

  it("sets isError when API returns error", async () => {
    listServiceRequests.mockResolvedValue({ data: null, error: "fail" });

    const { result } = renderHook(
      () => useClientMyServicesList(baseParams),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("fetchNextPage loads the following page", async () => {
    listServiceRequests
      .mockResolvedValueOnce({
        data: {
          items: [{ id: "p1" } as never],
          total_count: 25,
          page: 1,
          page_size: 20,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ id: "p2" } as never],
          total_count: 25,
          page: 2,
          page_size: 20,
        },
        error: null,
      });

    const { result } = renderHook(() => useClientMyServicesList(baseParams), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(listServiceRequests).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 })
    );
  });

  it("does not fetch when clientId is missing", () => {
    vi.mocked(useAuth).mockReturnValueOnce({ user: null } as never);

    listServiceRequests.mockResolvedValue({
      data: { items: [], total_count: 0, page: 1, page_size: 20 },
      error: null,
    });

    const { result } = renderHook(() => useClientMyServicesList(baseParams), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(listServiceRequests).not.toHaveBeenCalled();
  });
});
