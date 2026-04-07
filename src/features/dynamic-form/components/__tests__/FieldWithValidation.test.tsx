import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FieldWithValidation } from "../FieldWithValidation";

describe("FieldWithValidation", () => {
  it("renders children without label when label is omitted", () => {
    render(
      <FieldWithValidation id="f1" error={null} hasError={false}>
        <input id="f1" data-testid="inp" />
      </FieldWithValidation>
    );
    expect(screen.queryByText(/obrigatório/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("inp")).toBeInTheDocument();
  });

  it("renders label with required asterisk when required", () => {
    render(
      <FieldWithValidation id="f1" label="Nome" required error={null} hasError={false}>
        <input id="f1" />
      </FieldWithValidation>
    );
    expect(screen.getByText("Nome")).toBeInTheDocument();
    expect(screen.getByLabelText("obrigatório")).toBeInTheDocument();
  });

  it("shows error message when hasError and error are set", () => {
    render(
      <FieldWithValidation id="f1" label="Campo" error="Falhou" hasError>
        <input id="f1" aria-invalid />
      </FieldWithValidation>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Falhou");
  });

  it("does not show error paragraph when hasError but error is empty", () => {
    render(
      <FieldWithValidation id="f1" error="" hasError>
        <input id="f1" />
      </FieldWithValidation>
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows help text when no error", () => {
    render(
      <FieldWithValidation
        id="f1"
        label="X"
        helpText="Dica útil"
        error={null}
        hasError={false}
      >
        <input id="f1" />
      </FieldWithValidation>
    );
    expect(screen.getByText("Dica útil")).toBeInTheDocument();
  });

  it("hides help text when hasError is true", () => {
    render(
      <FieldWithValidation id="f1" helpText="Dica" error="Erro" hasError>
        <input id="f1" />
      </FieldWithValidation>
    );
    expect(screen.queryByText("Dica")).not.toBeInTheDocument();
  });

  it("renders trailing slot after children", () => {
    render(
      <FieldWithValidation
        id="f1"
        error={null}
        hasError={false}
        trailing={<span data-testid="trail">kg</span>}
      >
        <input id="f1" />
      </FieldWithValidation>
    );
    expect(screen.getByTestId("trail")).toBeInTheDocument();
  });
});
