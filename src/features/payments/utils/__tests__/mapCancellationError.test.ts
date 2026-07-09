import { describe, expect, it } from "vitest";
import { mapCancellationErrorMessage } from "../mapCancellationError";

describe("mapCancellationErrorMessage", () => {
  it("maps known cancellation error codes", () => {
    expect(mapCancellationErrorMessage("PAYMENT_IN_ANALYSIS")).toContain("análise antifraude");
    expect(mapCancellationErrorMessage("SERVICE_NOT_CANCELLABLE")).toContain("não pode mais ser cancelado");
    expect(mapCancellationErrorMessage("FORBIDDEN")).toContain("não tem permissão");
    expect(mapCancellationErrorMessage("SERVICE_NOT_FOUND")).toBe("Serviço não encontrado.");
    expect(mapCancellationErrorMessage("refund_failed")).toContain("estorno");
    expect(mapCancellationErrorMessage("PAYMENT_SCHEDULE_TERMINAL_STATE")).toContain("estado final");
  });

  it("returns fallback for unknown codes", () => {
    expect(mapCancellationErrorMessage("UNKNOWN_CODE")).toBe(
      "Não foi possível cancelar o serviço. Tente novamente.",
    );
  });
});
