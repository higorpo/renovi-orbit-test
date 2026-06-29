// @vitest-environment happy-dom
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useInstallmentSignatureRecovery } from "../useInstallmentOptions";

describe("useInstallmentSignatureRecovery", () => {
  it("re-fetches installment options and preserves the selected card token", async () => {
    const refetchInstallments = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ paymentTokenId }: { paymentTokenId: string }) =>
        useInstallmentSignatureRecovery(paymentTokenId, refetchInstallments),
      { initialProps: { paymentTokenId: "token-abc" } },
    );

    rerender({ paymentTokenId: "token-abc" });

    await act(async () => {
      const preservedTokenId = await result.current.handleSignatureExpired();
      expect(preservedTokenId).toBe("token-abc");
    });

    expect(refetchInstallments).toHaveBeenCalledTimes(1);
    expect(result.current.paymentTokenId).toBe("token-abc");
  });
});
