import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPublicProfileBySlug } from "../providerProfilePublic.api";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  supabase: { rpc: rpcMock },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

describe("getPublicProfileBySlug", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("returns error when slug is empty", async () => {
    const result = await getPublicProfileBySlug("   ");
    expect(result).toEqual({ data: null, error: "Slug is required" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns error when RPC fails", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "DB error" } });
    const result = await getPublicProfileBySlug("joao-silva");
    expect(result.data).toBeNull();
    expect(result.error).toBe("DB error");
    expect(rpcMock).toHaveBeenCalledWith("get_public_provider_by_slug", {
      slug_param: "joao-silva",
    });
  });

  it("returns null data when profile not found or restricted", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    const result = await getPublicProfileBySlug("unknown-slug");
    expect(result).toEqual({ data: null, error: null });
  });

  it("returns profile data on success", async () => {
    const payload = {
      provider_id: "pid-1",
      slug: "joao-silva",
      display_name: "João Silva",
      bio: "Eletricista.",
      profile_visibility: "public",
      service_area_cities: ["Florianópolis"],
      service_area_regions: null,
      service_area_neighborhoods: null,
      full_name: "João Silva",
      profile_image_path: null,
      created_at: "2024-01-01T00:00:00Z",
      offered_services: [{ service_id: "s1", title: "Eletricista" }],
      portfolio_items: [],
    rating_avg: null,
    rating_count: 0,
    completed_services_count: 0,
    };
    rpcMock.mockResolvedValue({ data: payload, error: null });
    const result = await getPublicProfileBySlug("joao-silva");
    expect(result.error).toBeNull();
    expect(result.data).toEqual(payload);
    expect(rpcMock).toHaveBeenCalledWith("get_public_provider_by_slug", {
      slug_param: "joao-silva",
    });
  });
});
