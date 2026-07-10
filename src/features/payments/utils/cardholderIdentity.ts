/** Soft-check helpers for cardholder name vs account name. */

export const CARDHOLDER_NAME_SOFT_WARNING =
  "Aconselhamos usar um cartão de titularidade da mesma pessoa que está contratando o serviço.";

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

function normalizeNameToken(value: string): string {
  return stripDiacritics(value).trim().toUpperCase().replace(/[^A-Z]/g, "");
}

export function getFirstNameToken(fullName: string): string {
  const first = fullName.trim().split(/\s+/).find(Boolean) ?? "";
  return normalizeNameToken(first);
}

/** Soft check: compare only the first name token. Missing account name skips the check. */
export function cardholderFirstNameMatchesAccount(
  cardholderName: string,
  accountFullName: string | null | undefined,
): boolean {
  const accountFirst = getFirstNameToken(accountFullName ?? "");
  if (!accountFirst) {
    return true;
  }

  const cardFirst = getFirstNameToken(cardholderName);
  if (!cardFirst) {
    return true;
  }

  return cardFirst === accountFirst;
}
