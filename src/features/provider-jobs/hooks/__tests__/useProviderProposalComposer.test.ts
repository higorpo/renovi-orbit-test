import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("useProviderProposalComposer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
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

    const { result } = renderHook(() => useProviderProposalComposer("sr-1"));

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

    const { result } = renderHook(() => useProviderProposalComposer("sr-1"));

    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("500");
      result.current.setDescriptionDraft("Posso executar com garantia e nota.");
    });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await act(async () => {
      await result.current.submitProposal();
    });

    expect(createProviderProposal).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Proposta enviada com sucesso.");
    expect(result.current.isOpen).toBe(false);
  });
});
