// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderSettlements } from "../useProviderSettlements";
import * as settlementsApi from "../../api/settlements.api";
import type { PaginatedSettlementMovements, SettlementMovement } from "../../types/settlements.types";

vi.mock("../../api/settlements.api", () => ({
  listProviderSettlements: vi.fn(),
}));

const listProviderSettlements = vi.mocked(settlementsApi.listProviderSettlements);

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function makePage(
  overrides: Partial<PaginatedSettlementMovements> = {},
): PaginatedSettlementMovements {
  return {
    items: overrides.items ?? [],
    total_count: overrides.total_count ?? 0,
    page: overrides.page ?? 1,
    page_size: overrides.page_size ?? 20,
  };
}

const sampleItem: SettlementMovement = {
  id: "m-1",
  paymentScheduleId: "sched-1",
  providerId: "prov-1",
  gatewaySlug: "netcred",
  gatewayPayoutId: "payout-1",
  gatewayMovementId: "mov-1",
  gatewayTransactionId: "tx-1",
  payoutStatus: "PENDING",
  movementStatus: "PENDING",
  movementType: "CARD_PAYMENT",
  movementSource: "TRANSACTION",
  recordType: "CREDIT",
  installment: 1,
  grossAmount: 100,
  netAmount: 95,
  baseSettleDate: "2026-06-15",
  settlingAt: "2026-06-15",
  settledAt: null,
  isAdvance: false,
  isRefundClawback: false,
  brand: null,
  bankAccountMask: null,
  syncSource: "webhook",
  syncedAt: "2026-06-01T00:00:00.000Z",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

describe("useProviderSettlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads first page and exposes items", async () => {
    listProviderSettlements.mockResolvedValue({
      data: makePage({ items: [sampleItem], total_count: 1 }),
      error: null,
    });

    const { result } = renderHook(() => useProviderSettlements({ filterId: "all" }), {
      wrapper: wrapperFor(createClient()),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listProviderSettlements).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      movementStatus: null,
      recordType: null,
    });
    expect(result.current.items).toEqual([sampleItem]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("applies pending filter and paginates", async () => {
    listProviderSettlements
      .mockResolvedValueOnce({
        data: makePage({
          items: [sampleItem],
          total_count: 25,
          page: 1,
          page_size: 20,
        }),
        error: null,
      })
      .mockResolvedValueOnce({
        data: makePage({
          items: [{ ...sampleItem, id: "m-2" }],
          total_count: 25,
          page: 2,
          page_size: 20,
        }),
        error: null,
      });

    const { result } = renderHook(() => useProviderSettlements({ filterId: "pending" }), {
      wrapper: wrapperFor(createClient()),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listProviderSettlements).toHaveBeenCalledWith(
      expect.objectContaining({ movementStatus: "PENDING", recordType: null }),
    );
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(listProviderSettlements).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it("applies debit filter", async () => {
    listProviderSettlements.mockResolvedValue({
      data: makePage(),
      error: null,
    });

    const { result } = renderHook(() => useProviderSettlements({ filterId: "debit" }), {
      wrapper: wrapperFor(createClient()),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listProviderSettlements).toHaveBeenCalledWith(
      expect.objectContaining({ movementStatus: null, recordType: "DEBIT" }),
    );
  });

  it("surfaces error state", async () => {
    listProviderSettlements.mockResolvedValue({
      data: null,
      error: "boom",
    });

    const { result } = renderHook(() => useProviderSettlements(), {
      wrapper: wrapperFor(createClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.items).toEqual([]);
  });

  it("throws fallback message when API returns null data without error", async () => {
    listProviderSettlements.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => useProviderSettlements({ filterId: "all" }), {
      wrapper: wrapperFor(createClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("does not fetch when enabled is false", async () => {
    const { result } = renderHook(() => useProviderSettlements({ enabled: false }), {
      wrapper: wrapperFor(createClient()),
    });

    expect(listProviderSettlements).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("refetch triggers another settlements request", async () => {
    listProviderSettlements.mockResolvedValue({
      data: makePage({ items: [sampleItem], total_count: 1 }),
      error: null,
    });

    const { result } = renderHook(() => useProviderSettlements({ filterId: "paid_out" }), {
      wrapper: wrapperFor(createClient()),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(listProviderSettlements).toHaveBeenCalledTimes(1);

    result.current.refetch();

    await waitFor(() => expect(listProviderSettlements).toHaveBeenCalledTimes(2));
    expect(listProviderSettlements).toHaveBeenLastCalledWith(
      expect.objectContaining({ movementStatus: "PAID_OUT", recordType: null }),
    );
  });
});
