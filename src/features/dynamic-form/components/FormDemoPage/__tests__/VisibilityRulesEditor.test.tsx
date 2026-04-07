import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { VisibilityRule } from "../../../types";
import { VisibilityRulesEditor } from "../VisibilityRulesEditor";

describe("VisibilityRulesEditor", () => {
  it("shows empty hint and adds a default rule", () => {
    const onChange = vi.fn();
    render(
      <VisibilityRulesEditor rules={[]} fieldIds={["f1", "f2"]} onChange={onChange} />
    );
    expect(screen.getByText(/Nenhuma regra/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const added = onChange.mock.calls[0][0] as VisibilityRule[];
    expect(added).toHaveLength(1);
    expect(added[0].operator).toBe("equals");
  });

  it("updates dependsOn via field select", async () => {
    const rules: VisibilityRule[] = [{ dependsOn: "", operator: "equals", value: "" }];
    const onChange = vi.fn();
    render(<VisibilityRulesEditor rules={rules} fieldIds={["a", "b"]} onChange={onChange} />);

    const combos = screen.getAllByRole("combobox");
    fireEvent.click(combos[0]);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "a" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("option", { name: "a" }));
    expect(onChange).toHaveBeenCalledWith([{ ...rules[0], dependsOn: "a" }]);
  });

  it("updates operator and value and removes rule", async () => {
    const rules: VisibilityRule[] = [{ dependsOn: "x", operator: "equals", value: "" }];
    const onChange = vi.fn();
    render(<VisibilityRulesEditor rules={rules} fieldIds={["x"]} onChange={onChange} />);

    const combos = screen.getAllByRole("combobox");
    fireEvent.click(combos[1]);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /Diferente de/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("option", { name: /Diferente de/ }));
    expect(onChange).toHaveBeenCalled();

    const valueInput = screen.getByPlaceholderText(/Valor ou valores/);
    fireEvent.change(valueInput, { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ value: "hello" })]);

    onChange.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Remover regra" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("uses array value for in operator and number for greaterThan", () => {
    const rulesIn: VisibilityRule[] = [{ dependsOn: "x", operator: "in", value: [] }];
    const onChangeIn = vi.fn();
    const { rerender } = render(
      <VisibilityRulesEditor rules={rulesIn} fieldIds={["x"]} onChange={onChangeIn} />
    );
    const valueInput = screen.getByPlaceholderText(/Valor ou valores/);
    fireEvent.change(valueInput, { target: { value: "a, b , c" } });
    expect(onChangeIn).toHaveBeenCalledWith([
      { dependsOn: "x", operator: "in", value: ["a", "b", "c"] },
    ]);

    const rulesGt: VisibilityRule[] = [{ dependsOn: "n", operator: "greaterThan", value: 0 }];
    onChangeIn.mockClear();
    rerender(
      <VisibilityRulesEditor rules={rulesGt} fieldIds={["n"]} onChange={onChangeIn} />
    );
    const numInput = screen.getByPlaceholderText(/Valor ou valores/);
    fireEvent.change(numInput, { target: { value: "42" } });
    expect(onChangeIn).toHaveBeenCalledWith([
      { dependsOn: "n", operator: "greaterThan", value: 42 },
    ]);
    fireEvent.change(numInput, { target: { value: "" } });
    expect(onChangeIn).toHaveBeenCalledWith([
      { dependsOn: "n", operator: "greaterThan", value: undefined },
    ]);
  });

  it("hides value row for isEmpty and isNotEmpty operators", () => {
    const rules: VisibilityRule[] = [{ dependsOn: "x", operator: "isEmpty" }];
    render(<VisibilityRulesEditor rules={rules} fieldIds={["x"]} onChange={vi.fn()} />);
    expect(screen.queryByPlaceholderText(/Valor ou valores/)).not.toBeInTheDocument();
  });
});
