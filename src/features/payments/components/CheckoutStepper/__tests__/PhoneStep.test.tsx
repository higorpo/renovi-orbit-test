// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as checkoutPhoneApi from "../../../api/checkout.api";
import { PhoneStep } from "../PhoneStep";

const mockUseAuth = vi.fn(() => ({ user: { id: "user-1" } }));

vi.mock("@/features/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("PhoneStep", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
  });

  it("shows validation error for invalid phone", async () => {
    render(<PhoneStep onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Telefone/i), {
      target: { value: "123" },
    });
    fireEvent.submit(screen.getByTestId("checkout-step-phone"));

    await waitFor(() => {
      expect(screen.getByText(/Telefone inválido/i)).toBeInTheDocument();
    });
  });

  it("persists phone and calls onComplete on success", async () => {
    const onComplete = vi.fn();
    vi.spyOn(checkoutPhoneApi, "saveCheckoutPhone").mockResolvedValue({
      phone: "(48) 99999-9999",
      error: null,
    });

    render(<PhoneStep onComplete={onComplete} />);

    fireEvent.change(screen.getByLabelText(/Telefone/i), {
      target: { value: "48999999999" },
    });
    fireEvent.submit(screen.getByTestId("checkout-step-phone"));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith("(48) 99999-9999");
    });
  });

  it("shows submit error when save fails", async () => {
    vi.spyOn(checkoutPhoneApi, "saveCheckoutPhone").mockResolvedValue({
      phone: null,
      error: "RLS violation",
    });

    render(<PhoneStep onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Telefone/i), {
      target: { value: "48999999999" },
    });
    fireEvent.submit(screen.getByTestId("checkout-step-phone"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("RLS violation");
    });
  });

  it("shows session expired when user is missing", async () => {
    mockUseAuth.mockReturnValue({ user: null as never });

    render(<PhoneStep onComplete={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Telefone/i), {
      target: { value: "48999999999" },
    });
    fireEvent.submit(screen.getByTestId("checkout-step-phone"));

    await waitFor(() => {
      expect(screen.getByText(/Sessão expirada/i)).toBeInTheDocument();
    });
  });
});
