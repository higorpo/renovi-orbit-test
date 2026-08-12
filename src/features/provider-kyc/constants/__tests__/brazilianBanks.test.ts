import { beforeEach, describe, expect, it } from "vitest";
import {
  BRAZILIAN_BANK_NAME_OVERRIDES,
  filterBrazilianBanks,
  findBrazilianBankByCode,
  formatBankLabel,
  loadBrazilianBanksFallback,
  mapBrasilApiBanks,
  resetBrazilianBanksFallbackForTests,
} from "../brazilianBanks";

const sampleApi = [
  {
    ispb: "00000000",
    name: "BCO DO BRASIL S.A.",
    code: 1,
    fullName: "Banco do Brasil S.A.",
  },
  {
    ispb: "00038121",
    name: "Selic",
    code: null,
    fullName: "Banco Central do Brasil - Selic",
  },
  {
    ispb: "18236120",
    name: "NU PAGAMENTOS - IP",
    code: 260,
    fullName: "NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO",
  },
  {
    ispb: "28719664",
    name: "Balcão B3",
    code: 0,
    fullName: "Sistema do Balcão B3",
  },
  {
    ispb: "60701190",
    name: "ITAÚ UNIBANCO S.A.",
    code: 341,
    fullName: "ITAÚ UNIBANCO S.A.",
  },
] as const;

describe("mapBrasilApiBanks", () => {
  it("pads FEBRABAN codes, drops null/zero codes, and applies friendly name overrides", () => {
    const banks = mapBrasilApiBanks(sampleApi);

    expect(banks.find((b) => b.code === "001")).toEqual({
      code: "001",
      name: "Banco do Brasil",
    });
    expect(banks.find((b) => b.code === "260")).toEqual({
      code: "260",
      name: "Nubank",
    });
    expect(banks.find((b) => b.code === "341")).toEqual({
      code: "341",
      name: "Itaú Unibanco",
    });
    expect(banks.some((b) => b.code === "000")).toBe(false);
    expect(banks.some((b) => !b.code)).toBe(false);
  });

  it("uses fullName when there is no override", () => {
    const banks = mapBrasilApiBanks([
      {
        ispb: "1",
        name: "SHORT",
        code: 999,
        fullName: "Friendly Full Name S.A.",
      },
    ]);
    expect(banks).toEqual([{ code: "999", name: "Friendly Full Name S.A." }]);
  });

  it("skips duplicate FEBRABAN codes and blank names", () => {
    const banks = mapBrasilApiBanks([
      {
        ispb: "1",
        name: "First",
        code: 999,
        fullName: "First Bank",
      },
      {
        ispb: "2",
        name: "Duplicate",
        code: 999,
        fullName: "Duplicate Bank",
      },
      {
        ispb: "3",
        name: "   ",
        code: 998,
        fullName: "   ",
      },
      {
        ispb: "4",
        name: "Alpha",
        code: 100,
        fullName: "",
      },
    ]);

    expect(banks.filter((b) => b.code === "999")).toHaveLength(1);
    expect(banks.find((b) => b.code === "999")?.name).toBe("First Bank");
    expect(banks.some((b) => b.code === "998")).toBe(false);
    expect(banks.find((b) => b.code === "100")?.name).toBe("Alpha");
  });

  it("falls back to name when fullName is empty and sorts ties by code", () => {
    const banks = mapBrasilApiBanks([
      { ispb: "1", name: "Same Name", code: 2, fullName: "" },
      { ispb: "2", name: "Same Name", code: 1, fullName: "" },
    ]);

    expect(banks.map((b) => b.code)).toEqual(["001", "002"]);
  });
});

describe("loadBrazilianBanksFallback + helpers", () => {
  beforeEach(() => {
    resetBrazilianBanksFallbackForTests();
  });

  it("lazily loads the local JSON with overrides", async () => {
    const banks = await loadBrazilianBanksFallback();
    expect(banks.length).toBeGreaterThanOrEqual(100);
    expect(findBrazilianBankByCode("001", banks)?.name).toBe("Banco do Brasil");
    expect(findBrazilianBankByCode("260", banks)?.name).toBe("Nubank");
    expect(findBrazilianBankByCode("84", banks)?.code).toBe("084");
    expect(findBrazilianBankByCode("084", banks)?.name).toMatch(/Sisprime/i);
    expect(Object.keys(BRAZILIAN_BANK_NAME_OVERRIDES).length).toBeGreaterThanOrEqual(30);
  });

  it("caches the fallback promise across calls", async () => {
    const first = loadBrazilianBanksFallback();
    const second = loadBrazilianBanksFallback();
    expect(first).toBe(second);
    await first;
  });

  it("formats labels and filters by name or code", async () => {
    const banks = await loadBrazilianBanksFallback();
    expect(formatBankLabel({ code: "341", name: "Itaú Unibanco" })).toBe(
      "Itaú Unibanco (341)",
    );
    expect(filterBrazilianBanks("nubank", banks).map((b) => b.code)).toContain("260");
    expect(filterBrazilianBanks("001", banks).map((b) => b.code)).toContain("001");
    expect(filterBrazilianBanks("itaú", banks).some((b) => b.code === "341")).toBe(true);
    expect(filterBrazilianBanks("zzzz-not-a-bank", banks)).toHaveLength(0);
    expect(filterBrazilianBanks("   ", banks)).toHaveLength(banks.length);
  });
});
