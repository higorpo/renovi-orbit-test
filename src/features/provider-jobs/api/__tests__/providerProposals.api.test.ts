import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateProviderServicePricing,
  createProviderProposal,
  fetchProviderProposalHistory,
  getProviderProposalPhotoDisplayUrl,
  uploadProviderProposalPhotos,
  withdrawProviderProposal,
} from "../providerProposals.api";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
    auth: { getUser: mocks.getUser },
    from: (...args: unknown[]) => mocks.from(...args),
    storage: {
      from: (...args: unknown[]) => mocks.storageFrom(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

const logger = await import("@/lib/logger").then((m) => m.logger);

function createHistoryChain(result: { data: unknown; error: { message: string } | null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then(resolve: (v: typeof result) => void) {
      queueMicrotask(() => resolve(result));
    },
  };
  return chain;
}

function createWithdrawChain(result: { data: unknown; error: { message: string } | null }) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then(resolve: (v: typeof result) => void) {
      queueMicrotask(() => resolve(result));
    },
  };
  return chain;
}

describe("calculateProviderServicePricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pricing when rpc succeeds", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          original_amount: 500,
          tax_rate: 0.15,
          tax_amount: 75,
          final_amount: 425,
          pricing_signature: "sig-123",
        },
      ],
      error: null,
    } as never);

    const result = await calculateProviderServicePricing(500);

    expect(mocks.rpc).toHaveBeenCalledWith("calculate_provider_service_pricing", {
      p_original_amount: 500,
    });
    expect(result).toEqual({
      data: {
        original_amount: 500,
        tax_rate: 0.15,
        tax_amount: 75,
        final_amount: 425,
        pricing_signature: "sig-123",
      },
      error: null,
    });
  });

  it("returns error when rpc fails", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Unauthorized" },
    } as never);

    const result = await calculateProviderServicePricing(500);

    expect(result).toEqual({
      data: null,
      error: "Unauthorized",
    });
    expect(logger.error).toHaveBeenCalledWith(
      "calculate_provider_service_pricing_error",
      expect.any(Object),
    );
  });

  it("returns fallback when pricing row is invalid", async () => {
    mocks.rpc.mockResolvedValue({
      data: { not: "a row" },
      error: null,
    } as never);

    const result = await calculateProviderServicePricing(100);

    expect(result.error).toBe("Unexpected response from server");
    expect(logger.error).toHaveBeenCalledWith(
      "calculate_provider_service_pricing_invalid_response",
      expect.any(Object),
    );
  });
});

describe("getProviderProposalPhotoDisplayUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns http(s) URLs unchanged", async () => {
    await expect(
      getProviderProposalPhotoDisplayUrl("https://cdn.example.com/x.jpg"),
    ).resolves.toBe("https://cdn.example.com/x.jpg");
  });

  it("creates signed URL for storage paths", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://signed.example.com/a" },
      error: null,
    });
    mocks.storageFrom.mockReturnValue({ createSignedUrl });

    const url = await getProviderProposalPhotoDisplayUrl("providers/u1/proposals/x/a.jpg");

    expect(mocks.storageFrom).toHaveBeenCalledWith("provider-proposals");
    expect(createSignedUrl).toHaveBeenCalledWith(
      "providers/u1/proposals/x/a.jpg",
      3600,
    );
    expect(url).toBe("https://signed.example.com/a");
  });

  it("returns empty string when signed URL fails", async () => {
    mocks.storageFrom.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Denied" },
      }),
    });

    await expect(
      getProviderProposalPhotoDisplayUrl("providers/x/y.jpg"),
    ).resolves.toBe("");
  });
});

describe("uploadProviderProposalPhotos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty paths when no files", async () => {
    await expect(
      uploadProviderProposalPhotos("sr-1", []),
    ).resolves.toEqual({ paths: [], error: null });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("rejects when more than max photos", async () => {
    const files = Array.from({ length: 6 }, () => new File([], "a.jpg"));
    const result = await uploadProviderProposalPhotos("sr-1", files as File[]);
    expect(result.error).toContain("máximo");
    expect(result.paths).toEqual([]);
  });

  it("returns auth error when user missing", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    const file = new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" });
    const result = await uploadProviderProposalPhotos("sr-1", [file]);

    expect(result.paths).toEqual([]);
    expect(result.error).toBe("Usuário não autenticado");
  });

  it("validates image type", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    } as never);
    const bad = new File([new Uint8Array([1])], "a.gif", { type: "image/gif" });

    const result = await uploadProviderProposalPhotos("sr-1", [bad]);

    expect(result.error).toContain("Formato não permitido");
  });

  it("validates max file size", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    } as never);
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "a.jpg", {
      type: "image/jpeg",
    });

    const result = await uploadProviderProposalPhotos("sr-1", [big]);

    expect(result.error).toContain("5 MB");
  });

  it("uploads files and returns paths", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    } as never);
    const upload = vi.fn().mockResolvedValue({ error: null });
    mocks.storageFrom.mockReturnValue({ upload });

    const file = new File([new Uint8Array([1])], "photo.PNG", { type: "image/png" });
    const result = await uploadProviderProposalPhotos("sr-1", [file]);

    expect(result.error).toBeNull();
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]).toMatch(/^providers\/u1\/proposals\/sr-1\/\d+-0\.png$/);
    expect(upload).toHaveBeenCalled();
  });

  it("returns error when storage upload fails", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    } as never);
    mocks.storageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: { message: "Quota" } }),
    });

    const file = new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" });
    const result = await uploadProviderProposalPhotos("sr-1", [file]);

    expect(result.error).toBe("Quota");
    expect(logger.error).toHaveBeenCalledWith(
      "upload_provider_proposal_photo_error",
      expect.any(Object),
    );
  });
});

describe("createProviderProposal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates proposal via rpc with pricing signature", async () => {
    mocks.rpc.mockResolvedValue({
      data: { id: "proposal-1" },
      error: null,
    } as never);

    const result = await createProviderProposal({
      serviceRequestId: "sr-1",
      proposedAmount: 500,
      proposalDescription: "Consigo iniciar amanhã cedo.",
      proposalDurationValue: 5,
      proposalDurationUnit: "hours",
      proposalSuggestedSlots: [{ start_date: "2026-03-25", shift: "morning" }],
      photos: ["providers/p-1/proposals/sr-1/photo-1.jpg"],
      pricing: {
        original_amount: 500,
        tax_rate: 0.15,
        tax_amount: 75,
        final_amount: 425,
        pricing_signature: "sig-123",
      },
    });

    expect(mocks.rpc).toHaveBeenCalledWith("create_provider_proposal", {
      p_service_request_id: "sr-1",
      p_proposed_amount: 500,
      p_proposal_description: "Consigo iniciar amanhã cedo.",
      p_proposal_duration_value: 5,
      p_proposal_duration_unit: "hours",
      p_proposal_suggested_slots: [{ start_date: "2026-03-25", shift: "morning" }],
      p_photos: ["providers/p-1/proposals/sr-1/photo-1.jpg"],
      p_tax_rate: 0.15,
      p_tax_amount: 75,
      p_final_amount: 425,
      p_pricing_signature: "sig-123",
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: "proposal-1" });
  });

  it("returns rpc error message", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Duplicate" },
    } as never);

    const result = await createProviderProposal({
      serviceRequestId: "sr-1",
      proposedAmount: 1,
      proposalDescription: "x",
      proposalDurationValue: 1,
      proposalDurationUnit: "hours",
      proposalSuggestedSlots: [],
      photos: [],
      pricing: {
        original_amount: 1,
        tax_rate: 0,
        tax_amount: 0,
        final_amount: 1,
        pricing_signature: "s",
      },
    });

    expect(result.data).toBeNull();
    expect(result.error).toBe("Duplicate");
  });

  it("returns fallback when id missing in payload", async () => {
    mocks.rpc.mockResolvedValue({
      data: { foo: "bar" },
      error: null,
    } as never);

    const result = await createProviderProposal({
      serviceRequestId: "sr-1",
      proposedAmount: 1,
      proposalDescription: "x",
      proposalDurationValue: 1,
      proposalDurationUnit: "hours",
      proposalSuggestedSlots: [],
      photos: [],
      pricing: {
        original_amount: 1,
        tax_rate: 0,
        tax_amount: 0,
        final_amount: 1,
        pricing_signature: "s",
      },
    });

    expect(result.data).toBeNull();
    expect(result.error).toBe("Unexpected response from server");
  });
});

describe("fetchProviderProposalHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns rows on success", async () => {
    const row = {
      id: "p1",
      proposed_amount: 100,
      proposal_description: "d",
      proposal_duration_value: 1,
      proposal_duration_unit: "hours",
      proposal_suggested_slots: [],
      status: "submitted",
      tax_rate: 0,
      tax_amount: 0,
      final_amount: 100,
      photos: [],
      created_at: "t",
      updated_at: "t",
      client_rejection_response: null,
    };
    mocks.from.mockReturnValue(
      createHistoryChain({ data: [row], error: null }),
    );

    const result = await fetchProviderProposalHistory("sr-1");

    expect(result.error).toBeNull();
    expect(result.data).toEqual([row]);
  });

  it("returns empty list with error when query fails", async () => {
    mocks.from.mockReturnValue(
      createHistoryChain({ data: null, error: { message: "boom" } }),
    );

    const result = await fetchProviderProposalHistory("sr-1");

    expect(result.data).toEqual([]);
    expect(result.error).toBe("boom");
  });
});

describe("withdrawProviderProposal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success true when a row was updated", async () => {
    mocks.from.mockReturnValue(
      createWithdrawChain({ data: [{ id: "p1" }], error: null }),
    );

    const result = await withdrawProviderProposal("sr-1");

    expect(result).toEqual({ success: true, error: null });
  });

  it("returns success false when no row matched", async () => {
    mocks.from.mockReturnValue(
      createWithdrawChain({ data: [], error: null }),
    );

    const result = await withdrawProviderProposal("sr-1");

    expect(result.success).toBe(false);
  });

  it("returns error when update fails", async () => {
    mocks.from.mockReturnValue(
      createWithdrawChain({ data: null, error: { message: "nope" } }),
    );

    const result = await withdrawProviderProposal("sr-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("nope");
  });
});
