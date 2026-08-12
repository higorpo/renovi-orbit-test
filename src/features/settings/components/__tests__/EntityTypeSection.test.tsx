import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { EntityTypeSection } from "../EntityTypeSection";

function confirmPendingChange() {
  const dialog = screen.getByRole("alertdialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Trocar" }));
}

describe("EntityTypeSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders section title and PF/PJ options", () => {
    render(<EntityTypeSection value="pf" onChange={vi.fn()} />);
    expect(screen.getByText("Tipo de entidade")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Pessoa física/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Pessoa jurídica/ })).toBeInTheDocument();
  });

  it("asks for confirmation before switching to pessoa jurídica", () => {
    const onChange = vi.fn();
    render(<EntityTypeSection value="pf" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /Pessoa jurídica/ }));

    expect(onChange).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByRole("heading", { name: "Trocar para pessoa jurídica?" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/CNPJ, razão social e representante legal/)).toBeInTheDocument();

    confirmPendingChange();
    expect(onChange).toHaveBeenCalledWith("pj");
  });

  it("asks for confirmation before switching to pessoa física", () => {
    const onChange = vi.fn();
    render(<EntityTypeSection value="pj" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /Pessoa física/ }));

    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Trocar para pessoa física?" }),
    ).toBeInTheDocument();

    confirmPendingChange();
    expect(onChange).toHaveBeenCalledWith("pf");
  });

  it("does not change entity type when the confirmation is cancelled", () => {
    const onChange = vi.fn();
    render(<EntityTypeSection value="pf" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /Pessoa jurídica/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Pessoa física/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("does not open a confirmation when the selected type is clicked again", () => {
    const onChange = vi.fn();
    render(<EntityTypeSection value="pf" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /Pessoa física/ }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("marks selected option with aria-checked", () => {
    render(<EntityTypeSection value="pf" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /Pessoa física/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: /Pessoa jurídica/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("does not call onChange when disabled and option clicked", () => {
    const onChange = vi.fn();
    render(<EntityTypeSection value="pf" onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole("radio", { name: /Pessoa jurídica/ }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows the legal disclaimer without a help dialog", () => {
    render(<EntityTypeSection value="pf" onChange={vi.fn()} />);
    expect(
      screen.getByText(/A Prestway não fornece assessoria jurídica/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Preciso de ajuda para escolher/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("marks PJ option as checked when value is pj", () => {
    render(<EntityTypeSection value="pj" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /Pessoa jurídica/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
