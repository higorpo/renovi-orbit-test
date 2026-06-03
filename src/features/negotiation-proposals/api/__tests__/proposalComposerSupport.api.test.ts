import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateProposalPricing,
  getProposalPhotoDisplayUrl,
  uploadProposalPhotos,
} from "../proposalComposerSupport.api";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getUser: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    rpc: mocks.rpc,
    auth: { getUser: mocks.getUser },
    storage: {
      from: (...args: unknown[]) => mocks.storageFrom(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

const logger = await import("@/lib/logger").then((m) => m.logger);

describe("calculateProposalPricing", () => {
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

    const result = await calculateProposalPricing(500);

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

    const result = await calculateProposalPricing(500);

    expect(result).toEqual({
      data: null,
      error: "Unauthorized",
    });
    expect(logger.error).toHaveBeenCalledWith(
      "calculate_proposal_pricing_error",
      expect.any(Object),
    );
  });

  it("returns fallback when pricing row is invalid", async () => {
    mocks.rpc.mockResolvedValue({
      data: { not: "a row" },
      error: null,
    } as never);

    const result = await calculateProposalPricing(100);

    expect(result.error).toBe("Resposta inesperada do servidor.");
    expect(logger.error).toHaveBeenCalledWith(
      "calculate_proposal_pricing_invalid_response",
      expect.any(Object),
    );
  });
});

describe("getProposalPhotoDisplayUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns http(s) URLs unchanged", async () => {
    await expect(getProposalPhotoDisplayUrl("https://cdn.example.com/x.jpg")).resolves.toBe(
      "https://cdn.example.com/x.jpg",
    );
  });

  it("creates signed URL for storage paths", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://signed.example.com/a" },
      error: null,
    });
    mocks.storageFrom.mockReturnValue({ createSignedUrl });

    const url = await getProposalPhotoDisplayUrl("providers/u1/proposals/x/a.jpg");

    expect(mocks.storageFrom).toHaveBeenCalledWith("provider-proposals");
    expect(createSignedUrl).toHaveBeenCalledWith("providers/u1/proposals/x/a.jpg", 3600);
    expect(url).toBe("https://signed.example.com/a");
  });

  it("returns empty string when signed URL fails", async () => {
    mocks.storageFrom.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Denied" },
      }),
    });

    await expect(getProposalPhotoDisplayUrl("providers/x/y.jpg")).resolves.toBe("");
  });
});

describe("uploadProposalPhotos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty paths when no files", async () => {
    await expect(uploadProposalPhotos("sr-1", [])).resolves.toEqual({ paths: [], error: null });
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("rejects when more than max photos", async () => {
    const files = Array.from({ length: 6 }, () => new File([], "a.jpg"));
    const result = await uploadProposalPhotos("sr-1", files as File[]);
    expect(result.error).toContain("máximo");
    expect(result.paths).toEqual([]);
  });

  it("returns auth error when user missing", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as never);

    const file = new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" });
    const result = await uploadProposalPhotos("sr-1", [file]);

    expect(result.paths).toEqual([]);
    expect(result.error).toBe("Usuário não autenticado");
  });

  it("validates image type", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    } as never);
    const bad = new File([new Uint8Array([1])], "a.gif", { type: "image/gif" });

    const result = await uploadProposalPhotos("sr-1", [bad]);

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

    const result = await uploadProposalPhotos("sr-1", [big]);

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
    const result = await uploadProposalPhotos("sr-1", [file]);

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
    const result = await uploadProposalPhotos("sr-1", [file]);

    expect(result.error).toBe("Quota");
    expect(logger.error).toHaveBeenCalledWith("upload_proposal_photo_error", expect.any(Object));
  });
});
