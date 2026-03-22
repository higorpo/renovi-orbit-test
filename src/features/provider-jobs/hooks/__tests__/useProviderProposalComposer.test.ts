import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useProviderProposalComposer } from "../useProviderProposalComposer";
import * as providerProposalsApi from "../../api/providerProposals.api";

vi.mock("../../api/providerProposals.api", () => ({
  calculateProviderServicePricing: vi.fn(),
  createProviderProposal: vi.fn(),
  uploadProviderProposalPhotos: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const calculateProviderServicePricing = vi.mocked(
  providerProposalsApi.calculateProviderServicePricing,
);
const createProviderProposal = vi.mocked(providerProposalsApi.createProviderProposal);
const uploadProviderProposalPhotos = vi.mocked(providerProposalsApi.uploadProviderProposalPhotos);

function createWrapper() {
  const queryClient = new QueryClient();
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useProviderProposalComposer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces pricing calculation by 1.5s", async () => {
    calculateProviderServicePricing.mockResolvedValue({
      data: {
        original_amount: 500,
        tax_rate: 0.15,
        tax_amount: 75,
        final_amount: 425,
        pricing_signature: "sig-123",
      },
      error: null,
    });

    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("500");
    });

    expect(calculateProviderServicePricing).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1400);
    });
    expect(calculateProviderServicePricing).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(calculateProviderServicePricing).toHaveBeenCalledWith(500);
    expect(result.current.pricing?.final_amount).toBe(425);
  });

  it("submits proposal when pricing and form are valid", async () => {
    calculateProviderServicePricing.mockResolvedValue({
      data: {
        original_amount: 500,
        tax_rate: 0.15,
        tax_amount: 75,
        final_amount: 425,
        pricing_signature: "sig-123",
      },
      error: null,
    });
    uploadProviderProposalPhotos.mockResolvedValue({ paths: [], error: null });
    createProviderProposal.mockResolvedValue({
      data: { id: "proposal-1" },
      error: null,
    });

    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("500");
      result.current.setDescriptionDraft("Posso executar com garantia e nota.");
      result.current.setDurationValueInput("5");
      result.current.updateAvailabilitySlot(0, "startDate", "2026-03-25");
      result.current.updateAvailabilitySlot(0, "shift", "morning");
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await act(async () => {
      await result.current.submitProposal();
    });

    expect(createProviderProposal).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Orçamento enviado com sucesso.");
    expect(result.current.isOpen).toBe(false);
  });

  it("shows toast when pricing calculation returns error", async () => {
    calculateProviderServicePricing.mockResolvedValue({
      data: null,
      error: "Tax service unavailable",
    });

    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("200");
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(toast.error).toHaveBeenCalledWith("Tax service unavailable");
    expect(result.current.pricing).toBeNull();
  });

  it("prefills composer in edit mode when existing proposal is passed", () => {
    const { result } = renderHook(
      () =>
        useProviderProposalComposer("sr-1", {
          proposedAmount: 350,
          description: "Texto anterior",
          durationValue: 2,
          durationUnit: "days",
          suggestedSlots: [
            {
              start_date: "2026-04-01",
              end_date: "2026-04-02",
              shift: "morning",
            },
          ],
          photos: ["path/a.jpg"],
        }),
      { wrapper: createWrapper() },
    );

    act(() => {
      result.current.openComposer({ mode: "edit" });
    });

    expect(result.current.descriptionDraft).toBe("Texto anterior");
    expect(result.current.durationUnit).toBe("days");
    expect(result.current.existingPhotoPaths).toEqual(["path/a.jpg"]);
    expect(result.current.availabilitySlots[0].startDate).toBe("2026-04-01");
  });

  it("rejects submit when description is empty", async () => {
    calculateProviderServicePricing.mockResolvedValue({
      data: {
        original_amount: 100,
        tax_rate: 0,
        tax_amount: 0,
        final_amount: 100,
        pricing_signature: "s",
      },
      error: null,
    });

    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("100");
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await act(async () => {
      await result.current.submitProposal();
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Descreva seu orçamento antes de enviar.",
    );
    expect(createProviderProposal).not.toHaveBeenCalled();
  });

  it("shows toast when photo upload fails", async () => {
    calculateProviderServicePricing.mockResolvedValue({
      data: {
        original_amount: 100,
        tax_rate: 0,
        tax_amount: 0,
        final_amount: 100,
        pricing_signature: "s",
      },
      error: null,
    });
    uploadProviderProposalPhotos.mockResolvedValue({
      paths: [],
      error: "Upload falhou",
    });

    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("100");
      result.current.setDescriptionDraft("Descrição ok");
      result.current.setDurationValueInput("1");
      result.current.updateAvailabilitySlot(0, "startDate", "2099-01-01");
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await act(async () => {
      await result.current.submitProposal();
    });

    expect(toast.error).toHaveBeenCalledWith("Upload falhou");
  });

  it("shows toast when createProviderProposal returns error", async () => {
    calculateProviderServicePricing.mockResolvedValue({
      data: {
        original_amount: 100,
        tax_rate: 0,
        tax_amount: 0,
        final_amount: 100,
        pricing_signature: "s",
      },
      error: null,
    });
    uploadProviderProposalPhotos.mockResolvedValue({ paths: [], error: null });
    createProviderProposal.mockResolvedValue({
      data: null,
      error: "Duplicate proposal",
    });

    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("100");
      result.current.setDescriptionDraft("Descrição ok");
      result.current.setDurationValueInput("1");
      result.current.updateAvailabilitySlot(0, "startDate", "2099-01-01");
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await act(async () => {
      await result.current.submitProposal();
    });

    expect(toast.error).toHaveBeenCalledWith("Duplicate proposal");
  });

  it("shows toast when addAvailabilitySlot exceeds limit", () => {
    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.openComposer();
      result.current.addAvailabilitySlot();
      result.current.addAvailabilitySlot();
      result.current.addAvailabilitySlot();
    });

    const lenBefore = result.current.availabilitySlots.length;
    act(() => {
      result.current.addAvailabilitySlot();
    });

    expect(result.current.availabilitySlots.length).toBe(lenBefore);
    expect(toast.error).toHaveBeenCalledWith(
      "Você pode sugerir no máximo 3 opções de data.",
    );
  });

  it("shows toast when removing the last availability slot", () => {
    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.openComposer();
      result.current.removeAvailabilitySlot(0);
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Informe pelo menos 1 opção de data.",
    );
  });

  it("fetches pricing inside submit when debounced pricing is still null", async () => {
    calculateProviderServicePricing.mockResolvedValue({
      data: {
        original_amount: 100,
        tax_rate: 0,
        tax_amount: 0,
        final_amount: 100,
        pricing_signature: "s",
      },
      error: null,
    });
    uploadProviderProposalPhotos.mockResolvedValue({ paths: [], error: null });
    createProviderProposal.mockResolvedValue({ data: { id: "p-new" }, error: null });

    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("100");
      result.current.setDescriptionDraft("Fazemos rápido.");
      result.current.setDurationValueInput("1");
      result.current.updateAvailabilitySlot(0, "startDate", "2099-06-01");
    });

    await act(async () => {
      await result.current.submitProposal();
    });

    expect(calculateProviderServicePricing).toHaveBeenCalledWith(100);
    expect(createProviderProposal).toHaveBeenCalled();
  });

  it("rejects days mode when date range does not match duration value", async () => {
    calculateProviderServicePricing.mockResolvedValue({
      data: {
        original_amount: 100,
        tax_rate: 0,
        tax_amount: 0,
        final_amount: 100,
        pricing_signature: "s",
      },
      error: null,
    });
    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("100");
      result.current.setDescriptionDraft("Ok");
      result.current.setDurationValueInput("2");
      result.current.setDurationUnit("days");
      result.current.updateAvailabilitySlot(0, "startDate", "2099-06-01");
      result.current.updateAvailabilitySlot(0, "endDate", "2099-06-01");
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await act(async () => {
      await result.current.submitProposal();
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Cada intervalo sugerido deve ter exatamente"),
    );
  });
});
