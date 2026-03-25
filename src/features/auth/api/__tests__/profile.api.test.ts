import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProfile, updateProfile, updateRole } from "../profile.api";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

vi.mock("../auth.api", () => ({
  authApi: {
    getCurrentUser: vi.fn(),
  },
}));

const { supabase } = await import("@/lib/supabase/client");
const { authApi } = await import("../auth.api");
const fromMock = vi.mocked(supabase.from);
const getCurrentUserMock = vi.mocked(authApi.getCurrentUser);

let terminalReturns: Array<{ data: unknown; error: { message: string } | null }> = [];

function makeChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  };
  const thenable = {
    ...chain,
    then(onFulfilled: (v: unknown) => unknown) {
      const result = terminalReturns.shift();
      return Promise.resolve(result).then(onFulfilled);
    },
  };
  return thenable;
}

beforeEach(() => {
  vi.clearAllMocks();
  terminalReturns = [];
  fromMock.mockReturnValue(makeChain() as never);
});

describe("getProfile", () => {
  it("returns profile when found", async () => {
    const profile = { id: "user-1", role: "client", full_name: "Test User" };
    terminalReturns = [{ data: profile, error: null }];

    const result = await getProfile("user-1");
    expect(result.profile).toEqual(profile);
    expect(result.error).toBeNull();
  });

  it("returns error when supabase errors", async () => {
    terminalReturns = [{ data: null, error: { message: "DB error" } }];

    const result = await getProfile("user-1");
    expect(result.profile).toBeNull();
    expect(result.error).toBe("DB error");
  });

  it("creates profile from current user when not found", async () => {
    const newProfile = { id: "user-1", role: "client", full_name: "Novo Usuário" };
    // First call: maybeSingle returns null (not found)
    terminalReturns = [
      { data: null, error: null },
      // Second call: insert returns new profile
      { data: newProfile, error: null },
    ];
    getCurrentUserMock.mockResolvedValue({
      user: {
        id: "user-1",
        user_metadata: { full_name: "Novo Usuário", role: "client" },
      } as never,
    });

    const result = await getProfile("user-1");
    expect(result.profile).toEqual(newProfile);
    expect(result.error).toBeNull();
  });

  it("returns error when profile creation fails", async () => {
    terminalReturns = [
      { data: null, error: null },
      { data: null, error: { message: "Insert failed" } },
    ];
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1", user_metadata: {} } as never,
    });

    const result = await getProfile("user-1");
    expect(result.profile).toBeNull();
    expect(result.error).toBe("Insert failed");
  });

  it("returns error when insert returns null data", async () => {
    terminalReturns = [
      { data: null, error: null },
      { data: null, error: null },
    ];
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1", user_metadata: { role: "provider" } } as never,
    });

    const result = await getProfile("user-1");
    expect(result.profile).toBeNull();
    expect(result.error).toBe("Profile not found after insert");
  });

  it("uses 'client' role when metadata role is not valid", async () => {
    const newProfile = { id: "user-1", role: "client", full_name: "New User" };
    terminalReturns = [
      { data: null, error: null },
      { data: newProfile, error: null },
    ];
    getCurrentUserMock.mockResolvedValue({
      user: { id: "user-1", user_metadata: { role: "admin" } } as never,
    });

    const result = await getProfile("user-1");
    expect(result.profile?.role).toBe("client");
  });
});

describe("updateProfile", () => {
  it("returns null error on success", async () => {
    terminalReturns = [{ data: null, error: null }];

    const result = await updateProfile("user-1", { full_name: "New Name" });
    expect(result.error).toBeNull();
  });

  it("returns null error when payload is empty (no-op)", async () => {
    // Empty params — no DB call should happen
    const result = await updateProfile("user-1", {});
    expect(result.error).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns error on failure", async () => {
    terminalReturns = [{ data: null, error: { message: "Update failed" } }];

    const result = await updateProfile("user-1", { full_name: "Name" });
    expect(result.error).toBe("Update failed");
  });

  it("filters out disallowed keys like role", async () => {
    terminalReturns = [{ data: null, error: null }];

    // 'role' is not in ALLOWED_UPDATE_KEYS — should be silently ignored
    const result = await updateProfile("user-1", { full_name: "Name" } as never);
    expect(result.error).toBeNull();
  });
});

describe("updateRole", () => {
  it("returns null error when updating to client", async () => {
    terminalReturns = [{ data: null, error: null }];

    const result = await updateRole("user-1", "client");
    expect(result.error).toBeNull();
  });

  it("returns null error when updating to provider", async () => {
    terminalReturns = [{ data: null, error: null }];

    const result = await updateRole("user-1", "provider");
    expect(result.error).toBeNull();
  });

  it("rejects role admin", async () => {
    const result = await updateRole("user-1", "admin" as never);
    expect(result.error).toBe("Role admin cannot be set via application.");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns error on DB failure", async () => {
    terminalReturns = [{ data: null, error: { message: "DB error" } }];

    const result = await updateRole("user-1", "provider");
    expect(result.error).toBe("DB error");
  });
});
