// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as checkoutPhoneApi from "../../../api/checkout.api";
import { PhoneStep } from "../PhoneStep";

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(() => ({ user: { id: "user-1" } })),
}));

describe("PhoneStep", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows validation error for invalid phone", async () => {
    render(<PhoneStep onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Telefone/i), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Telefone inválido/i)).toBeInTheDocument();
    });
  });

  it("persists phone and calls onComplete on success", async () => {
    const onComplete = vi.fn();
    vi.spyOn(checkoutPhoneApi, "saveCheckoutPhone").mockResolvedValue({
      phone: "(48) 99999-8888",
      error: null,
    });

    render(<PhoneStep onComplete={onComplete} />);

    fireEvent.change(screen.getByLabelText(/Telefone/i), {
      target: { value: "48999998888" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith("(48) 99999-8888");
    });
  });

  it("shows submit error when save fails", async () => {
    vi.spyOn(checkoutPhoneApi, "saveCheckoutPhone").mockResolvedValue({
      phone: null,
      error: "Network error",
    });

    render(<PhoneStep onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Telefone/i), {
      target: { value: "48999998888" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });
});
