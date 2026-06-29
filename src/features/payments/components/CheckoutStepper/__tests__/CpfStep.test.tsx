// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as checkoutCpfApi from "../../../api/checkout.api";
import { CpfStep } from "../CpfStep";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(() => ({ user: { id: "user-1" } })),
}));

describe("CpfStep", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows validation error for invalid CPF", async () => {
    render(<CpfStep onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/CPF/i), {
      target: { value: "111.111.111-11" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getByText(/CPF inválido/i)).toBeInTheDocument();
    });
  });

  it("persists CPF and calls onComplete on success", async () => {
    const onComplete = vi.fn();
    vi.spyOn(checkoutCpfApi, "saveCheckoutCpf").mockResolvedValue({
      cpf: "390.533.447-05",
      error: null,
    });

    render(<CpfStep onComplete={onComplete} />);

    fireEvent.change(screen.getByLabelText(/CPF/i), {
      target: { value: "39053344705" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith("390.533.447-05");
    });
  });

  it("shows submit error when save fails", async () => {
    vi.spyOn(checkoutCpfApi, "saveCheckoutCpf").mockResolvedValue({
      cpf: null,
      error: "RLS violation",
    });

    render(<CpfStep onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/CPF/i), {
      target: { value: "39053344705" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("RLS violation");
    });
  });
});
