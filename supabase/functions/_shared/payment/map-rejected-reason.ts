/**
 * Maps NetCred transaction `rejectedReason` strings to stable Renovi failure codes.
 * ClearSale risk-analysis copy is gateway-owned; we never surface the raw string to users.
 */

export const RISK_ANALYSIS_FAILURE_CODES = [
  "RISK_ANALYSIS_NO_CONTACT",
  "RISK_ANALYSIS_FRAUD_SUSPICION",
  "RISK_ANALYSIS_CANCELLED_DUPLICATE",
  "RISK_ANALYSIS_CONFIRMED_FRAUD",
  "RISK_ANALYSIS_BUSINESS_RULE",
  "RISK_ANALYSIS_POLICY",
  "RISK_ANALYSIS_MANUAL_FACILITATOR",
  "RISK_ANALYSIS_REJECTED",
] as const;

export type RiskAnalysisFailureCode = (typeof RISK_ANALYSIS_FAILURE_CODES)[number];

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

function normalizeRejectedReason(value: string): string {
  return stripDiacritics(value).toLowerCase().replace(/\s+/g, " ").trim();
}

type ReasonMatcher = {
  code: RiskAnalysisFailureCode;
  includes: string[];
};

/** Most-specific matchers first. */
const RISK_ANALYSIS_MATCHERS: ReasonMatcher[] = [
  {
    code: "RISK_ANALYSIS_CONFIRMED_FRAUD",
    includes: ["fraude confirmada"],
  },
  {
    code: "RISK_ANALYSIS_FRAUD_SUSPICION",
    includes: ["suspeita de fraude"],
  },
  {
    code: "RISK_ANALYSIS_NO_CONTACT",
    includes: ["falta de contato", "reprovado sem suspeita"],
  },
  {
    code: "RISK_ANALYSIS_CANCELLED_DUPLICATE",
    includes: ["duplicidade", "solicitacao do cliente"],
  },
  {
    code: "RISK_ANALYSIS_BUSINESS_RULE",
    includes: ["regra de negocio"],
  },
  {
    code: "RISK_ANALYSIS_POLICY",
    includes: ["politica estabelecida"],
  },
  {
    code: "RISK_ANALYSIS_MANUAL_FACILITATOR",
    includes: ["reprovado manualmente", "facilitador"],
  },
];

/**
 * Returns a Renovi failure code when `rejectedReason` is a ClearSale risk-analysis
 * summary; otherwise `null` (caller keeps gateway `REJECTED`).
 */
export function mapRejectedReasonToFailureCode(
  rejectedReason: string | null | undefined,
): RiskAnalysisFailureCode | null {
  if (!rejectedReason?.trim()) {
    return null;
  }

  const normalized = normalizeRejectedReason(rejectedReason);
  if (!normalized.includes("analise de risco")) {
    return null;
  }

  for (const matcher of RISK_ANALYSIS_MATCHERS) {
    if (matcher.includes.some((needle) => normalized.includes(needle))) {
      return matcher.code;
    }
  }

  return "RISK_ANALYSIS_REJECTED";
}

export function resolveRejectedTransactionFailureCode(
  rejectedReason: string | null | undefined,
  fallback = "REJECTED",
): string {
  return mapRejectedReasonToFailureCode(rejectedReason) ?? fallback;
}
