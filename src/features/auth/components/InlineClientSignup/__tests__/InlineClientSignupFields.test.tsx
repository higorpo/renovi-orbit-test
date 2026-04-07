import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { InlineClientSignupFields } from "../InlineClientSignupFields";

function Harness() {
  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
  });
  return <InlineClientSignupFields data={data} onDataChange={setData} />;
}

describe("InlineClientSignupFields", () => {
  it("updates controlled fields", () => {
    render(<Harness />);
    fireEvent.change(screen.getByPlaceholderText("Nome"), {
      target: { value: "Ana" },
    });
    fireEvent.change(screen.getByPlaceholderText("Sobrenome"), {
      target: { value: "Costa" },
    });
    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), {
      target: { value: "ana@example.com" },
    });
    expect(screen.getByPlaceholderText("Nome")).toHaveValue("Ana");
    expect(screen.getByPlaceholderText("Sobrenome")).toHaveValue("Costa");
    expect(screen.getByPlaceholderText("seu@email.com")).toHaveValue(
      "ana@example.com"
    );
  });

  it("shows mismatch alert when confirm password differs", () => {
    const { container } = render(<Harness />);
    const [pwdInput, confirmInput] = container.querySelectorAll(
      'input[type="password"]'
    );
    fireEvent.change(pwdInput, { target: { value: "Secret1!abcd" } });
    fireEvent.change(confirmInput, { target: { value: "other" } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "As senhas não coincidem."
    );
  });

  it("toggles terms checkbox", () => {
    render(<Harness />);
    const box = screen.getByRole("checkbox", { name: /Li e aceito/i });
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(box).toBeChecked();
  });

  it("renders custom title and terms label", () => {
    render(
      <InlineClientSignupFields
        data={{
          firstName: "",
          lastName: "",
          email: "",
          password: "",
          confirmPassword: "",
          termsAccepted: false,
        }}
        onDataChange={vi.fn()}
        title="Dados do cliente"
        termsLabel={<span>Custom terms text</span>}
      />
    );
    expect(screen.getByText("Dados do cliente")).toBeInTheDocument();
    expect(screen.getByText("Custom terms text")).toBeInTheDocument();
  });
});
