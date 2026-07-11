import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock("@/lib/sentry", () => ({
  addBreadcrumb: mocks.addBreadcrumb,
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: mocks.loggerWarn },
}));

import { fetchAddressByCEP } from "@/lib/cep";

describe("fetchAddressByCEP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects CEPs that do not contain exactly eight digits without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAddressByCEP("12345-67")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes the CEP and returns the ViaCEP address", async () => {
    const address = {
      logradouro: "Praça da Sé",
      bairro: "Sé",
      localidade: "São Paulo",
      uf: "SP",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(address),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAddressByCEP("01001-000")).resolves.toEqual(address);
    expect(fetchMock).toHaveBeenCalledWith("https://viacep.com.br/ws/01001000/json/", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    expect(mocks.addBreadcrumb).toHaveBeenCalledWith({
      category: "cep",
      message: "cep.lookup_ok",
      data: { cepPrefix: "01001" },
    });
  });

  it("returns null and records the status when ViaCEP responds with an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );

    await expect(fetchAddressByCEP("01001000")).resolves.toBeNull();
    expect(mocks.addBreadcrumb).toHaveBeenCalledWith({
      category: "cep",
      message: "cep.lookup_failed",
      data: { cepPrefix: "01001", status: 503 },
    });
  });

  it("returns a canonical not-found result when ViaCEP marks the CEP as invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ erro: true, unexpected: "ignored" }),
      }),
    );

    await expect(fetchAddressByCEP("01001000")).resolves.toEqual({ erro: true });
    expect(mocks.addBreadcrumb).toHaveBeenCalledWith({
      category: "cep",
      message: "cep.not_found",
      data: { cepPrefix: "01001" },
    });
  });

  it("returns null and logs network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(fetchAddressByCEP("01001000")).resolves.toBeNull();
    expect(mocks.loggerWarn).toHaveBeenCalledWith("viacep_fetch_error", {
      cep: "01001000",
      error: "Error: offline",
    });
  });
});
