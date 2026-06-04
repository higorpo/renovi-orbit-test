import { describe, expect, it } from "vitest";
import { buildDateUnavailableRevisionInitialValues } from "../buildDateUnavailableRevisionInitialValues";

describe("buildDateUnavailableRevisionInitialValues", () => {
  it("prefills DATE_NOT_AVAILABLE with listed slots", () => {
    const result = buildDateUnavailableRevisionInitialValues([
      { start_date: "2026-06-10", shift: "morning" },
      { start_date: "2026-06-12", end_date: "2026-06-13", shift: "afternoon" },
    ]);

    expect(result.revisionReason).toBe("DATE_NOT_AVAILABLE");
    expect(result.revisionNotes).toContain("Nenhuma das datas sugeridas");
    expect(result.revisionNotes).toContain("•");
  });

  it("prefills notes without slot bullets when slots are empty", () => {
    const result = buildDateUnavailableRevisionInitialValues([]);

    expect(result.revisionReason).toBe("DATE_NOT_AVAILABLE");
    expect(result.revisionNotes).toBe(
      "Nenhuma das datas sugeridas pelo prestador funciona para mim.\n\n",
    );
  });
});
