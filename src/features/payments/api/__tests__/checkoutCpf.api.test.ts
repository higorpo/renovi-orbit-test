import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveCheckoutCpf } from "../checkout.api";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}));

function chainMock(error: { message: string } | null = null) {
  const chain = {
    upsert: vi.fn().mockImplementation(function (this: typeof chain) {
      this.then = (resolve: (v: { error: typeof error }) => void) => {
        queueMicrotask(() => resolve({ error }));
      };
      return this;
    }),
    then(_resolve: (v: { error: typeof error }) => void) {
      queueMicrotask(() => _resolve({ error }));
    },
  };
  return chain;
}

describe("saveCheckoutCpf", () => {
  beforeEach(() => {
    mockFrom.mockClear();
  });

  it("returns formatted CPF on successful upsert", async () => {
    mockFrom.mockReturnValue(chainMock(null));

    const result = await saveCheckoutCpf("client-1", "39053344705");

    expect(result.error).toBeNull();
    expect(result.cpf).toBe("390.533.447-05");
    expect(mockFrom).toHaveBeenCalledWith("client_profiles_private");
  });

  it("rejects invalid CPF before calling supabase", async () => {
    const result = await saveCheckoutCpf("client-1", "111.111.111-11");

    expect(result.cpf).toBeNull();
    expect(result.error).toMatch(/CPF inválido/i);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns error message on supabase failure", async () => {
    mockFrom.mockReturnValue(chainMock({ message: "RLS violation" }));

    const result = await saveCheckoutCpf("client-1", "39053344705");

    expect(result.cpf).toBeNull();
    expect(result.error).toBe("RLS violation");
  });
});
