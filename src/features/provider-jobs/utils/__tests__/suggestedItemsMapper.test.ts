import { describe, expect, it } from "vitest";
import {
  EQUIPMENT_LABEL_MAP,
  MATERIALS_LABEL_MAP,
  mapSuggestedEquipmentToPt,
  mapSuggestedMaterialsToPt,
} from "../suggestedItemsMapper";

describe("suggestedItemsMapper", () => {
  it("maps known equipment keys to Portuguese labels", () => {
    expect(mapSuggestedEquipmentToPt(["drill", "hammer"])).toEqual([
      "Furadeira",
      "Martelo",
    ]);
  });

  it("maps known material keys to Portuguese labels", () => {
    expect(mapSuggestedMaterialsToPt(["silicone_sealant"])).toEqual([
      "Selante de silicone",
    ]);
  });

  it("returns empty array for null, undefined, or empty input", () => {
    expect(mapSuggestedEquipmentToPt(null)).toEqual([]);
    expect(mapSuggestedMaterialsToPt(null)).toEqual([]);
    expect(mapSuggestedEquipmentToPt([])).toEqual([]);
  });

  it("drops unknown keys", () => {
    expect(mapSuggestedEquipmentToPt(["not_a_real_key" as never])).toEqual([]);
    expect(mapSuggestedMaterialsToPt(["not_a_real_key" as never])).toEqual([]);
  });

  it("exports label maps with expected keys", () => {
    expect(EQUIPMENT_LABEL_MAP.drill).toBe("Furadeira");
    expect(MATERIALS_LABEL_MAP.other).toBe("Outro");
  });
});
