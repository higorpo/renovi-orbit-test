import { assertEquals } from "std/testing/asserts";
import {
  pickAliasResult,
  resolveCompanyOutcome,
} from "../processCompanyResult.ts";
import type { PendingProviderAccount } from "../types.ts";
import { providerAliasKey } from "../types.ts";

const account: PendingProviderAccount = {
  id: "account-1",
  provider_id: "provider-1",
  document: "11222333000181",
  onboarding_status: "DOCUMENTS_SUBMITTED",
};

Deno.test("resolveCompanyOutcome returns noop for empty edges", () => {
  assertEquals(resolveCompanyOutcome(account, { edges: [] }).action, "noop");
  assertEquals(resolveCompanyOutcome(account, null).action, "noop");
  assertEquals(resolveCompanyOutcome(account, undefined).action, "noop");
});

Deno.test("resolveCompanyOutcome returns noop when node id is missing", () => {
  assertEquals(
    resolveCompanyOutcome(account, { edges: [{ node: { document: "11222333000181" } }] })
      .action,
    "noop",
  );
});

Deno.test("resolveCompanyOutcome returns noop on document mismatch", () => {
  assertEquals(
    resolveCompanyOutcome(account, {
      edges: [{
        node: {
          id: "1",
          document: "00000000000000",
          companyState: "ACTIVE",
          bankAccounts: { edges: [{ node: { id: "b1", isActive: true } }] },
        },
      }],
    }).action,
    "noop",
  );
});

Deno.test("resolveCompanyOutcome marks under_review for non-ACTIVE state", () => {
  const outcome = resolveCompanyOutcome(account, {
    edges: [{
      node: {
        id: "1",
        document: "11222333000181",
        companyState: "UNDER_REVIEW",
      },
    }],
  });
  assertEquals(outcome.action, "under_review");
});

Deno.test("resolveCompanyOutcome picks first active bank account", () => {
  const outcome = resolveCompanyOutcome(account, {
    edges: [{
      node: {
        id: "1048",
        document: "11.222.333/0001-81",
        companyState: "ACTIVE",
        bankAccounts: {
          edges: [
            { node: { id: "inactive", isActive: false } },
            { node: { id: "2053", isActive: true } },
          ],
        },
      },
    }],
  });
  assertEquals(outcome.action, "activated");
  assertEquals(outcome.netcredBankAccountId, "2053");
});

Deno.test("pickAliasResult reads provider alias key", () => {
  const key = providerAliasKey(account.document);
  const result = pickAliasResult(
    { [key]: { edges: [] } },
    account,
  );
  assertEquals(result, { edges: [] });
});
