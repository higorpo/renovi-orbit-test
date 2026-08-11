import { describe, expect, it } from "vitest";
import {
  getFormResponseIcon,
  isFormResponseFullWidth,
} from "../formResponsePresentation";

describe("formResponsePresentation", () => {
  it("marks long text block types as full width", () => {
    expect(isFormResponseFullWidth("textarea")).toBe(true);
    expect(isFormResponseFullWidth("description_ai")).toBe(true);
    expect(isFormResponseFullWidth("image_gallery")).toBe(true);
    expect(isFormResponseFullWidth("urgency")).toBe(false);
    expect(isFormResponseFullWidth("yes_no")).toBe(false);
  });

  it("resolves icons by block type", () => {
    expect(getFormResponseIcon("property_type").displayName || getFormResponseIcon("property_type").name).toBeTruthy();
    expect(getFormResponseIcon("urgency")).not.toBe(getFormResponseIcon("yes_no"));
    expect(getFormResponseIcon("unknown_type")).toBe(getFormResponseIcon("totally_unknown"));
  });
});
