// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AddCardSheetDialog } from "../AddCardSheetDialog";

const mockUseBreakpointMd = vi.fn(() => false);

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => mockUseBreakpointMd(),
}));

vi.mock("../CheckoutStepper/CardForm", () => ({
  CardForm: ({
    onSuccess,
    formId,
    hideActions,
  }: {
    onSuccess: (result: {
      paymentTokenId: string;
      cardBrand: string;
      cardNumberMasked: string;
    }) => void;
    formId?: string;
    hideActions?: boolean;
  }) => (
    <form
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        onSuccess({
          paymentTokenId: "token-1",
          cardBrand: "VISA",
          cardNumberMasked: "•••• 1111",
        });
      }}
    >
      <span data-testid="card-form-flags">
        {hideActions ? "hide-actions" : "show-actions"}
      </span>
      <button type="submit">submit-form</button>
    </form>
  ),
}));

describe("AddCardSheetDialog", () => {
  beforeEach(() => {
    mockUseBreakpointMd.mockReturnValue(false);
  });

  it("renders bottom sheet on mobile with Salvar cartão and Cancelar", () => {
    const onOpenChange = vi.fn();
    render(
      <AddCardSheetDialog
        open
        onOpenChange={onOpenChange}
        providerServiceId="proposal-1"
        savedCpf="390.533.447-05"
        phone="48999999999"
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText("Adicionar cartão")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar cartão/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelar/i })).toBeInTheDocument();
    expect(screen.getByTestId("card-form-flags")).toHaveTextContent("hide-actions");

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders dialog on desktop and closes after successful save", () => {
    mockUseBreakpointMd.mockReturnValue(true);
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <AddCardSheetDialog
        open
        onOpenChange={onOpenChange}
        providerServiceId="proposal-1"
        savedCpf="390.533.447-05"
        phone="48999999999"
        onSuccess={onSuccess}
      />,
    );

    expect(screen.getByText("Adicionar cartão")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar cartão/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelar/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Salvar cartão/i }));
    expect(onSuccess).toHaveBeenCalledWith({
      paymentTokenId: "token-1",
      cardBrand: "VISA",
      cardNumberMasked: "•••• 1111",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
