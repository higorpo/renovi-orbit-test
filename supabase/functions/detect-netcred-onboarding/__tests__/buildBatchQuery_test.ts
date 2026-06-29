import { assertEquals, assertThrows } from "std/testing/asserts";
import { buildBatchCompaniesQuery } from "../buildBatchQuery.ts";

Deno.test("buildBatchCompaniesQuery strips non-alphanumeric characters from document", () => {
  const query = buildBatchCompaniesQuery([
    { document: "11.222.333/0001-81" },
  ]);

  assertEquals(query.includes('companies(document: "11222333000181")'), true);
});

Deno.test("buildBatchCompaniesQuery rejects documents with no digits", () => {
  assertThrows(
    () => buildBatchCompaniesQuery([{ document: '"; malicious' }]),
    Error,
    "INVALID_DOCUMENT_FOR_GRAPHQL",
  );
});
