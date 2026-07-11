// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useProposalComposer } from "../useProposalComposer";

const calculateProposalPricingMock = vi.fn();
const uploadProposalPhotosMock = vi.fn();
const createProviderProposalMock = vi.fn();
const generateIdempotencyKeyV7Mock = vi.fn();

const formMock = {
  trigger: vi.fn(),
  getValues: vi.fn(),
};

const composerFormMock = {
  form: formMock,
  pricing: null as {
    original_amount: number;
    tax_rate: number;
    tax_amount: number;
    final_amount: number;
    pricing_signature: string;
  } | null,
  newPhotos: [] as File[],
  existingPhotoPaths: [] as string[],
  resetComposer: vi.fn(),
};

vi.mock("../../api/proposalComposerSupport.api", () => ({
  calculateProposalPricing: (...args: unknown[]) => calculateProposalPricingMock(...args),
  uploadProposalPhotos: (...args: unknown[]) => uploadProposalPhotosMock(...args),
}));

vi.mock("../../api/proposals.api", () => ({
  createProviderProposal: (...args: unknown[]) => createProviderProposalMock(...args),
}));

vi.mock("@/lib/utils/idempotencyKey", () => ({
  generateIdempotencyKeyV7: () => generateIdempotencyKeyV7Mock(),
}));

vi.mock("../useProposalComposerForm", () => ({
  useProposalComposerForm: () => composerFormMock,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const pricing = {
  original_amount: 300,
  tax_rate: 0.1,
  tax_amount: 30,
  final_amount: 270,
  pricing_signature: "pricing-signature",
};

const values = {
  priceInput: "300",
  descriptionDraft: "  Detailed proposal  ",
  durationValueInput: "2",
  durationUnit: "hours",
  availabilitySlots: [
    { startDate: "2099-01-10", endDate: "", shift: "morning" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  composerFormMock.pricing = null;
  composerFormMock.newPhotos = [];
  composerFormMock.existingPhotoPaths = [];
  formMock.trigger.mockResolvedValue(true);
  formMock.getValues.mockReturnValue(values);
  generateIdempotencyKeyV7Mock.mockReturnValue("idem-1");
  calculateProposalPricingMock.mockResolvedValue({ data: pricing, error: null });
  uploadProposalPhotosMock.mockResolvedValue({ paths: ["new/photo.jpg"], error: null });
  createProviderProposalMock.mockResolvedValue({
    data: { id: "proposal-1", proposal: { id: "proposal-1" }, timeline_message: null },
    error: null,
  });
});

describe("useProposalComposer", () => {
  it("blocks submit without a service request", async () => {
    const { result } = renderHook(() => useProposalComposer({ serviceRequestId: null }));

    await expect(result.current.submit()).resolves.toBe(false);

    expect(formMock.trigger).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Pedido não encontrado.");
  });

  it("blocks submit when form validation fails", async () => {
    formMock.trigger.mockResolvedValue(false);
    const { result } = renderHook(() =>
      useProposalComposer({ serviceRequestId: "request-1" }),
    );

    await expect(result.current.submit()).resolves.toBe(false);

    expect(calculateProposalPricingMock).not.toHaveBeenCalled();
    expect(createProviderProposalMock).not.toHaveBeenCalled();
  });

  it("calculates missing pricing and submits normalized proposal data", async () => {
    composerFormMock.existingPhotoPaths = ["existing/photo.jpg"];
    composerFormMock.newPhotos = [new File(["photo"], "photo.jpg")];
    const onSubmitted = vi.fn();
    const { result } = renderHook(() =>
      useProposalComposer({ serviceRequestId: "request-1", onSubmitted }),
    );

    let success = false;
    await act(async () => {
      success = await result.current.submit();
    });

    expect(success).toBe(true);
    expect(calculateProposalPricingMock).toHaveBeenCalledWith(300);
    expect(createProviderProposalMock).toHaveBeenCalledWith({
      serviceRequestId: "request-1",
      idempotencyKey: "idem-1",
      proposedAmount: 300,
      proposalDescription: "Detailed proposal",
      proposalDurationValue: 2,
      proposalDurationUnit: "hours",
      proposalSuggestedSlots: [
        { start_date: "2099-01-10", end_date: null, shift: "morning" },
      ],
      photos: ["existing/photo.jpg", "new/photo.jpg"],
      pricing,
    });
    expect(onSubmitted).toHaveBeenCalledWith(
      expect.objectContaining({ id: "proposal-1" }),
    );
    expect(composerFormMock.resetComposer).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Proposta enviada com sucesso.");
    expect(result.current.isSubmitting).toBe(false);
  });

  it("keeps the idempotency key after a failed create and reuses it on retry", async () => {
    composerFormMock.pricing = pricing;
    createProviderProposalMock
      .mockResolvedValueOnce({
        data: null,
        error: { code: "UNKNOWN", message: "Temporary failure" },
      })
      .mockResolvedValueOnce({
        data: { id: "proposal-1", proposal: { id: "proposal-1" }, timeline_message: null },
        error: null,
      });
    const { result } = renderHook(() =>
      useProposalComposer({ serviceRequestId: "request-1" }),
    );

    await act(async () => {
      expect(await result.current.submit()).toBe(false);
      expect(await result.current.submit()).toBe(true);
    });

    expect(generateIdempotencyKeyV7Mock).toHaveBeenCalledTimes(1);
    expect(createProviderProposalMock.mock.calls[0][0].idempotencyKey).toBe("idem-1");
    expect(createProviderProposalMock.mock.calls[1][0].idempotencyKey).toBe("idem-1");
    expect(toast.error).toHaveBeenCalledWith("Temporary failure");
  });

  it("stops before create when photo upload fails", async () => {
    composerFormMock.pricing = pricing;
    uploadProposalPhotosMock.mockResolvedValue({ paths: [], error: "Upload failed" });
    const { result } = renderHook(() =>
      useProposalComposer({ serviceRequestId: "request-1" }),
    );

    await act(async () => {
      expect(await result.current.submit()).toBe(false);
    });

    expect(createProviderProposalMock).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Upload failed");
    expect(result.current.isSubmitting).toBe(false);
  });

  it("returns false without toast when price parses to zero", async () => {
    formMock.getValues.mockReturnValue({ ...values, priceInput: "0" });
    const { result } = renderHook(() =>
      useProposalComposer({ serviceRequestId: "request-1" }),
    );

    await act(async () => {
      expect(await result.current.submit()).toBe(false);
    });

    expect(calculateProposalPricingMock).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows generic pricing toast when API returns null data", async () => {
    calculateProposalPricingMock.mockResolvedValue({ data: null, error: null });
    const { result } = renderHook(() =>
      useProposalComposer({ serviceRequestId: "request-1" }),
    );

    await act(async () => {
      expect(await result.current.submit()).toBe(false);
    });

    expect(toast.error).toHaveBeenCalledWith("Não foi possível calcular a taxa agora.");
  });

  it("submits using cached pricing without recalculating", async () => {
    composerFormMock.pricing = pricing;
    const { result } = renderHook(() =>
      useProposalComposer({ serviceRequestId: "request-1" }),
    );

    await act(async () => {
      expect(await result.current.submit()).toBe(true);
    });

    expect(calculateProposalPricingMock).not.toHaveBeenCalled();
    expect(createProviderProposalMock).toHaveBeenCalled();
  });
});
