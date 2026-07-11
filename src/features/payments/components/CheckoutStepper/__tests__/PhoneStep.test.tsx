// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as checkoutPhoneApi from "../../../api/checkout.api";
import { PhoneStep } from "../PhoneStep";

const mockRefreshProfile = vi.fn().mockResolvedValue(undefined);
const mockUseAuth = vi.fn(() => ({
  user: { id: "user-1" },
  refreshProfile: mockRefreshProfile,
}));

vi.mock("@/features/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("PhoneStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshProfile.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      refreshProfile: mockRefreshProfile,
    });
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
    expect(mockRefreshProfile).toHaveBeenCalled();
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
    expect(mockRefreshProfile).not.toHaveBeenCalled();
  });

  it("shows session expired when user is missing", async () => {
    mockUseAuth.mockReturnValue({
      user: null as never,
      refreshProfile: mockRefreshProfile,
    });

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
