import { describe, it, expect } from "vitest";
import { formatServiceSchemaFallbackReason } from "../serviceSchemaFallbackMessages";

describe("formatServiceSchemaFallbackReason", () => {
  it("returns mapped label for known codes", () => {
    expect(formatServiceSchemaFallbackReason("no_form")).toBe(
      "Não há formulário vinculado a este serviço."
    );
    expect(formatServiceSchemaFallbackReason("schema_validation_failed")).toBe(
      "O formulário contém erros de configuração."
    );
  });

  it("returns generic fallback for unknown codes", () => {
    expect(formatServiceSchemaFallbackReason("unknown_code")).toBe(
      "Não foi possível carregar o formulário."
    );
  });
});
