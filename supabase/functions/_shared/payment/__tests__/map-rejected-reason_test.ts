import { assertEquals } from "std/testing/asserts";
import {
  mapRejectedReasonToFailureCode,
  resolveRejectedTransactionFailureCode,
} from "../map-rejected-reason.ts";

const NETCRED_SAMPLES = [
  {
    reason:
      "Análise de Risco: Pedido Reprovado sem Suspeita por falta de contato com o cliente dentro do período acordado e/ou políticas restritivas de CPF.",
    code: "RISK_ANALYSIS_NO_CONTACT",
  },
  {
    reason:
      "Análise de Risco: Pedido Suspenso por suspeita de fraude baseado no contato com o “cliente” ou ainda na base ClearSale.",
    code: "RISK_ANALYSIS_FRAUD_SUSPICION",
  },
  {
    reason:
      "Análise de Risco: Cancelado por solicitação do cliente ou duplicidade do pedido.",
    code: "RISK_ANALYSIS_CANCELLED_DUPLICATE",
  },
  {
    reason:
      "Análise de Risco: Pedido imputado como Fraude Confirmada por contato com a administradora de cartão e/ou contato com titular do cartão ou CPF do cadastro que desconhecem a compra.",
    code: "RISK_ANALYSIS_CONFIRMED_FRAUD",
  },
  {
    reason:
      "Análise de Risco: Pedido Reprovado Automaticamente por algum tipo de Regra de Negócio que necessite aplicá-la.",
    code: "RISK_ANALYSIS_BUSINESS_RULE",
  },
  {
    reason:
      "Análise de Risco: Pedido reprovado automaticamente por política estabelecida pelo cliente ou Clearsale.",
    code: "RISK_ANALYSIS_POLICY",
  },
  {
    reason:
      "Análise de Risco: Reprovado manualmente pelo Facilitador mediante score obtido por análise.",
    code: "RISK_ANALYSIS_MANUAL_FACILITATOR",
  },
] as const;

Deno.test("mapRejectedReasonToFailureCode maps all NetCred ClearSale samples", () => {
  for (const sample of NETCRED_SAMPLES) {
    assertEquals(mapRejectedReasonToFailureCode(sample.reason), sample.code);
  }
});

Deno.test("mapRejectedReasonToFailureCode returns generic risk code for unknown Análise de Risco text", () => {
  assertEquals(
    mapRejectedReasonToFailureCode("Análise de Risco: Motivo novo não documentado"),
    "RISK_ANALYSIS_REJECTED",
  );
});

Deno.test("mapRejectedReasonToFailureCode ignores non risk-analysis reasons", () => {
  assertEquals(mapRejectedReasonToFailureCode(null), null);
  assertEquals(mapRejectedReasonToFailureCode(""), null);
  assertEquals(mapRejectedReasonToFailureCode("Issuer declined"), null);
  assertEquals(mapRejectedReasonToFailureCode("REJECTED"), null);
});

Deno.test("resolveRejectedTransactionFailureCode falls back to REJECTED", () => {
  assertEquals(resolveRejectedTransactionFailureCode(null), "REJECTED");
  assertEquals(
    resolveRejectedTransactionFailureCode(NETCRED_SAMPLES[0].reason),
    "RISK_ANALYSIS_NO_CONTACT",
  );
});
