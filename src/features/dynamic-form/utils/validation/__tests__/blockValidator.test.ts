import { describe, it, expect } from "vitest";
import { validateBlocks, validateBlockValidation } from "../blockValidator";
import type { FormBlock } from "../../../types";

describe("validateBlocks", () => {
  it("reports error when block has no id", () => {
    const blocks: FormBlock[] = [{ id: "", type: "text", label: "X", description_ai: "X" }];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors.some((e) => e.code === "BLOCK_MISSING_ID")).toBe(true);
  });

  it("reports error for duplicate block id", () => {
    const blocks: FormBlock[] = [
      { id: "same", type: "text", label: "A", description_ai: "A" },
      { id: "same", type: "text", label: "B", description_ai: "B" },
    ];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors.some((e) => e.code === "DUPLICATE_BLOCK_ID")).toBe(true);
  });

  it("reports error when block has no type", () => {
    const blocks: FormBlock[] = [{ id: "b1", type: "" as unknown as FormBlock["type"], label: "X", description_ai: "X" }];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors.some((e) => e.code === "BLOCK_MISSING_TYPE")).toBe(true);
  });

  it("reports error for invalid block type", () => {
    const blocks: FormBlock[] = [
      { id: "b1", type: "invalid_type" as unknown as FormBlock["type"], label: "X", description_ai: "X" },
    ];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors.some((e) => e.code === "INVALID_BLOCK_TYPE")).toBe(true);
  });

  it("reports warning when block has no label (except conditional_alert)", () => {
    const blocks: FormBlock[] = [{ id: "b1", type: "text", label: "", description_ai: "Text" }];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.warnings.some((e) => e.code === "BLOCK_MISSING_LABEL")).toBe(true);
  });

  it("does not warn about missing label for conditional_alert", () => {
    const blocks: FormBlock[] = [
      { id: "alert1", type: "conditional_alert", label: "", description_ai: "Alert" },
    ];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.warnings.some((e) => e.code === "BLOCK_MISSING_LABEL")).toBe(false);
  });

  it("reports INVALID_RANGE when slider min is greater than max", () => {
    const blocks: FormBlock[] = [
      { id: "b1", type: "slider", label: "S", min: 10, max: 5, description_ai: "Slider" },
    ];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors.some((e) => e.code === "INVALID_RANGE")).toBe(true);
  });

  it("reports OPTION_INVALID for checkbox options missing label", () => {
    const blocks: FormBlock[] = [
      {
        id: "b1",
        type: "checkbox",
        label: "C",
        description_ai: "C",
        options: [{ value: "a", label: "" }],
      },
    ];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors.some((e) => e.code === "OPTION_INVALID")).toBe(true);
  });

  it("reports error when block has no or empty description_ai", () => {
    const blocks: FormBlock[] = [{ id: "b1", type: "text", label: "Name", description_ai: "" }];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors.some((e) => e.code === "BLOCK_MISSING_DESCRIPTION_AI")).toBe(true);
  });

  it("reports error when select block has no options", () => {
    const blocks: FormBlock[] = [
      { id: "b1", type: "single_select", label: "X", options: [], description_ai: "Select" },
    ];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors.some((e) => e.code === "SELECT_NO_OPTIONS")).toBe(true);
  });

  it("reports error when number block has min > max", () => {
    const blocks: FormBlock[] = [
      { id: "b1", type: "number", label: "N", min: 10, max: 5, description_ai: "Number" },
    ];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors.some((e) => e.code === "INVALID_RANGE")).toBe(true);
  });

  it("returns no errors for valid text block", () => {
    const blocks: FormBlock[] = [{ id: "b1", type: "text", label: "Name", description_ai: "User name" }];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors).toHaveLength(0);
  });

  it("reports OPTION_INVALID when option lacks value or label", () => {
    const blocks: FormBlock[] = [
      {
        id: "b1",
        type: "single_select",
        label: "S",
        description_ai: "S",
        options: [{ value: "", label: "A" }],
      },
    ];
    const result = validateBlocks(blocks, "s1", "steps[0]");
    expect(result.errors.some((e) => e.code === "OPTION_INVALID")).toBe(true);
  });

  it("treats non-string description_ai as missing", () => {
    const blocks: FormBlock[] = [
      { id: "b1", type: "text", label: "X", description_ai: "   " as unknown as string },
    ];
    const blocksBad: FormBlock[] = [
      { id: "b2", type: "text", label: "X", description_ai: 1 as unknown as string },
    ];
    expect(validateBlocks(blocks, "s1", "steps[0]").errors.some((e) => e.code === "BLOCK_MISSING_DESCRIPTION_AI")).toBe(
      true
    );
    expect(validateBlocks(blocksBad, "s1", "steps[1]").errors.some((e) => e.code === "BLOCK_MISSING_DESCRIPTION_AI")).toBe(
      true
    );
  });
});

describe("blockValidator additional branches", () => {
  it.each(["multi_select", "radio"] as const)(
    "reports SELECT_NO_OPTIONS when %s options are undefined",
    (type) => {
      const block = {
        id: "select",
        type,
        label: "Select",
        description_ai: "Selection",
      } as FormBlock;

      expect(
        validateBlocks([block], "step", "steps[0]").errors.some(
          (error) => error.code === "SELECT_NO_OPTIONS",
        ),
      ).toBe(true);
    },
  );

  it("reports OPTION_INVALID when an option has an empty value and a label", () => {
    const block: FormBlock = {
      id: "multi",
      type: "multi_select",
      label: "Select",
      description_ai: "Selection",
      options: [{ value: "", label: "Named option" }],
    };

    expect(
      validateBlocks([block], "step", "steps[0]").errors.some(
        (error) => error.code === "OPTION_INVALID",
      ),
    ).toBe(true);
  });

  it("does not report INVALID_RANGE when only min is defined", () => {
    const block: FormBlock = {
      id: "number",
      type: "number",
      label: "Number",
      description_ai: "Number",
      min: 5,
    };

    expect(
      validateBlocks([block], "step", "steps[0]").errors.some(
        (error) => error.code === "INVALID_RANGE",
      ),
    ).toBe(false);
  });

  it("returns no errors when validation is null", () => {
    const block = {
      id: "text",
      type: "text",
      label: "Text",
      description_ai: "Text",
      validation: null,
    } as unknown as FormBlock;

    expect(validateBlockValidation(block, "path")).toHaveLength(0);
  });

  it("reports INVALID_DATE_MIN when dateMin is numeric", () => {
    const block = {
      id: "date",
      type: "date",
      label: "Date",
      description_ai: "Date",
      validation: { dateMin: 20250101 },
    } as unknown as FormBlock;

    expect(
      validateBlockValidation(block, "path").some(
        (error) => error.code === "INVALID_DATE_MIN",
      ),
    ).toBe(true);
  });

  it("reports invalid length range for textarea", () => {
    const block: FormBlock = {
      id: "textarea",
      type: "textarea",
      label: "Details",
      description_ai: "Details",
      validation: { minLength: 10, maxLength: 2 },
    };

    expect(
      validateBlockValidation(block, "path").some(
        (error) => error.code === "VALIDATION_INVALID_LENGTH_RANGE",
      ),
    ).toBe(true);
  });

  it("forbids date validation on a number block", () => {
    const block: FormBlock = {
      id: "number",
      type: "number",
      label: "Number",
      description_ai: "Number",
      validation: { dateMin: "2025-01-01" },
    };

    expect(
      validateBlockValidation(block, "path").some(
        (error) => error.code === "VALIDATION_DATE_FORBIDDEN",
      ),
    ).toBe(true);
  });
});

describe("validateBlockValidation", () => {
  it("reports error when date block has timeMin/timeMax", () => {
    const block: FormBlock = {
      id: "b1",
      type: "date",
      label: "D",
      description_ai: "Date",
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
      description_ai: "Date",
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
      description_ai: "Time",
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
      description_ai: "Time",
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
      description_ai: "Time",
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
      description_ai: "Text",
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
      description_ai: "Date",
      validation: { dateMin: "2025-01-01", dateMax: "2025-12-31" },
    };
    const errors = validateBlockValidation(block, "path");
    expect(errors).toHaveLength(0);
  });

  it("reports INVALID_DATE_MAX and INVALID_DATE_RANGE for date block", () => {
    const badMax: FormBlock = {
      id: "b1",
      type: "date",
      label: "D",
      description_ai: "Date",
      validation: { dateMax: "not-a-date" },
    };
    expect(validateBlockValidation(badMax, "path").some((e) => e.code === "INVALID_DATE_MAX")).toBe(true);

    const badRange: FormBlock = {
      id: "b2",
      type: "date",
      label: "D",
      description_ai: "Date",
      validation: { dateMin: "2025-12-31", dateMax: "2025-01-01" },
    };
    expect(validateBlockValidation(badRange, "path").some((e) => e.code === "INVALID_DATE_RANGE")).toBe(true);
  });

  it("reports INVALID_TIME_MAX for time block", () => {
    const block: FormBlock = {
      id: "b1",
      type: "time",
      label: "T",
      description_ai: "Time",
      validation: { timeMax: "99:00" },
    };
    expect(validateBlockValidation(block, "path").some((e) => e.code === "INVALID_TIME_MAX")).toBe(true);
  });

  it("returns no validation errors when validation is absent", () => {
    const block: FormBlock = {
      id: "b1",
      type: "text",
      label: "T",
      description_ai: "T",
    };
    expect(validateBlockValidation(block, "path")).toHaveLength(0);
  });

  it("reports forbidden date/time validation on text block", () => {
    const withDate: FormBlock = {
      id: "b1",
      type: "text",
      label: "T",
      description_ai: "T",
      validation: { dateMin: "2025-01-01" },
    };
    const withTime: FormBlock = {
      id: "b2",
      type: "textarea",
      label: "T",
      description_ai: "T",
      validation: { timeMin: "09:00" },
    };
    expect(validateBlockValidation(withDate, "p").some((e) => e.code === "VALIDATION_DATE_FORBIDDEN")).toBe(true);
    expect(validateBlockValidation(withTime, "p").some((e) => e.code === "VALIDATION_TIME_FORBIDDEN")).toBe(true);
  });

  it("reports VALIDATION_INVALID_NUMBER_RANGE for number block", () => {
    const block: FormBlock = {
      id: "b1",
      type: "number",
      label: "N",
      description_ai: "N",
      validation: { min: 10, max: 5 },
    };
    expect(
      validateBlockValidation(block, "path").some((e) => e.code === "VALIDATION_INVALID_NUMBER_RANGE")
    ).toBe(true);
  });

  it("reports VALIDATION_INVALID_NUMBER_RANGE for slider block", () => {
    const block: FormBlock = {
      id: "b1",
      type: "slider",
      label: "S",
      description_ai: "S",
      validation: { min: 10, max: 5 },
    };
    expect(
      validateBlockValidation(block, "path").some((e) => e.code === "VALIDATION_INVALID_NUMBER_RANGE")
    ).toBe(true);
  });

  it("returns no errors when validation is a non-object value", () => {
    const block = {
      id: "b1",
      type: "text",
      label: "T",
      description_ai: "T",
      validation: "bad" as unknown as FormBlock["validation"],
    } as FormBlock;
    expect(validateBlockValidation(block, "path")).toHaveLength(0);
  });

  it("allows equal min and max on slider block", () => {
    const blocks: FormBlock[] = [
      { id: "b1", type: "slider", label: "S", min: 5, max: 5, description_ai: "Slider" },
    ];
    expect(validateBlocks(blocks, "s1", "steps[0]").errors.some((e) => e.code === "INVALID_RANGE")).toBe(
      false,
    );
  });

  it("allows equal validation.min and validation.max", () => {
    const block: FormBlock = {
      id: "b1",
      type: "number",
      label: "N",
      description_ai: "N",
      validation: { min: 5, max: 5 },
    };
    expect(
      validateBlockValidation(block, "path").some((e) => e.code === "VALIDATION_INVALID_NUMBER_RANGE"),
    ).toBe(false);
  });

  it("accepts date block with only dateMin", () => {
    const block: FormBlock = {
      id: "b1",
      type: "date",
      label: "D",
      description_ai: "Date",
      validation: { dateMin: "2025-01-01" },
    };
    expect(validateBlockValidation(block, "path")).toHaveLength(0);
  });

  it("accepts time block with only timeMax", () => {
    const block: FormBlock = {
      id: "b1",
      type: "time",
      label: "T",
      description_ai: "Time",
      validation: { timeMax: "18:00" },
    };
    expect(validateBlockValidation(block, "path")).toHaveLength(0);
  });

  it("does not report INVALID_RANGE when only max is set on slider", () => {
    const blocks: FormBlock[] = [
      { id: "b1", type: "slider", label: "S", max: 10, description_ai: "Slider" },
    ];
    expect(validateBlocks(blocks, "s1", "steps[0]").errors.some((e) => e.code === "INVALID_RANGE")).toBe(
      false,
    );
  });

  it("reports SELECT_NO_OPTIONS for checkbox without options", () => {
    const blocks: FormBlock[] = [
      { id: "b1", type: "checkbox", label: "C", description_ai: "C", options: [] },
    ];
    expect(validateBlocks(blocks, "s1", "steps[0]").errors.some((e) => e.code === "SELECT_NO_OPTIONS")).toBe(
      true,
    );
  });
});
