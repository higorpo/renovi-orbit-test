import { describe, expect, it } from "vitest";
import { mapServiceCompletionErrorMessage } from "../mapServiceCompletionError";

describe("mapServiceCompletionErrorMessage", () => {
  it("maps known error codes to PT-BR messages", () => {
    expect(mapServiceCompletionErrorMessage("SERVICE_NOT_YET_DUE")).toMatch(/data agendada/i);
    expect(mapServiceCompletionErrorMessage("INVALID_STATUS_TRANSITION")).toMatch(/status/i);
  });

  it("falls back for unknown codes", () => {
    expect(mapServiceCompletionErrorMessage("UNKNOWN_CODE")).toMatch(/Não foi possível/i);
  });
});
