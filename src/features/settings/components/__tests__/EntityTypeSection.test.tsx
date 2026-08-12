import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EntityTypeSection } from "../EntityTypeSection";

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

  it("calls onChange with pf when Pessoa física is clicked", () => {
    const onChange = vi.fn();
    render(<EntityTypeSection value="pj" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /Pessoa física/ }));
    expect(onChange).toHaveBeenCalledWith("pf");
  });

  it("calls onChange with pj when Pessoa jurídica is clicked", () => {
    const onChange = vi.fn();
    render(<EntityTypeSection value="pf" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /Pessoa jurídica/ }));
    expect(onChange).toHaveBeenCalledWith("pj");
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
    expect(onChange).not.toBeCalled();
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
