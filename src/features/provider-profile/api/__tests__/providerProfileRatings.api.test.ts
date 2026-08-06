import { describe, it, expect, vi, beforeEach } from "vitest";
import { listPublicProviderRatings } from "../providerProfileRatings.api";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc: rpcMock },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

describe("listPublicProviderRatings", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("returns error when provider id is empty", async () => {
    const result = await listPublicProviderRatings({ providerId: "  " });
    expect(result).toEqual({ data: null, error: "Provider id is required" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns error when RPC fails", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "DB error" } });
    const result = await listPublicProviderRatings({ providerId: "pid-1" });
    expect(result.data).toBeNull();
    expect(result.error).toBe("DB error");
    expect(rpcMock).toHaveBeenCalledWith("list_public_provider_ratings", {
      p_provider_id: "pid-1",
      p_page_size: 20,
      p_cursor_submitted_at: undefined,
      p_cursor_id: undefined,
    });
  });

  it("returns empty page when RPC returns null (not visible)", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    const result = await listPublicProviderRatings({ providerId: "pid-1" });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      items: [],
      next_cursor: null,
      has_more: false,
    });
  });

  it("maps items and cursor on success", async () => {
    rpcMock.mockResolvedValue({
      data: {
        items: [
          {
            id: "r1",
            overall_score: 5,
            comment: "Ótimo",
            submitted_at: "2026-08-01T10:00:00Z",
          },
          {
            id: "r2",
            overall_score: 4,
            comment: "  ",
            submitted_at: "2026-07-01T10:00:00Z",
          },
        ],
        next_cursor: {
          submitted_at: "2026-07-01T10:00:00Z",
          id: "r2",
        },
        has_more: true,
      },
      error: null,
    });

    const result = await listPublicProviderRatings({
      providerId: "pid-1",
      pageSize: 10,
      cursor: { submitted_at: "2026-08-02T00:00:00Z", id: "prev" },
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      items: [
        {
          id: "r1",
          overall_score: 5,
          comment: "Ótimo",
          submitted_at: "2026-08-01T10:00:00Z",
        },
        {
          id: "r2",
          overall_score: 4,
          comment: null,
          submitted_at: "2026-07-01T10:00:00Z",
        },
      ],
      next_cursor: {
        submitted_at: "2026-07-01T10:00:00Z",
        id: "r2",
      },
      has_more: true,
    });
    expect(rpcMock).toHaveBeenCalledWith("list_public_provider_ratings", {
      p_provider_id: "pid-1",
      p_page_size: 10,
      p_cursor_submitted_at: "2026-08-02T00:00:00Z",
      p_cursor_id: "prev",
    });
  });

  it("clears has_more when next_cursor is missing", async () => {
    rpcMock.mockResolvedValue({
      data: { items: [], next_cursor: null, has_more: true },
      error: null,
    });
    const result = await listPublicProviderRatings({ providerId: "pid-1" });
    expect(result.data?.has_more).toBe(false);
  });
});
