import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FormSchema } from "../../../types";
import { renderBlockByType, isBlockTypeRegistered } from "../registry";

const minimalSchema: FormSchema = {
  version: "2.0",
  id: "r",
  title: "R",
  metadata: { categorySlug: "c", categoryId: null, status: "draft" },
  config: {},
  steps: [],
};

describe("block registry", () => {
  it("isBlockTypeRegistered returns true for known types", () => {
    expect(isBlockTypeRegistered("text")).toBe(true);
    expect(isBlockTypeRegistered("preview_summary")).toBe(true);
  });

  it("isBlockTypeRegistered returns false for unknown string", () => {
    expect(isBlockTypeRegistered("unknown_xyz")).toBe(false);
  });

  it("renderBlockByType returns null when type is not in registry", () => {
    render(
      <div data-testid="wrap">
        {renderBlockByType({
          schema: minimalSchema,
          block: {
            id: "x",
            type: "not_in_registry" as unknown as "text",
            label: "L",
            description_ai: "D",
          },
          formData: {},
          setFieldValue: () => {},
          handleFieldChange: () => {},
        })}
      </div>
    );
    expect(screen.getByTestId("wrap")).toBeEmptyDOMElement();
  });

  it("renderBlockByType renders static_text block", () => {
    render(
      <>
        {renderBlockByType({
          schema: minimalSchema,
          block: {
            id: "st",
            type: "static_text",
            label: "Hello static",
            description_ai: "Static content",
          },
          formData: {},
          setFieldValue: () => {},
          handleFieldChange: () => {},
        })}
      </>
    );
    expect(screen.getByText("Hello static")).toBeInTheDocument();
  });
});
