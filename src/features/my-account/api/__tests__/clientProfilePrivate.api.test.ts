import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getClientPrivateProfile,
  updateClientPrivateProfile,
} from "../clientProfilePrivate.api";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

function chainMock(returnValue: { data?: unknown; error?: { message: string } | null }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(returnValue),
    upsert: vi.fn().mockImplementation(function (this: { then: (resolve: (v: unknown) => void) => void }) {
      this.then = (resolve: (v: { data: null; error: typeof returnValue.error }) => void) => {
        queueMicrotask(() =>
          resolve({ data: null, error: returnValue.error ?? null })
        );
      };
      return this;
    }),
    then(resolve: (v: typeof returnValue) => void) {
      queueMicrotask(() => resolve(returnValue));
    },
  };
  return chain;
}

describe("getClientPrivateProfile", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("returns data and null error on success", async () => {
    const row = {
      client_id: "c1",
      cpf: "529.982.247-25",
      updated_at: "2024-01-01T00:00:00Z",
    };
    mockFrom.mockReturnValue(chainMock({ data: row, error: null }));

    const result = await getClientPrivateProfile("c1");

    expect(result.data).toEqual(row);
    expect(result.error).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("client_profiles_private");
  });

  it("returns null data and error message on supabase error", async () => {
    mockFrom.mockReturnValue(
      chainMock({ data: null, error: { message: "Network error" } })
    );

    const result = await getClientPrivateProfile("c1");

    expect(result.data).toBeNull();
    expect(result.error).toBe("Network error");
  });
});

describe("updateClientPrivateProfile", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("returns null error on success", async () => {
    const chain = chainMock({ data: null, error: null });
    chain.upsert = vi.fn().mockImplementation(function (this: typeof chain) {
      this.then = (resolve: (v: { error: null }) => void) => {
        queueMicrotask(() => resolve({ error: null }));
      };
      return this;
    });
    mockFrom.mockReturnValue(chain);

    const result = await updateClientPrivateProfile("c1", { cpf: "529.982.247-25" });

    expect(result.error).toBeNull();
    expect(mockFrom).toHaveBeenCalledWith("client_profiles_private");
  });

  it("returns null error when params empty (no cpf)", async () => {
    const result = await updateClientPrivateProfile("c1", {});
    expect(result.error).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("trims and nullifies empty cpf", async () => {
    const chain = chainMock({ data: null, error: null });
    chain.upsert = vi.fn().mockImplementation(function (this: typeof chain) {
      this.then = (resolve: (v: { error: null }) => void) => {
        queueMicrotask(() => resolve({ error: null }));
      };
      return this;
    });
    mockFrom.mockReturnValue(chain);

    await updateClientPrivateProfile("c1", { cpf: "   " });

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: "c1", cpf: null }),
      { onConflict: "client_id" }
    );
  });

  it("returns error when supabase upsert fails", async () => {
    const chain = chainMock({ data: null, error: { message: "Conflict" } });
    chain.upsert = vi.fn().mockImplementation(function (this: typeof chain) {
      this.then = (resolve: (v: { data: null; error: { message: string } }) => void) => {
        queueMicrotask(() => resolve({ data: null, error: { message: "Conflict" } }));
      };
      return this;
    });
    mockFrom.mockReturnValue(chain);

    const result = await updateClientPrivateProfile("c1", { cpf: "123" });

    expect(result.error).toBe("Conflict");
  });
});
