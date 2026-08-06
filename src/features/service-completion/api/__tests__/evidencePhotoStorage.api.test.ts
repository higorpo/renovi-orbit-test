import { beforeEach, describe, expect, it, vi } from "vitest";

const createSignedUrl = vi.fn();
const mockStorageFrom = vi.fn(() => ({ createSignedUrl }));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    storage: {
      from: (...args: unknown[]) => mockStorageFrom(...args),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe("getCompletionEvidenceDisplayUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty string for blank path", async () => {
    const { getCompletionEvidenceDisplayUrl } = await import(
      "../evidencePhotoStorage.api"
    );
    await expect(getCompletionEvidenceDisplayUrl("  ")).resolves.toBe("");
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("signs a storage path from completion-evidence bucket", async () => {
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://cdn/evidence.jpg" },
      error: null,
    });
    const { getCompletionEvidenceDisplayUrl } = await import(
      "../evidencePhotoStorage.api"
    );
    await expect(
      getCompletionEvidenceDisplayUrl("cs/abc.jpg"),
    ).resolves.toBe("https://cdn/evidence.jpg");
    expect(mockStorageFrom).toHaveBeenCalledWith("completion-evidence");
    expect(createSignedUrl).toHaveBeenCalledWith("cs/abc.jpg", 3600);
  });

  it("returns empty string when signing fails", async () => {
    createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "denied" },
    });
    const { getCompletionEvidenceDisplayUrl } = await import(
      "../evidencePhotoStorage.api"
    );
    await expect(getCompletionEvidenceDisplayUrl("cs/x.jpg")).resolves.toBe("");
  });
});
