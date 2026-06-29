import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveCheckoutPhone } from "../checkout.api";

const mockUpdateProfile = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
  getSupabaseAnonKey: vi.fn().mockReturnValue("anon-key"),
}));

vi.mock("@/features/auth", () => ({
  profileApi: {
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  metrics: { count: vi.fn() },
}));

describe("saveCheckoutPhone", () => {
  beforeEach(() => {
    mockUpdateProfile.mockReset();
  });

  it("returns formatted phone on successful profile update", async () => {
    mockUpdateProfile.mockResolvedValue({ error: null });

    const result = await saveCheckoutPhone("user-1", "48999998888");

    expect(result.error).toBeNull();
    expect(result.phone).toBe("(48) 99999-8888");
    expect(mockUpdateProfile).toHaveBeenCalledWith("user-1", {
      phone: "(48) 99999-8888",
    });
  });

  it("rejects invalid phone before calling profile API", async () => {
    const result = await saveCheckoutPhone("user-1", "123");

    expect(result.phone).toBeNull();
    expect(result.error).toMatch(/Telefone inválido/i);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it("returns error message on profile update failure", async () => {
    mockUpdateProfile.mockResolvedValue({ error: "Network error" });

    const result = await saveCheckoutPhone("user-1", "48999998888");

    expect(result.phone).toBeNull();
    expect(result.error).toBe("Network error");
  });
});
