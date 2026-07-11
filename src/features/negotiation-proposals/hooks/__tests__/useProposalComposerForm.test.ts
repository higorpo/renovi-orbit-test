// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useProposalComposerForm } from "../useProposalComposerForm";

const calculateProposalPricingMock = vi.fn();

vi.mock("../../api/proposalComposerSupport.api", () => ({
  calculateProposalPricing: (...args: unknown[]) => calculateProposalPricingMock(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const pricing = {
  original_amount: 500,
  tax_rate: 0.1,
  tax_amount: 50,
  final_amount: 450,
  pricing_signature: "signature",
};

function fileList(count: number): FileList {
  const files = Array.from(
    { length: count },
    (_, index) => new File(["photo"], `photo-${index}.jpg`),
  );
  return {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* () {
      yield* files;
    },
  } as FileList;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  calculateProposalPricingMock.mockResolvedValue({ data: pricing, error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useProposalComposerForm", () => {
  it("debounces pricing and exposes derived submit state", async () => {
    const { result } = renderHook(() => useProposalComposerForm());

    act(() => result.current.form.setValue("priceInput", "500"));
    expect(result.current.priceAsNumber).toBe(500);
    expect(result.current.canSubmit).toBe(false);

    await act(async () => vi.advanceTimersByTimeAsync(1500));

    expect(calculateProposalPricingMock).toHaveBeenCalledWith(500);
    expect(result.current.pricing).toEqual(pricing);
    expect(result.current.canSubmit).toBe(true);
    expect(result.current.isPricingLoading).toBe(false);
  });

  it("clears pricing and reports pricing API errors", async () => {
    calculateProposalPricingMock.mockResolvedValue({ data: null, error: "Pricing unavailable" });
    const { result } = renderHook(() => useProposalComposerForm());

    act(() => result.current.form.setValue("priceInput", "200"));
    await act(async () => vi.advanceTimersByTimeAsync(1500));

    expect(result.current.pricing).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("Pricing unavailable");

    act(() => result.current.form.setValue("priceInput", ""));
    expect(result.current.priceAsNumber).toBeNull();
    expect(result.current.isPricingLoading).toBe(false);
  });

  it("caps photos across existing and new files and supports removal", () => {
    const { result } = renderHook(() => useProposalComposerForm());

    act(() => {
      result.current.loadFromForm(result.current.form.getValues(), ["one.jpg", "two.jpg"]);
    });
    act(() => {
      result.current.addPhotos(fileList(4));
    });

    expect(result.current.photosCount).toBe(5);
    expect(result.current.newPhotos).toHaveLength(3);
    expect(toast.error).toHaveBeenCalledWith(
      "Você pode anexar no máximo 5 imagens.",
    );

    act(() => {
      result.current.removeExistingPhoto(0);
      result.current.removeNewPhoto(0);
    });
    expect(result.current.photosCount).toBe(3);
  });

  it("enforces availability slot minimum and maximum", () => {
    const { result } = renderHook(() => useProposalComposerForm());

    act(() => result.current.removeAvailabilitySlot(0));
    expect(result.current.availabilityFieldArray.fields).toHaveLength(1);
    expect(toast.error).toHaveBeenCalledWith(
      "Informe pelo menos 1 opção de data.",
    );

    act(() => {
      result.current.addAvailabilitySlot();
      result.current.addAvailabilitySlot();
    });
    expect(result.current.availabilityFieldArray.fields).toHaveLength(3);

    act(() => result.current.addAvailabilitySlot());
    expect(result.current.availabilityFieldArray.fields).toHaveLength(3);
    expect(toast.error).toHaveBeenCalledWith(
      "Você pode sugerir no máximo 3 opções de data.",
    );
  });

  it("loads detail state and resets all composer state", () => {
    const { result } = renderHook(() => useProposalComposerForm());
    const detail = {
      id: "proposal-1",
      service_request_id: "request-1",
      provider_id: "provider-1",
      status: "SUBMITTED" as const,
      version: 1,
      revision_count: 0,
      revision_reason: null,
      revision_notes: null,
      submitted_at: null,
      expired_at: null,
      expires_at: null,
      proposed_amount: 250,
      proposal_description: "Existing proposal",
      proposal_duration_unit: "days",
      proposal_duration_value: 2,
      proposal_suggested_slots: [
        { start_date: "2099-02-01", end_date: "2099-02-02", shift: "full_day" as const },
      ],
      selected_slot: null,
      photos: ["existing.jpg"],
      client_rejection_response: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };

    act(() => result.current.loadFromDetail(detail));
    expect(result.current.existingPhotoPaths).toEqual(["existing.jpg"]);
    expect(result.current.form.getValues("descriptionDraft")).toBe("Existing proposal");
    expect(result.current.form.getValues("durationUnit")).toBe("days");

    act(() => result.current.resetComposer());
    expect(result.current.existingPhotoPaths).toEqual([]);
    expect(result.current.newPhotos).toEqual([]);
    expect(result.current.pricing).toBeNull();
    expect(result.current.form.getValues("priceInput")).toBe("");
  });
});
