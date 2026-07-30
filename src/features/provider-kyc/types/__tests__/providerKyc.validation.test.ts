// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  bankStepSchema,
  fromRpcEntityType,
  providerKycCnpjSchema,
  providerKycCpfSchema,
  toRpcEntityType,
} from "../providerKyc.validation";

function makeFile(name = "doc.pdf", type = "application/pdf") {
  return new File(["content"], name, { type });
}

const baseCpf = {
  entityType: "CPF" as const,
  fullName: "João Silva",
  document: "390.533.447-05",
  phone: "48999999999",
  email: "joao@example.com",
  bankInstitutionCode: "001",
  bankBranch: "1234",
  bankAccount: "56789-0",
  identityDoc: makeFile(),
  addressProofDoc: makeFile("address.pdf"),
};

describe("providerKycCpfSchema", () => {
  it("accepts a valid CPF KYC payload", () => {
    expect(providerKycCpfSchema.safeParse(baseCpf).success).toBe(true);
  });

  it("rejects invalid CPF and missing documents", () => {
    expect(
      providerKycCpfSchema.safeParse({
        ...baseCpf,
        document: "111.111.111-11",
      }).success,
    ).toBe(false);

    expect(
      providerKycCpfSchema.safeParse({
        ...baseCpf,
        identityDoc: "not-a-file",
      }).success,
    ).toBe(false);
  });
});

describe("providerKycCnpjSchema", () => {
  it("accepts a valid CNPJ KYC payload", () => {
    expect(
      providerKycCnpjSchema.safeParse({
        ...baseCpf,
        entityType: "CNPJ",
        document: "11.444.777/0001-61",
        razaoSocial: "Empresa LTDA",
        nomeFantasia: "Empresa",
        legalRepFullName: "Maria Silva",
        legalRepCpf: "390.533.447-05",
        legalRepPhone: "48988887777",
        corporateCharterDoc: makeFile("charter.pdf"),
        legalRepDoc: makeFile("rep.pdf"),
      }).success,
    ).toBe(true);
  });

  it("rejects CNPJ payload without corporate documents", () => {
    expect(
      providerKycCnpjSchema.safeParse({
        ...baseCpf,
        entityType: "CNPJ",
        document: "11.444.777/0001-61",
        razaoSocial: "Empresa LTDA",
        nomeFantasia: "Empresa",
        legalRepFullName: "Maria Silva",
        legalRepCpf: "390.533.447-05",
        legalRepPhone: "48988887777",
      }).success,
    ).toBe(false);
  });
});

describe("bankStepSchema", () => {
  it("rejects agency with non-digits", () => {
    expect(
      bankStepSchema.safeParse({
        bankInstitutionCode: "001",
        bankBranch: "1234-5",
        bankAccount: "56789-0",
      }).success,
    ).toBe(false);
  });
});

describe("entity type RPC mapping", () => {
  it("maps CPF/CNPJ to pf/pj and back", () => {
    expect(toRpcEntityType("CPF")).toBe("pf");
    expect(toRpcEntityType("CNPJ")).toBe("pj");
    expect(fromRpcEntityType("pf")).toBe("CPF");
    expect(fromRpcEntityType("pj")).toBe("CNPJ");
    expect(fromRpcEntityType("other")).toBeNull();
  });
});
