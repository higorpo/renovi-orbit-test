import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SchemaError } from "../DynamicForm/SchemaError";
import type { SchemaValidationResult } from "../../utils/schemaValidator";

describe("SchemaError", () => {
  const validationResult: SchemaValidationResult = {
    valid: false,
    errors: [
      { code: "NO_STEPS", message: "Schema must have at least one step", severity: "error" },
    ],
    warnings: [],
  };

  it("renders alert role and schema invalid title", () => {
    render(<SchemaError validationResult={validationResult} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Schema inválido")).toBeInTheDocument();
  });

  it("displays formatted validation errors in pre", () => {
    render(<SchemaError validationResult={validationResult} />);
    expect(screen.getAllByText(/NO_STEPS/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Schema must have at least one step/).length).toBeGreaterThanOrEqual(1);
  });

  it("displays schema name when provided", () => {
    render(<SchemaError validationResult={validationResult} schemaName="my-category" />);
    expect(screen.getByText(/my-category/)).toBeInTheDocument();
  });

  it("does not display schema name section when schemaName is undefined", () => {
    const { container } = render(<SchemaError validationResult={validationResult} />);
    expect(container).not.toHaveTextContent("Schema:");
  });
});
