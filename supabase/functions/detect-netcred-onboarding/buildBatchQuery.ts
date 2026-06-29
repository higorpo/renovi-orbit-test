import { providerAliasKey } from "./types.ts";

function sanitizeDocumentForGraphQL(document: string): string {
  const normalized = document.replace(/\D/g, "");
  if (!/^[0-9]+$/.test(normalized) || normalized.length === 0) {
    throw new Error("INVALID_DOCUMENT_FOR_GRAPHQL");
  }
  return normalized;
}

export function buildBatchCompaniesQuery(
  accounts: Array<{ document: string }>,
): string {
  const blocks = accounts.map((account) => {
    const alias = providerAliasKey(account.document);
    const document = sanitizeDocumentForGraphQL(account.document);
    return `${alias}: companies(document: "${document}") {
      edges {
        node {
          id
          document
          companyState
          bankAccounts {
            edges {
              node {
                id
                isActive
              }
            }
          }
        }
      }
    }`;
  });

  return `query ProviderOnboardingBatch {\n${blocks.join("\n")}\n}`;
}
