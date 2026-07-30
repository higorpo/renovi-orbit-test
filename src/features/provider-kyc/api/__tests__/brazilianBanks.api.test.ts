import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loggerMocks = vi.hoisted(() => ({
  warn: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: loggerMocks,
}));

import { fetchBrazilianBanks } from "../brazilianBanks.api";
import {
  loadBrazilianBanksFallback,
  resetBrazilianBanksFallbackForTests,
} from "../../constants/brazilianBanks";

describe("fetchBrazilianBanks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    loggerMocks.warn.mockReset();
    resetBrazilianBanksFallbackForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps a successful BrasilAPI response and applies overrides", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            ispb: "18236120",
            name: "NU PAGAMENTOS - IP",
            code: 260,
            fullName: "NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO",
          },
          {
            ispb: "00000000",
            name: "BCO DO BRASIL S.A.",
            code: 1,
            fullName: "Banco do Brasil S.A.",
          },
        ],
      }),
    );

    const banks = await fetchBrazilianBanks();

    expect(fetch).toHaveBeenCalledWith("https://brasilapi.com.br/api/banks/v1");
    expect(banks.find((b) => b.code === "260")?.name).toBe("Nubank");
    expect(banks.find((b) => b.code === "001")?.name).toBe("Banco do Brasil");
    expect(loggerMocks.warn).not.toHaveBeenCalled();
  });

  it("lazily falls back to local JSON when the network request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const banks = await fetchBrazilianBanks();
    const fallback = await loadBrazilianBanksFallback();

    expect(banks).toEqual([...fallback]);
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      "brazilian_banks_api_fallback",
      expect.objectContaining({ message: "offline" }),
    );
  });

  it("falls back when the API returns a non-OK status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      }),
    );

    const banks = await fetchBrazilianBanks();
    const fallback = await loadBrazilianBanksFallback();

    expect(banks).toEqual([...fallback]);
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      "brazilian_banks_api_fallback",
      expect.objectContaining({ message: expect.stringContaining("503") }),
    );
  });

  it("falls back when the payload is empty or invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );

    const banks = await fetchBrazilianBanks();
    const fallback = await loadBrazilianBanksFallback();

    expect(banks).toEqual([...fallback]);
    expect(loggerMocks.warn).toHaveBeenCalled();
  });

  it("falls back when payload rows have an unexpected shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ ispb: 1, name: "bad", fullName: "bad", code: "x" }],
      }),
    );

    const banks = await fetchBrazilianBanks();
    const fallback = await loadBrazilianBanksFallback();

    expect(banks).toEqual([...fallback]);
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      "brazilian_banks_api_fallback",
      expect.objectContaining({ message: expect.stringContaining("unexpected shape") }),
    );
  });

  it("falls back when mapped bank list is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            ispb: "0",
            name: "Selic",
            code: null,
            fullName: "Banco Central",
          },
        ],
      }),
    );

    const banks = await fetchBrazilianBanks();
    const fallback = await loadBrazilianBanksFallback();

    expect(banks).toEqual([...fallback]);
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      "brazilian_banks_api_fallback",
      expect.objectContaining({ message: expect.stringContaining("empty list") }),
    );
  });

  it("stringifies non-Error failures in the fallback log", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("offline-string"));

    await fetchBrazilianBanks();

    expect(loggerMocks.warn).toHaveBeenCalledWith(
      "brazilian_banks_api_fallback",
      expect.objectContaining({ message: "offline-string" }),
    );
  });
});
