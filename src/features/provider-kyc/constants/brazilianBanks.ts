export type BrazilianBank = {
  code: string;
  name: string;
};

/** Raw row from BrasilAPI `/banks/v1` (and the local fallback JSON). */
export type BrasilApiBank = {
  ispb: string;
  name: string;
  code: number | null;
  fullName: string;
};

/**
 * Friendly display names for common institutions.
 * BrasilAPI often returns legal/technical names (e.g. "NU PAGAMENTOS - IP").
 */
export const BRAZILIAN_BANK_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "104": "Caixa Econômica Federal",
  "237": "Bradesco",
  "341": "Itaú Unibanco",
  "260": "Nubank",
  "077": "Banco Inter",
  "336": "C6 Bank",
  "756": "Sicoob",
  "748": "Sicredi",
  "208": "BTG Pactual",
  "212": "Banco Original",
  "422": "Banco Safra",
  "041": "Banrisul",
  "070": "BRB — Banco de Brasília",
  "136": "Unicred",
  "021": "Banestes",
  "047": "Banco do Estado de Sergipe",
  "085": "Ailos (Cooperativa)",
  "097": "Credisis",
  "133": "Cresol",
  "197": "Stone Pagamentos",
  "323": "Mercado Pago",
  "380": "PicPay",
  "290": "PagBank (PagSeguro)",
  "637": "Banco Sofisa",
  "655": "Banco Votorantim",
  "735": "Banco Neon",
  "739": "Banco Cetelem",
  "745": "Citibank",
  "246": "Banco ABC Brasil",
  "318": "Banco BMG",
  "389": "Banco Mercantil do Brasil",
  "623": "Banco Pan",
  "643": "Banco Pine",
  "707": "Banco Daycoval",
};

export function formatBankCode(code: number): string {
  return String(code).padStart(3, "0");
}

/** Maps BrasilAPI rows into picker options; skips entries without a usable FEBRABAN code. */
export function mapBrasilApiBanks(
  raw: readonly BrasilApiBank[],
): BrazilianBank[] {
  const banks: BrazilianBank[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (item.code == null || item.code <= 0) continue;

    const code = formatBankCode(item.code);
    if (seen.has(code)) continue;
    seen.add(code);

    const apiName = (item.fullName || item.name).trim();
    const name = BRAZILIAN_BANK_NAME_OVERRIDES[code] ?? apiName;
    if (!name) continue;

    banks.push({ code, name });
  }

  banks.sort(
    (a, b) =>
      a.name.localeCompare(b.name, "pt-BR") || a.code.localeCompare(b.code),
  );
  return banks;
}

let fallbackPromise: Promise<readonly BrazilianBank[]> | null = null;

/** Resets the lazy-fallback cache between unit tests. */
export function resetBrazilianBanksFallbackForTests(): void {
  fallbackPromise = null;
}

/**
 * Lazily loads the bundled BrasilAPI snapshot.
 * Kept out of the initial chunk so successful API loads never download this JSON.
 */
export function loadBrazilianBanksFallback(): Promise<readonly BrazilianBank[]> {
  if (!fallbackPromise) {
    fallbackPromise = import("./brazilianBanksDefault.json").then((mod) =>
      mapBrasilApiBanks(mod.default as BrasilApiBank[]),
    );
  }
  return fallbackPromise;
}

export function formatBankLabel(bank: BrazilianBank): string {
  return `${bank.name} (${bank.code})`;
}

export function findBrazilianBankByCode(
  code: string,
  banks: readonly BrazilianBank[],
): BrazilianBank | undefined {
  const normalized = code.trim();
  return banks.find((bank) => bank.code === normalized);
}

/** Case-insensitive filter by institution name or FEBRABAN code. */
export function filterBrazilianBanks(
  query: string,
  banks: readonly BrazilianBank[],
): BrazilianBank[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...banks];
  }
  return banks.filter(
    (bank) =>
      bank.name.toLowerCase().includes(q)
      || bank.code.includes(q)
      || formatBankLabel(bank).toLowerCase().includes(q),
  );
}
