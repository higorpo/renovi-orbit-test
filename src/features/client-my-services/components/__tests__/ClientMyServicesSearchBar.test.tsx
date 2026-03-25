import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClientMyServicesSearchBar } from "../ClientMyServicesSearchBar";

describe("ClientMyServicesSearchBar", () => {
  it("calls onChange when user types", () => {
    const onChange = vi.fn();
    render(<ClientMyServicesSearchBar value="" onChange={onChange} />);

    const input = screen.getByRole("searchbox", { name: /Buscar serviço/i });
    fireEvent.change(input, { target: { value: "pintura" } });

    expect(onChange).toHaveBeenCalledWith("pintura");
  });

  it("respects disabled prop", () => {
    render(<ClientMyServicesSearchBar value="" onChange={vi.fn()} disabled />);
    expect(screen.getByRole("searchbox", { name: /Buscar serviço/i })).toBeDisabled();
  });
});
