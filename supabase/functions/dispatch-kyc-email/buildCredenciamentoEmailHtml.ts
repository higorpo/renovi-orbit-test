import type { ProviderKycContext } from "./types.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDocument(document: string, entityType: "pf" | "pj"): string {
  if (entityType === "pf" && document.length === 11) {
    return `${document.slice(0, 3)}.${document.slice(3, 6)}.${document.slice(6, 9)}-${document.slice(9)}`;
  }

  if (entityType === "pj" && document.length === 14) {
    return `${document.slice(0, 2)}.${document.slice(2, 5)}.${document.slice(5, 8)}/${document.slice(8, 12)}-${document.slice(12)}`;
  }

  return document;
}

function row(label: string, value: string | null | undefined): string {
  if (!value?.trim()) {
    return "";
  }

  return `<tr><td style="padding:6px 12px;font-weight:600;">${escapeHtml(label)}</td><td style="padding:6px 12px;">${escapeHtml(value)}</td></tr>`;
}

export function buildCredenciamentoEmailSubject(context: ProviderKycContext): string {
  const document = context.gatewayAccount.document;
  const suffix = context.privateProfile.entityType === "pj"
    ? context.privateProfile.razaoSocial ?? document
    : context.profile.fullName;

  return `[Renovi] Credenciamento prestador — ${suffix}`;
}

export function buildCredenciamentoEmailHtml(context: ProviderKycContext): string {
  const { privateProfile, profile, gatewayAccount } = context;
  const document = formatDocument(
    gatewayAccount.document,
    privateProfile.entityType,
  );

  const bankingRows = [
    row("Código do banco", privateProfile.bankInstitutionCode),
    row("Agência", privateProfile.bankBranch),
    row("Conta corrente", privateProfile.bankAccount),
    row("Chave PIX", privateProfile.pixKey),
  ].join("");

  const pfRows = [
    row("Nome completo", profile.fullName),
    row("CPF", document),
    row("Celular", profile.phone),
    row("E-mail", profile.email),
  ].join("");

  const pjRows = [
    row("Razão social", privateProfile.razaoSocial),
    row("Nome fantasia", privateProfile.nomeFantasia),
    row("CNPJ", document),
    row("Representante legal", privateProfile.legalRepresentativeName),
    row("CPF do representante", privateProfile.legalRepresentativeCpf),
    row("Telefone do representante", privateProfile.legalRepresentativePhone),
    row("E-mail do representante", profile.email),
  ].join("");

  const identityRows = privateProfile.entityType === "pj" ? pjRows : pfRows;

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <body style="font-family:Arial,sans-serif;color:#111;line-height:1.5;">
    <h2 style="margin-bottom:8px;">Credenciamento de prestador — Renovi</h2>
    <p style="margin-top:0;">Solicitação de credenciamento enviada via plataforma Renovi.</p>
    <h3>Dados cadastrais</h3>
    <table style="border-collapse:collapse;">${identityRows}</table>
    <h3>Dados bancários</h3>
    <table style="border-collapse:collapse;">${bankingRows}</table>
    <p>Documentos anexados neste e-mail (identidade, comprovante de endereço${
    privateProfile.entityType === "pj" ? ", contrato social e documento do representante" : ""
  }).</p>
  </body>
</html>`;
}
