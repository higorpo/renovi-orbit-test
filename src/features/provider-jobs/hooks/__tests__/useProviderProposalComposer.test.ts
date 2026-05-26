// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useProviderProposalComposer } from "../useProviderProposalComposer";
import * as providerProposalsApi from "../../api/providerProposals.api";
import type { ProviderProposalPricing } from "../../api/providerProposals.api";

type PricingCallResult = { data: ProviderProposalPricing | null; error: string | null };

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

    const futureStart = new Date();
    futureStart.setDate(futureStart.getDate() + 14);
    const futureStartIso = futureStart.toISOString().slice(0, 10);

    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("500");
      result.current.setDescriptionDraft("Posso executar com garantia e nota.");
      result.current.setDurationValueInput("5");
      result.current.updateAvailabilitySlot(0, "startDate", futureStartIso);
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

  it("does not close composer while submitting", async () => {
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
    let resolveUpload: (v: { paths: string[]; error: string | null }) => void = () => {};
    uploadProviderProposalPhotos.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );
    createProviderProposal.mockResolvedValue({ data: { id: "p" }, error: null });

    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("100");
      result.current.setDescriptionDraft("Ok");
      result.current.setDurationValueInput("1");
      result.current.updateAvailabilitySlot(0, "startDate", "2099-08-01");
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    let submitPromise: Promise<boolean>;
    await act(async () => {
      submitPromise = result.current.submitProposal();
    });
    act(() => {
      result.current.closeComposer();
    });
    expect(result.current.isOpen).toBe(true);

    await act(async () => {
      resolveUpload!({ paths: [], error: null });
      await submitPromise!;
    });
  });

  it("opens composer when edit is requested without existing proposal (create path)", () => {
    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.openComposer({ mode: "edit" });
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.priceInput).toBe("");
  });

  it("uses default availability slot when edit mode has no suggested slots", () => {
    const { result } = renderHook(
      () =>
        useProviderProposalComposer("sr-1", {
          proposedAmount: 10,
          description: "X",
          durationValue: 1,
          durationUnit: "hours",
          suggestedSlots: null,
          photos: [],
        }),
      { wrapper: createWrapper() },
    );
    act(() => {
      result.current.openComposer({ mode: "edit" });
    });
    expect(result.current.availabilitySlots).toHaveLength(1);
    expect(result.current.availabilitySlots[0].shift).toBe("full_day");
  });

  it("rejects submit when price is invalid", async () => {
    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("0");
    });
    await act(async () => {
      await result.current.submitProposal();
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Informe um valor válido para o orçamento.",
    );
  });

  it("rejects submit when description exceeds max length", async () => {
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
      result.current.setDescriptionDraft("x".repeat(1201));
      result.current.setDurationValueInput("1");
      result.current.updateAvailabilitySlot(0, "startDate", "2099-01-01");
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await result.current.submitProposal();
    });
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("no máximo 1200"),
    );
  });

  it("rejects submit when duration is missing", async () => {
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
      result.current.updateAvailabilitySlot(0, "startDate", "2099-01-01");
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await result.current.submitProposal();
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Informe em quanto tempo você consegue executar o serviço.",
    );
  });

  it("rejects submit when start date is empty", async () => {
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
      result.current.setDurationValueInput("1");
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await result.current.submitProposal();
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Preencha a data inicial em todas as sugestões.",
    );
  });

  it("rejects submit when start date is before today", async () => {
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
      result.current.setDurationValueInput("1");
      result.current.updateAvailabilitySlot(0, "startDate", "2000-01-01");
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await result.current.submitProposal();
    });
    expect(toast.error).toHaveBeenCalledWith(
      "A data de início não pode ser anterior à data atual.",
    );
  });

  it("rejects days mode when end date is missing", async () => {
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
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const iso = future.toISOString().slice(0, 10);
    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("100");
      result.current.setDescriptionDraft("Ok");
      result.current.setDurationValueInput("2");
      result.current.setDurationUnit("days");
      result.current.updateAvailabilitySlot(0, "startDate", iso);
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await result.current.submitProposal();
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Preencha a data final para orçamentos em dias.",
    );
  });

  it("rejects days mode when end date is before start", async () => {
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
      result.current.updateAvailabilitySlot(0, "startDate", "2099-06-10");
      result.current.updateAvailabilitySlot(0, "endDate", "2099-06-05");
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await result.current.submitProposal();
    });
    expect(toast.error).toHaveBeenCalledWith("As datas sugeridas são inválidas.");
  });

  it("uses singular dia message when duration is 1 day mismatch", async () => {
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
      result.current.setDurationValueInput("1");
      result.current.setDurationUnit("days");
      result.current.updateAvailabilitySlot(0, "startDate", "2099-06-01");
      result.current.updateAvailabilitySlot(0, "endDate", "2099-06-03");
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      await result.current.submitProposal();
    });
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("1 dia"),
    );
  });

  it("shows toast when submit-time pricing returns only error string", async () => {
    calculateProviderServicePricing.mockResolvedValueOnce({
      data: null,
      error: "offline",
    });
    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("100");
      result.current.setDescriptionDraft("Ok");
      result.current.setDurationValueInput("1");
      result.current.updateAvailabilitySlot(0, "startDate", "2099-12-01");
    });
    await act(async () => {
      await result.current.submitProposal();
    });
    expect(toast.error).toHaveBeenCalledWith("offline");
  });

  it("shows generic toast when submit-time pricing returns null data without error", async () => {
    calculateProviderServicePricing.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("50");
      result.current.setDescriptionDraft("Ok");
      result.current.setDurationValueInput("1");
      result.current.updateAvailabilitySlot(0, "startDate", "2099-12-15");
    });
    await act(async () => {
      await result.current.submitProposal();
    });
    expect(toast.error).toHaveBeenCalledWith(
      "Não foi possível calcular a taxa agora.",
    );
  });

  it("ignores addPhotos when list is null or empty", () => {
    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.openComposer();
      result.current.addPhotos(null);
    });
    expect(result.current.newPhotos).toHaveLength(0);
    act(() => {
      const empty = { length: 0, item: () => null } as unknown as FileList;
      result.current.addPhotos(empty);
    });
    expect(result.current.newPhotos).toHaveLength(0);
  });

  it("caps new photos and shows toast when over max", () => {
    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });
    const file = new File([""], "a.png", { type: "image/png" });
    const list = {
      length: 6,
      item: (_i: number) => file,
      [Symbol.iterator]: function* () {
        for (let i = 0; i < 6; i += 1) yield file;
      },
    } as unknown as FileList;

    act(() => {
      result.current.openComposer();
      result.current.addPhotos(list);
    });
    expect(result.current.newPhotos.length).toBeLessThanOrEqual(5);
    expect(toast.error).toHaveBeenCalled();
  });

  it("removes new and existing photos", () => {
    const { result } = renderHook(
      () =>
        useProviderProposalComposer("sr-1", {
          proposedAmount: 1,
          description: "d",
          durationValue: 1,
          durationUnit: "hours",
          suggestedSlots: [],
          photos: ["a.jpg", "b.jpg"],
        }),
      { wrapper: createWrapper() },
    );
    act(() => {
      result.current.openComposer({ mode: "edit" });
    });
    const f = new File([""], "n.png", { type: "image/png" });
    act(() => {
      result.current.addPhotos({
        length: 1,
        item: () => f,
        [Symbol.iterator]: function* () {
          yield f;
        },
      } as unknown as FileList);
    });
    act(() => {
      result.current.removeNewPhoto(0);
    });
    expect(result.current.newPhotos).toHaveLength(0);
    act(() => {
      result.current.removeExistingPhoto(0);
    });
    expect(result.current.existingPhotoPaths).toEqual(["b.jpg"]);
  });

  it("formats price input with thousands separator", () => {
    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("1500");
    });
    expect(result.current.priceInput).toMatch(/1\.500/);
  });

  it("drops stale pricing responses when price changes during debounce", async () => {
    const pricingResponses: Array<(value: PricingCallResult) => void> = [];
    calculateProviderServicePricing.mockImplementation(() => {
      return new Promise<PricingCallResult>((resolve) => {
        pricingResponses.push(resolve);
      });
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
    expect(pricingResponses).toHaveLength(1);

    act(() => {
      result.current.setPriceInput("200");
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(pricingResponses).toHaveLength(2);

    await act(async () => {
      pricingResponses[0]!({
        data: {
          original_amount: 100,
          tax_rate: 0,
          tax_amount: 0,
          final_amount: 100,
          pricing_signature: "stale",
        },
        error: null,
      });
    });
    expect(result.current.pricing).toBeNull();

    await act(async () => {
      pricingResponses[1]!({
        data: {
          original_amount: 200,
          tax_rate: 0,
          tax_amount: 0,
          final_amount: 200,
          pricing_signature: "fresh",
        },
        error: null,
      });
    });
    expect(result.current.pricing?.pricing_signature).toBe("fresh");
  });

  it("shows max-photos toast twice when batch is truncated then user adds more", () => {
    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });
    const file = new File([""], "a.png", { type: "image/png" });
    const six = {
      length: 6,
      item: () => file,
      [Symbol.iterator]: function* () {
        for (let i = 0; i < 6; i += 1) yield file;
      },
    } as unknown as FileList;
    const two = {
      length: 2,
      item: () => file,
      [Symbol.iterator]: function* () {
        for (let i = 0; i < 2; i += 1) yield file;
      },
    } as unknown as FileList;

    act(() => {
      result.current.openComposer();
      result.current.addPhotos(six);
      result.current.addPhotos(two);
    });
    expect(toast.error).toHaveBeenCalledTimes(2);
  });

  it("formats decimal segment when price input includes comma", () => {
    const { result } = renderHook(() => useProviderProposalComposer("sr-1"), {
      wrapper: createWrapper(),
    });
    act(() => {
      result.current.openComposer();
      result.current.setPriceInput("10,5");
    });
    expect(result.current.priceInput).toContain("10");
    expect(result.current.priceInput).toContain("5");
  });

  it("disables submit in edit mode until a field changes", async () => {
    calculateProviderServicePricing.mockResolvedValue({
      data: {
        original_amount: 200,
        tax_rate: 0,
        tax_amount: 0,
        final_amount: 200,
        pricing_signature: "s",
      },
      error: null,
    });
    const { result } = renderHook(
      () =>
        useProviderProposalComposer("sr-1", {
          proposedAmount: 200,
          description: "Same",
          durationValue: 2,
          durationUnit: "hours",
          suggestedSlots: [
            { start_date: "", end_date: null, shift: "full_day" },
          ],
          photos: [],
        }),
      { wrapper: createWrapper() },
    );
    act(() => {
      result.current.openComposer({ mode: "edit" });
    });
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.canSubmitProposal).toBe(false);
    act(() => {
      result.current.setDescriptionDraft("Alterado");
    });
    expect(result.current.canSubmitProposal).toBe(true);
  });
});
