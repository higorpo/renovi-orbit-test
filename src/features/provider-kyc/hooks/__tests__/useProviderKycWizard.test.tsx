// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderKycWizard } from "../useProviderKycWizard";

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

describe("useProviderKycWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(result.current.stepError).toMatch(/Informe o nome completo|CPF inválido/i);
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
});
