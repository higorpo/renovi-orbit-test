import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeleteAccountDialog } from "../DeleteAccountDialog";

describe("DeleteAccountDialog", () => {
  it("renders when open", () => {
    render(
      <DeleteAccountDialog
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: /Excluir minha conta/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("EXCLUIR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Excluir minha conta/ })).toBeInTheDocument();
  });

  it("confirm button is disabled until user types EXCLUIR", () => {
    render(
      <DeleteAccountDialog
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    const confirmBtn = screen.getByRole("button", { name: /Excluir minha conta/ });
    expect(confirmBtn).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("EXCLUIR"), {
      target: { value: "EXCLUIR" },
    });
    expect(confirmBtn).not.toBeDisabled();
  });

  it("calls onConfirm when user types EXCLUIR and clicks confirm", () => {
    const onConfirm = vi.fn();
    render(
      <DeleteAccountDialog open={true} onClose={vi.fn()} onConfirm={onConfirm} />
    );
    fireEvent.change(screen.getByPlaceholderText("EXCLUIR"), {
      target: { value: "EXCLUIR" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Excluir minha conta/ }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
