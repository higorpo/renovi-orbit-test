import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("wires single_select other text via setFieldValue", () => {
    const setFieldValue = vi.fn();
    const handleFieldChange = vi.fn();
    render(
      <>
        {renderBlockByType({
          schema: minimalSchema,
          block: {
            id: "sel",
            type: "single_select",
            label: "Escolha",
            description_ai: "Select",
            options: [
              { value: "a", label: "A" },
              { value: "other", label: "Outro" },
            ],
            config: { allowOther: true },
          },
          formData: { sel: "other", sel_other_text: "x" },
          setFieldValue,
          handleFieldChange,
        })}
      </>
    );
    fireEvent.change(screen.getByDisplayValue("x"), {
      target: { value: "novo" },
    });
    expect(setFieldValue).toHaveBeenCalledWith("sel_other_text", "novo");
  });

  it("wires multi_select other text via setFieldValue", () => {
    const setFieldValue = vi.fn();
    render(
      <>
        {renderBlockByType({
          schema: minimalSchema,
          block: {
            id: "multi",
            type: "multi_select",
            label: "Multi",
            description_ai: "Multi",
            options: [
              { value: "a", label: "A" },
              { value: "other", label: "Outro" },
            ],
            config: { allowOther: true },
          },
          formData: { multi: ["other"], multi_other_text: "detalhe" },
          setFieldValue,
          handleFieldChange: () => {},
        })}
      </>
    );
    fireEvent.change(screen.getByDisplayValue("detalhe"), {
      target: { value: "atualizado" },
    });
    expect(setFieldValue).toHaveBeenCalledWith("multi_other_text", "atualizado");
  });

  it("calls handleFieldChange when text block value changes", () => {
    const handleFieldChange = vi.fn();
    render(
      <>
        {renderBlockByType({
          schema: minimalSchema,
          block: {
            id: "t1",
            type: "text",
            label: "Campo",
            description_ai: "Text",
          },
          formData: { t1: "" },
          setFieldValue: () => {},
          handleFieldChange,
        })}
      </>
    );
    fireEvent.change(screen.getByLabelText(/Campo/i), {
      target: { value: "hi" },
    });
    expect(handleFieldChange).toHaveBeenCalledWith("t1", "hi");
  });
});
