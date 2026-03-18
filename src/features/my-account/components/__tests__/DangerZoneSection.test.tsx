import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DangerZoneSection } from "../DangerZoneSection";

describe("DangerZoneSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders zone title and description", () => {
    render(
      <DangerZoneSection
        deleteDialogOpen={false}
        onDeleteDialogOpen={vi.fn()}
      />
    );
    expect(screen.getByText("Zona de perigo")).toBeInTheDocument();
    expect(
      screen.getByText(/Essa ação é irreversível/)
    ).toBeInTheDocument();
  });

  it("renders Excluir minha conta button", () => {
    render(
      <DangerZoneSection
        deleteDialogOpen={false}
        onDeleteDialogOpen={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: /Excluir minha conta/ })
    ).toBeInTheDocument();
  });

  it("calls onDeleteDialogOpen(true) when button is clicked", () => {
    const onDeleteDialogOpen = vi.fn();
    render(
      <DangerZoneSection
        deleteDialogOpen={false}
        onDeleteDialogOpen={onDeleteDialogOpen}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Excluir minha conta/ }));
    expect(onDeleteDialogOpen).toHaveBeenCalledWith(true);
  });

  it("disables button when isDeleting is true", () => {
    render(
      <DangerZoneSection
        deleteDialogOpen={false}
        onDeleteDialogOpen={vi.fn()}
        isDeleting
      />
    );
    expect(
      screen.getByRole("button", { name: /Excluir minha conta/ })
    ).toBeDisabled();
  });

  it("renders DeleteAccountDialog when deleteDialogOpen is true", () => {
    render(
      <DangerZoneSection
        deleteDialogOpen={true}
        onDeleteDialogOpen={vi.fn()}
      />
    );
    expect(
      screen.getByRole("heading", { name: /Excluir minha conta/ })
    ).toBeInTheDocument();
  });

  it("calls onDeleteConfirm when dialog confirm is used", () => {
    const onDeleteConfirm = vi.fn();
    render(
      <DangerZoneSection
        deleteDialogOpen={true}
        onDeleteDialogOpen={vi.fn()}
        onDeleteConfirm={onDeleteConfirm}
      />
    );
    fireEvent.change(screen.getByPlaceholderText("EXCLUIR"), {
      target: { value: "EXCLUIR" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Excluir minha conta/ })
    );
    expect(onDeleteConfirm).toHaveBeenCalled();
  });

  it("calls onDeleteDialogOpen(false) when dialog Cancelar is clicked", () => {
    const onDeleteDialogOpen = vi.fn();
    render(
      <DangerZoneSection
        deleteDialogOpen={true}
        onDeleteDialogOpen={onDeleteDialogOpen}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));
    expect(onDeleteDialogOpen).toHaveBeenCalledWith(false);
  });
});
