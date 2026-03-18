import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { EntityTypeSection } from "../EntityTypeSection";

describe("EntityTypeSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders section title and PF/PJ options", () => {
    render(
      <EntityTypeSection value="pf" onChange={vi.fn()} />
    );
    expect(screen.getByText("Tipo de entidade")).toBeInTheDocument();
    expect(screen.getByText("Pessoa física")).toBeInTheDocument();
    expect(screen.getByText("Pessoa jurídica")).toBeInTheDocument();
  });

  it("calls onChange with pf when Pessoa física is clicked", () => {
    const onChange = vi.fn();
    render(
      <EntityTypeSection value="pj" onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Pessoa física/ }));
    expect(onChange).toHaveBeenCalledWith("pf");
  });

  it("calls onChange with pj when Pessoa jurídica is clicked", () => {
    const onChange = vi.fn();
    render(
      <EntityTypeSection value="pf" onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Pessoa jurídica/ }));
    expect(onChange).toHaveBeenCalledWith("pj");
  });

  it("marks selected option with aria-pressed", () => {
    render(
      <EntityTypeSection value="pf" onChange={vi.fn()} />
    );
    const pfButton = screen.getByRole("button", { name: /Pessoa física/ });
    expect(pfButton).toHaveAttribute("aria-pressed", "true");
  });

  it("does not call onChange when disabled and option clicked", () => {
    const onChange = vi.fn();
    render(
      <EntityTypeSection value="pf" onChange={onChange} disabled />
    );
    fireEvent.click(screen.getByRole("button", { name: /Pessoa jurídica/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens help dialog when Preciso de ajuda is clicked", () => {
    render(
      <EntityTypeSection value="pf" onChange={vi.fn()} />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Preciso de ajuda para escolher/ })
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Pessoa física (PF)")).toBeInTheDocument();
    expect(screen.getByText("Pessoa jurídica (PJ)")).toBeInTheDocument();
  });

  it("shows PF and PJ descriptions in help dialog", () => {
    render(
      <EntityTypeSection value="pf" onChange={vi.fn()} />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Preciso de ajuda para escolher/ })
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Para profissionais autônomos/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Para empresas ou profissionais que atuam com CNPJ/)).toBeInTheDocument();
    expect(within(dialog).getByText(/A Renovi não fornece assessoria jurídica/)).toBeInTheDocument();
  });

  it("marks PJ option with aria-pressed when value is pj", () => {
    render(
      <EntityTypeSection value="pj" onChange={vi.fn()} />
    );
    const pjButton = screen.getByRole("button", { name: /Pessoa jurídica/ });
    expect(pjButton).toHaveAttribute("aria-pressed", "true");
  });
});
