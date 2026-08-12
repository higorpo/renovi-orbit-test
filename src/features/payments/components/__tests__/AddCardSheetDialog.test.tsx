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
    accountFullName,
    tokenizeContext,
    onPendingChange,
  }: {
    onSuccess: (result: {
      paymentTokenId: string;
      cardBrand: string;
      cardNumberMasked: string;
    }) => void;
    formId?: string;
    hideActions?: boolean;
    accountFullName?: string | null;
    tokenizeContext?: "checkout" | "profile";
    onPendingChange?: (pending: boolean) => void;
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
      <span data-testid="account-full-name">{accountFullName ?? ""}</span>
      <span data-testid="tokenize-context">{tokenizeContext ?? ""}</span>
      <button
        type="button"
        onClick={() => onPendingChange?.(true)}
      >
        mark-pending
      </button>
      <button type="submit">submit-form</button>
    </form>
  ),
}));

const mockUseAuth = vi.fn(() => ({
  profile: { full_name: "Maria Silva" },
}));

vi.mock("@/features/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("AddCardSheetDialog", () => {
  beforeEach(() => {
    mockUseBreakpointMd.mockReturnValue(false);
    mockUseAuth.mockReturnValue({
      profile: { full_name: "Maria Silva" },
    });
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
    expect(screen.getByTestId("account-full-name")).toHaveTextContent("Maria Silva");

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

  it("renders right sheet on desktop when desktopPresentation is sheet", () => {
    mockUseBreakpointMd.mockReturnValue(true);
    const onOpenChange = vi.fn();

    render(
      <AddCardSheetDialog
        open
        onOpenChange={onOpenChange}
        desktopPresentation="sheet"
        tokenizeContext="profile"
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByText("Adicionar cartão")).toBeInTheDocument();
    expect(
      screen.getByText(/enviados de forma segura/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar cartão/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fechar/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("blocks close and shows Salvando while tokenization is pending", () => {
    const onOpenChange = vi.fn();
    render(
      <AddCardSheetDialog
        open
        onOpenChange={onOpenChange}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /mark-pending/i }));

    expect(screen.getByRole("button", { name: /Salvando/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Cancelar/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Fechar/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes via sheet/dialog dismiss when not pending", () => {
    const onOpenChange = vi.fn();
    render(
      <AddCardSheetDialog
        open
        onOpenChange={onOpenChange}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("blocks desktop dialog dismiss while pending", () => {
    mockUseBreakpointMd.mockReturnValue(true);
    const onOpenChange = vi.fn();
    render(
      <AddCardSheetDialog
        open
        onOpenChange={onOpenChange}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /mark-pending/i }));
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("does not mount CardForm when closed and passes profile tokenize context", () => {
    mockUseAuth.mockReturnValue({ profile: null as unknown as { full_name: string } });

    const { rerender } = render(
      <AddCardSheetDialog
        open={false}
        onOpenChange={vi.fn()}
        tokenizeContext="profile"
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("card-form-flags")).toBeNull();

    rerender(
      <AddCardSheetDialog
        open
        onOpenChange={vi.fn()}
        tokenizeContext="profile"
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByTestId("tokenize-context")).toHaveTextContent("profile");
    expect(screen.getByTestId("account-full-name")).toHaveTextContent("");
  });
});
