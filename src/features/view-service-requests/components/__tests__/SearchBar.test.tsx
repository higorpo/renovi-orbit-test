import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchBar } from "../SearchBar";

describe("SearchBar", () => {
  it("renders with placeholder and value", () => {
    render(
      <SearchBar value="test" onChange={vi.fn()} />
    );
    const input = screen.getByRole("searchbox", { name: /Buscar serviço/i });
    expect(input).toHaveValue("test");
    expect(input).toHaveAttribute(
      "placeholder",
      "Buscar serviço... Ex: eletricista, pintura, banheiro"
    );
  });

  it("calls onChange when user types", () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);
    const input = screen.getByRole("searchbox", { name: /Buscar serviço/i });
    fireEvent.change(input, { target: { value: "pintura" } });
    expect(onChange).toHaveBeenCalledWith("pintura");
  });
});
