// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderKycWizard } from "../useProviderKycWizard";
import * as kycApi from "../../api/kyc.api";

const mutateAsync = vi.fn();
const trackEvent = vi.fn();

vi.mock("../useDispatchKyc", () => ({
  useDispatchKyc: () => ({
    mutateAsync,
    isPending: false,
  }),
}));

vi.mock("../../api/kyc.api", () => ({
  fetchProviderPrivateProfileForKyc: vi.fn().mockResolvedValue({ data: null, error: null }),
  uploadKycDocument: vi.fn(),
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent }),
}));

vi.mock("@/lib/sentry", () => ({
  addBreadcrumb: vi.fn(),
}));

const pdf = () => new File(["x"], "doc.pdf", { type: "application/pdf" });

describe("useProviderKycWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(kycApi.fetchProviderPrivateProfileForKyc).mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it("starts on entity step and advances after validation", async () => {
    const { result } = renderHook(() =>
      useProviderKycWizard({
        providerId: "provider-1",
        accountEmail: "provider@example.com",
      }),
    );

    await waitFor(() => {
      expect(result.current.isPrefilling).toBe(false);
    });

    expect(result.current.step).toBe("entity");
    expect(result.current.progressLabel).toBe("Passo 1 de 5");
    expect(trackEvent).toHaveBeenCalledWith(
      "provider_kyc_step_viewed",
      expect.objectContaining({ step: "entity" }),
    );

    act(() => {
      result.current.goNext();
    });

    expect(result.current.step).toBe("identity");
    expect(result.current.progressLabel).toBe("Passo 2 de 5");
  });

  it("blocks advance from identity when fields are empty", async () => {
    const { result } = renderHook(() =>
      useProviderKycWizard({
        providerId: "provider-1",
        accountEmail: "provider@example.com",
      }),
    );

    await waitFor(() => {
      expect(result.current.isPrefilling).toBe(false);
    });

    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.goNext();
    });

    expect(result.current.step).toBe("identity");
    expect(result.current.stepError).toBeNull();
    expect(
      result.current.form.getFieldState("fullName").error?.message
        ?? result.current.form.getFieldState("document").error?.message,
    ).toMatch(/Informe o nome completo|CPF inválido/i);
  });

  it("clears field error when the user edits the field and on goBack", async () => {
    const { result } = renderHook(() =>
      useProviderKycWizard({
        providerId: "provider-1",
        accountEmail: "provider@example.com",
      }),
    );

    await waitFor(() => {
      expect(result.current.isPrefilling).toBe(false);
    });

    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.goNext();
    });

    expect(result.current.form.getFieldState("document").error?.message).toBeTruthy();

    act(() => {
      result.current.form.setValue("document", "390.533.447-05", {
        shouldDirty: true,
        shouldTouch: true,
      });
    });

    await waitFor(() => {
      expect(result.current.form.getFieldState("document").error).toBeUndefined();
    });

    act(() => {
      result.current.form.setError("document", { message: "CPF inválido" });
    });
    act(() => {
      result.current.goBack();
    });

    expect(result.current.form.getFieldState("document").error).toBeUndefined();
  });

  it("goes back to previous step", async () => {
    const { result } = renderHook(() =>
      useProviderKycWizard({
        providerId: "provider-1",
        accountEmail: "provider@example.com",
      }),
    );

    await waitFor(() => {
      expect(result.current.isPrefilling).toBe(false);
    });

    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.goBack();
    });

    expect(result.current.step).toBe("entity");
    expect(result.current.isFirstStep).toBe(true);
  });

  it("prefills wizard fields from private profile (CNPJ)", async () => {
    vi.mocked(kycApi.fetchProviderPrivateProfileForKyc).mockResolvedValue({
      data: {
        entityType: "CNPJ",
        document: "11444777000161",
        bankInstitutionCode: "001",
        bankBranch: "1234",
        bankAccount: "56789-0",
        pixKey: "pix@empresa.com",
        razaoSocial: "Empresa LTDA",
        nomeFantasia: "Empresa",
        legalRepFullName: "Maria Silva",
        legalRepCpf: "39053344705",
        legalRepPhone: "48988887777",
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useProviderKycWizard({
        providerId: "provider-1",
        accountEmail: "provider@example.com",
        defaultPhone: "48999999999",
        defaultFullName: "João",
      }),
    );

    await waitFor(() => {
      expect(result.current.isPrefilling).toBe(false);
    });

    expect(result.current.form.getValues("entityType")).toBe("CNPJ");
    expect(result.current.form.getValues("document")).toMatch(/11\.444\.777\/0001-61/);
    expect(result.current.form.getValues("bankInstitutionCode")).toBe("001");
    expect(result.current.form.getValues("razaoSocial")).toBe("Empresa LTDA");
    expect(result.current.isCnpj).toBe(true);
  });

  it("blocks advance from bank step when bank fields are empty", async () => {
    const { result } = renderHook(() =>
      useProviderKycWizard({
        providerId: "provider-1",
        accountEmail: "provider@example.com",
      }),
    );

    await waitFor(() => {
      expect(result.current.isPrefilling).toBe(false);
    });

    act(() => {
      result.current.goNext();
    });

    act(() => {
      result.current.form.setValue("fullName", "João Silva");
      result.current.form.setValue("document", "390.533.447-05");
      result.current.form.setValue("phone", "(48) 99999-9999");
    });
    act(() => {
      result.current.goNext();
    });

    expect(result.current.step).toBe("bank");

    act(() => {
      result.current.goNext();
    });

    expect(result.current.step).toBe("bank");
    expect(result.current.stepError).toBeNull();
    expect(
      result.current.form.getFieldState("bankInstitutionCode").error
        ?? result.current.form.getFieldState("bankBranch").error
        ?? result.current.form.getFieldState("bankAccount").error,
    ).toBeTruthy();
  });

  it("blocks advance from documents step when files are missing", async () => {
    const { result } = renderHook(() =>
      useProviderKycWizard({
        providerId: "provider-1",
        accountEmail: "provider@example.com",
      }),
    );

    await waitFor(() => {
      expect(result.current.isPrefilling).toBe(false);
    });

    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.form.setValue("fullName", "João Silva");
      result.current.form.setValue("document", "390.533.447-05");
      result.current.form.setValue("phone", "(48) 99999-9999");
    });
    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.form.setValue("bankInstitutionCode", "001");
      result.current.form.setValue("bankBranch", "1234");
      result.current.form.setValue("bankAccount", "56789-0");
    });
    act(() => {
      result.current.goNext();
    });

    expect(result.current.step).toBe("documents");

    act(() => {
      result.current.goNext();
    });

    expect(result.current.step).toBe("documents");
    expect(result.current.stepError).toBeNull();
    expect(
      result.current.form.getFieldState("identityDoc").error
        ?? result.current.form.getFieldState("addressProofDoc").error,
    ).toBeTruthy();
  });

  it("rejects submit when review payload is incomplete", async () => {
    const { result } = renderHook(() =>
      useProviderKycWizard({
        providerId: "provider-1",
        accountEmail: "provider@example.com",
      }),
    );

    await waitFor(() => {
      expect(result.current.isPrefilling).toBe(false);
    });

    // Jump to review without filling documents
    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.form.setValue("fullName", "João Silva");
      result.current.form.setValue("document", "390.533.447-05");
      result.current.form.setValue("phone", "(48) 99999-9999");
    });
    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.form.setValue("bankInstitutionCode", "001");
      result.current.form.setValue("bankBranch", "1234");
      result.current.form.setValue("bankAccount", "56789-0");
    });
    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.form.setValue("identityDoc", pdf());
      result.current.form.setValue("addressProofDoc", pdf());
    });
    act(() => {
      result.current.goNext();
    });

    expect(result.current.step).toBe("review");
    expect(result.current.isLastStep).toBe(true);

    // Clear a required field so full-schema submit fails
    act(() => {
      result.current.form.setValue("identityDoc", null);
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.stepError).toBeNull();
    expect(result.current.form.getFieldState("identityDoc").error).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("does not advance past the last step", async () => {
    const { result } = renderHook(() =>
      useProviderKycWizard({
        providerId: "provider-1",
        accountEmail: "provider@example.com",
      }),
    );

    await waitFor(() => {
      expect(result.current.isPrefilling).toBe(false);
    });

    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.form.setValue("fullName", "João Silva");
      result.current.form.setValue("document", "390.533.447-05");
      result.current.form.setValue("phone", "(48) 99999-9999");
    });
    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.form.setValue("bankInstitutionCode", "001");
      result.current.form.setValue("bankBranch", "1234");
      result.current.form.setValue("bankAccount", "56789-0");
    });
    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.form.setValue("identityDoc", pdf());
      result.current.form.setValue("addressProofDoc", pdf());
    });
    act(() => {
      result.current.goNext();
    });

    expect(result.current.isLastStep).toBe(true);

    act(() => {
      result.current.goNext();
    });

    expect(result.current.step).toBe("review");
  });

  it("prefills CPF profile with sparse optional fields", async () => {
    vi.mocked(kycApi.fetchProviderPrivateProfileForKyc).mockResolvedValue({
      data: {
        entityType: "CPF",
        document: "39053344705",
        bankInstitutionCode: null,
        bankBranch: null,
        bankAccount: null,
        pixKey: null,
        razaoSocial: null,
        nomeFantasia: null,
        legalRepFullName: null,
        legalRepCpf: null,
        legalRepPhone: null,
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useProviderKycWizard({
        providerId: "provider-1",
        accountEmail: "provider@example.com",
      }),
    );

    await waitFor(() => {
      expect(result.current.isPrefilling).toBe(false);
    });

    expect(result.current.form.getValues("entityType")).toBe("CPF");
    expect(result.current.form.getValues("document")).toMatch(/390\.533\.447-05/);
    expect(result.current.form.getValues("bankInstitutionCode")).toBe("");
    expect(result.current.isCnpj).toBe(false);
  });

  it("maps upload failure without error message and non-Error throws", async () => {
    vi.mocked(kycApi.uploadKycDocument).mockResolvedValue({
      path: null,
      signedUrl: null,
      sessionId: null,
      error: null,
    });

    const { result } = renderHook(() =>
      useProviderKycWizard({
        providerId: "provider-1",
        accountEmail: "provider@example.com",
      }),
    );

    await waitFor(() => {
      expect(result.current.isPrefilling).toBe(false);
    });

    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.form.setValue("fullName", "João Silva");
      result.current.form.setValue("document", "390.533.447-05");
      result.current.form.setValue("phone", "(48) 99999-9999");
    });
    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.form.setValue("bankInstitutionCode", "001");
      result.current.form.setValue("bankBranch", "1234");
      result.current.form.setValue("bankAccount", "56789-0");
    });
    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.form.setValue("identityDoc", pdf());
      result.current.form.setValue("addressProofDoc", pdf());
    });
    act(() => {
      result.current.goNext();
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.submitError).toBe("Falha ao enviar documentos");
    expect(trackEvent).toHaveBeenCalledWith(
      "provider_kyc_submit_failed",
      expect.objectContaining({ step: "review" }),
    );

    mutateAsync.mockRejectedValue("raw-failure");
    vi.mocked(kycApi.uploadKycDocument).mockResolvedValue({
      path: "p",
      signedUrl: "https://signed",
      sessionId: "s",
      error: null,
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.submitError).toBe("Falha ao enviar credenciamento");
  });

  it("submits CNPJ payload with corporate documents", async () => {
    vi.mocked(kycApi.uploadKycDocument).mockResolvedValue({
      path: "path.pdf",
      signedUrl: "https://signed.example/doc.pdf",
      sessionId: "session-1",
      error: null,
    });
    mutateAsync.mockResolvedValue({ data: { submissionId: "sub-1" }, error: null });
    const onSubmitted = vi.fn();

    const { result } = renderHook(() =>
      useProviderKycWizard({
        providerId: "provider-1",
        accountEmail: "provider@example.com",
        onSubmitted,
      }),
    );

    await waitFor(() => {
      expect(result.current.isPrefilling).toBe(false);
    });

    act(() => {
      result.current.form.setValue("entityType", "CNPJ");
    });
    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.form.setValue("fullName", "Empresa LTDA");
      result.current.form.setValue("document", "11.444.777/0001-61");
      result.current.form.setValue("phone", "(48) 99999-9999");
      result.current.form.setValue("razaoSocial", "Empresa LTDA");
      result.current.form.setValue("nomeFantasia", "Empresa");
      result.current.form.setValue("legalRepFullName", "Maria Silva");
      result.current.form.setValue("legalRepCpf", "390.533.447-05");
      result.current.form.setValue("legalRepPhone", "(48) 98888-7777");
    });
    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.form.setValue("bankInstitutionCode", "001");
      result.current.form.setValue("bankBranch", "1234");
      result.current.form.setValue("bankAccount", "56789-0");
    });
    act(() => {
      result.current.goNext();
    });
    act(() => {
      result.current.form.setValue("legalRepDoc", pdf());
      result.current.form.setValue("addressProofDoc", pdf());
      result.current.form.setValue("corporateCharterDoc", pdf());
    });
    act(() => {
      result.current.goNext();
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "CNPJ",
        razaoSocial: "Empresa LTDA",
        identityDocStoragePath: "path.pdf",
        legalRepDocStoragePath: "path.pdf",
        corporateCharterStoragePath: "path.pdf",
      }),
    );
    expect(onSubmitted).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      "provider_kyc_submitted",
      expect.objectContaining({ entity_type: "pj" }),
    );
  });

  it("ignores stale prefill after unmount", async () => {
    let resolvePrefill!: (value: {
      data: null;
      error: null;
    }) => void;
    vi.mocked(kycApi.fetchProviderPrivateProfileForKyc).mockReturnValue(
      new Promise((resolve) => {
        resolvePrefill = resolve;
      }),
    );

    const { unmount } = renderHook(() =>
      useProviderKycWizard({
        providerId: "provider-1",
        accountEmail: "provider@example.com",
      }),
    );

    unmount();
    resolvePrefill({ data: null, error: null });
    // No assertion beyond "does not throw" — cancelled flag must short-circuit setState.
    await Promise.resolve();
  });
});
