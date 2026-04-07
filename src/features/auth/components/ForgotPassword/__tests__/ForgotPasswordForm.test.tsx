import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ForgotPasswordForm } from "../ForgotPasswordForm";

describe("ForgotPasswordForm", () => {
  it("submits and shows errors", () => {
    const onSubmit = vi.fn();
    render(
      <ForgotPasswordForm
        formData={{ email: "a@b.com" }}
        setFormData={vi.fn()}
        errors={{ email: "Invalid" }}
        submitting={false}
        onSubmit={onSubmit}
      />
    );
    expect(screen.getByText("Invalid")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Enviar link de redefinição/i }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("shows loading state", () => {
    render(
      <ForgotPasswordForm
        formData={{ email: "" }}
        setFormData={vi.fn()}
        errors={{}}
        submitting
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /Enviando/i })).toBeDisabled();
  });
});
