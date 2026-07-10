import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchClientCpf } from "../clientCpf.api";
import { logger } from "@/lib/logger";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

function createSelectChain(result: {
  data: { cpf: string | null } | null;
  error: { message: string } | null;
}) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
}

describe("fetchClientCpf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns trimmed CPF on success", async () => {
    mockFrom.mockReturnValue(createSelectChain({
      data: { cpf: "  39053344705  " },
      error: null,
    }));

    const result = await fetchClientCpf("client-1");

    expect(result).toEqual({ cpf: "39053344705", error: null });
    expect(mockFrom).toHaveBeenCalledWith("client_profiles_private");
  });

  it("returns null CPF when value is empty or whitespace", async () => {
    mockFrom.mockReturnValue(createSelectChain({
      data: { cpf: "   " },
      error: null,
    }));

    await expect(fetchClientCpf("client-1")).resolves.toEqual({
      cpf: null,
      error: null,
    });
  });

  it("returns null CPF when the profile row is missing", async () => {
    mockFrom.mockReturnValue(createSelectChain({
      data: null,
      error: null,
    }));

    await expect(fetchClientCpf("client-1")).resolves.toEqual({
      cpf: null,
      error: null,
    });
  });

  it("returns null CPF when the stored CPF is null", async () => {
    mockFrom.mockReturnValue(createSelectChain({
      data: { cpf: null },
      error: null,
    }));

    await expect(fetchClientCpf("client-1")).resolves.toEqual({
      cpf: null,
      error: null,
    });
  });

  it("returns error and logs when supabase fails", async () => {
    mockFrom.mockReturnValue(createSelectChain({
      data: null,
      error: { message: "db down" },
    }));

    const result = await fetchClientCpf("client-1");

    expect(result).toEqual({ cpf: null, error: "db down" });
    expect(logger.error).toHaveBeenCalledWith(
      "payment_client_cpf_fetch_error",
      expect.objectContaining({ clientId: "client-1", error: "db down" }),
    );
  });
});
