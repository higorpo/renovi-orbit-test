import { describe, it, expect } from "vitest";
import { validateBlocks, validateBlockValidation } from "../blockValidator";
import type { FormBlock } from "../../../types";

describe("validateBlocks", () => {
  it("reports error when block has no id", () => {
    const blocks: FormBlock[] = [{ id: "", type: "text", label: "X" }];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors.some((e) => e.code === "BLOCK_MISSING_ID")).toBe(true);
  });

  it("reports error for duplicate block id", () => {
    const blocks: FormBlock[] = [
      { id: "same", type: "text", label: "A" },
      { id: "same", type: "text", label: "B" },
    ];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors.some((e) => e.code === "DUPLICATE_BLOCK_ID")).toBe(true);
  });

  it("reports error when block has no type", () => {
    const blocks: FormBlock[] = [{ id: "b1", type: "" as unknown as FormBlock["type"], label: "X" }];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors.some((e) => e.code === "BLOCK_MISSING_TYPE")).toBe(true);
  });

  it("reports error for invalid block type", () => {
    const blocks: FormBlock[] = [
      { id: "b1", type: "invalid_type" as unknown as FormBlock["type"], label: "X" },
    ];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors.some((e) => e.code === "INVALID_BLOCK_TYPE")).toBe(true);
  });

  it("reports warning when block has no label (except conditional_alert)", () => {
    const blocks: FormBlock[] = [{ id: "b1", type: "text", label: "" }];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.warnings.some((e) => e.code === "BLOCK_MISSING_LABEL")).toBe(true);
  });

  it("reports error when select block has no options", () => {
    const blocks: FormBlock[] = [
      { id: "b1", type: "single_select", label: "X", options: [] },
    ];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors.some((e) => e.code === "SELECT_NO_OPTIONS")).toBe(true);
  });

  it("reports error when number block has min > max", () => {
    const blocks: FormBlock[] = [
      { id: "b1", type: "number", label: "N", min: 10, max: 5 },
    ];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors.some((e) => e.code === "INVALID_RANGE")).toBe(true);
  });

  it("returns no errors for valid text block", () => {
    const blocks: FormBlock[] = [{ id: "b1", type: "text", label: "Name" }];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors).toHaveLength(0);
  });
});

describe("validateBlockValidation", () => {
  it("reports error when date block has timeMin/timeMax", () => {
    const block: FormBlock = {
      id: "b1",
      type: "date",
      label: "D",
      validation: { timeMin: "09:00" },
    };
    const errors = validateBlockValidation(block, "steps[0].blocks[0]");
    expect(errors.some((e) => e.code === "DATE_BLOCK_INVALID_VALIDATION")).toBe(true);
  });

  it("reports error when dateMin is not YYYY-MM-DD", () => {
    const block: FormBlock = {
      id: "b1",
      type: "date",
      label: "D",
      validation: { dateMin: "invalid" },
    };
    const errors = validateBlockValidation(block, "path");
    expect(errors.some((e) => e.code === "INVALID_DATE_MIN")).toBe(true);
  });

  it("reports error when time block has dateMin/dateMax", () => {
    const block: FormBlock = {
      id: "b1",
      type: "time",
      label: "T",
      validation: { dateMin: "2025-01-01" },
    };
    const errors = validateBlockValidation(block, "path");
    expect(errors.some((e) => e.code === "TIME_BLOCK_INVALID_VALIDATION")).toBe(true);
  });

  it("reports error when timeMin is not HH:mm", () => {
    const block: FormBlock = {
      id: "b1",
      type: "time",
      label: "T",
      validation: { timeMin: "25:00" },
    };
    const errors = validateBlockValidation(block, "path");
    expect(errors.some((e) => e.code === "INVALID_TIME_MIN")).toBe(true);
  });

  it("reports error when timeMin > timeMax", () => {
    const block: FormBlock = {
      id: "b1",
      type: "time",
      label: "T",
      validation: { timeMin: "12:00", timeMax: "10:00" },
    };
    const errors = validateBlockValidation(block, "path");
    expect(errors.some((e) => e.code === "INVALID_TIME_RANGE")).toBe(true);
  });

  it("reports error when text block has minLength > maxLength", () => {
    const block: FormBlock = {
      id: "b1",
      type: "text",
      label: "T",
      validation: { minLength: 10, maxLength: 5 },
    };
    const errors = validateBlockValidation(block, "path");
    expect(errors.some((e) => e.code === "VALIDATION_INVALID_LENGTH_RANGE")).toBe(true);
  });

  it("returns no errors for date block with valid dateMin/dateMax", () => {
    const block: FormBlock = {
      id: "b1",
      type: "date",
      label: "D",
      validation: { dateMin: "2025-01-01", dateMax: "2025-12-31" },
    };
    const errors = validateBlockValidation(block, "path");
    expect(errors).toHaveLength(0);
  });
});
