import { describe, expect, it } from "vitest";
import {
  mapSuggestedEquipmentToPt,
  mapSuggestedMaterialsToPt,
} from "../suggestedItemsMapper";

describe("mapSuggestedEquipmentToPt", () => {
  it("returns empty array for null or empty input", () => {
    expect(mapSuggestedEquipmentToPt(null)).toEqual([]);
    expect(mapSuggestedEquipmentToPt([])).toEqual([]);
  });

  it("maps known equipment keys to Portuguese labels", () => {
    expect(mapSuggestedEquipmentToPt(["ladder", "drill"])).toEqual([
      "Escada",
      "Furadeira",
    ]);
  });

  it("skips unknown equipment keys", () => {
    expect(mapSuggestedEquipmentToPt(["ladder", "unknown_tool"])).toEqual(["Escada"]);
  });
});

describe("mapSuggestedMaterialsToPt", () => {
  it("returns empty array for null or empty input", () => {
    expect(mapSuggestedMaterialsToPt(null)).toEqual([]);
    expect(mapSuggestedMaterialsToPt([])).toEqual([]);
  });

  it("maps known material keys to Portuguese labels", () => {
    expect(mapSuggestedMaterialsToPt(["other"])).toEqual(["Outro"]);
  });

  it("skips unknown material keys", () => {
    expect(mapSuggestedMaterialsToPt(["not_a_material", "other"])).toEqual(["Outro"]);
  });
});
