import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { FormBlock } from "../../../types";
import { InspectorBlock } from "../InspectorBlock";

const base = {
  stepId: "st1",
  blockId: "blk1",
  fieldIds: ["other_field"],
  onUpdate: vi.fn(),
};

describe("InspectorBlock", () => {
  beforeEach(() => {
    base.onUpdate.mockClear();
  });

  it("updates common fields for a text block", () => {
    const block: FormBlock = {
      id: "blk1",
      type: "text",
      label: "Name",
      description_ai: "desc",
      required: true,
      placeholder: "ph",
      helpText: "help",
    };
    render(<InspectorBlock {...base} block={block} />);

    fireEvent.change(screen.getByPlaceholderText("block_id"), { target: { value: "new_id" } });
    expect(base.onUpdate).toHaveBeenCalledWith({ id: "new_id" });

    fireEvent.change(screen.getByPlaceholderText("Rótulo do campo"), {
      target: { value: "New label" },
    });
    expect(base.onUpdate).toHaveBeenCalledWith({ label: "New label" });

    const reqSwitch = screen.getAllByRole("switch")[0];
    fireEvent.click(reqSwitch);
    expect(base.onUpdate).toHaveBeenCalledWith({ required: false });
  });

  it("renders number/slider min max step unit fields", () => {
    const block: FormBlock = {
      id: "n1",
      type: "number",
      label: "N",
      description_ai: "d",
      min: 1,
      max: 10,
      step: 2,
      unit: "m",
    };
    render(<InspectorBlock {...base} block={block} />);

    const numberInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(numberInputs[0], { target: { value: "" } });
    expect(base.onUpdate).toHaveBeenCalledWith({ min: undefined });
    base.onUpdate.mockClear();
    fireEvent.change(numberInputs[1], { target: { value: "99" } });
    expect(base.onUpdate).toHaveBeenCalledWith({ max: 99 });
  });

  it("parses options JSON for single_select and toggles allowOther", () => {
    const block: FormBlock = {
      id: "s1",
      type: "single_select",
      label: "Pick",
      description_ai: "d",
      options: [{ value: "a", label: "A" }],
    };
    render(<InspectorBlock {...base} block={block} />);

    const jsonArea = screen.getByPlaceholderText(/Opção A/);
    fireEvent.change(jsonArea, {
      target: { value: '[{"value":"x","label":"X"}]' },
    });
    expect(base.onUpdate).toHaveBeenCalledWith({
      options: [{ value: "x", label: "X" }],
    });

    base.onUpdate.mockClear();
    fireEvent.change(jsonArea, { target: { value: "not json" } });
    expect(base.onUpdate).not.toHaveBeenCalled();

    const allowOther = screen.getAllByRole("switch").at(-1);
    expect(allowOther).toBeTruthy();
    fireEvent.click(allowOther!);
    expect(base.onUpdate).toHaveBeenCalledWith({
      config: { allowOther: true },
    });
  });

  it("updates static_text variant and color via select", async () => {
    const block: FormBlock = {
      id: "st",
      type: "static_text",
      label: "T",
      description_ai: "d",
      config: { variant: "p", color: "default" },
    };
    render(<InspectorBlock {...base} block={block} />);

    const combos = screen.getAllByRole("combobox");
    fireEvent.click(combos[0]);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "h2" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("option", { name: "h2" }));
    expect(base.onUpdate).toHaveBeenCalledWith({
      config: { variant: "h2", color: "default" },
    });

    base.onUpdate.mockClear();
    fireEvent.click(combos[1]);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "primary" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("option", { name: "primary" }));
    // Block prop is still controlled with variant "p" until parent re-renders
    expect(base.onUpdate).toHaveBeenCalledWith({
      config: { variant: "p", color: "primary" },
    });
  });

  it("updates conditional_alert config", async () => {
    const block: FormBlock = {
      id: "ca",
      type: "conditional_alert",
      label: "",
      description_ai: "d",
      config: { alertType: "info", alertTitle: "T" },
    };
    render(<InspectorBlock {...base} block={block} />);

    const combos = screen.getAllByRole("combobox");
    fireEvent.click(combos[0]);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "warning" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("option", { name: "warning" }));
    expect(base.onUpdate).toHaveBeenCalledWith({
      config: { alertType: "warning", alertTitle: "T" },
    });

    base.onUpdate.mockClear();
    fireEvent.change(screen.getByPlaceholderText("Título"), {
      target: { value: "New title" },
    });
    expect(base.onUpdate).toHaveBeenCalledWith({
      config: { alertType: "info", alertTitle: "New title" },
    });
  });

  it("renders checkbox type options editor", () => {
    const block: FormBlock = {
      id: "cb",
      type: "checkbox",
      label: "C",
      description_ai: "d",
      options: [{ value: "1", label: "One" }],
    };
    render(<InspectorBlock {...base} block={block} />);
    expect(screen.getByText(/Opções \(JSON array\)/)).toBeInTheDocument();
  });

  it("updates slider step/unit and multi_select options", () => {
    const slider: FormBlock = {
      id: "sl",
      type: "slider",
      label: "S",
      description_ai: "d",
      min: 0,
      max: 10,
      step: 1,
      unit: "%",
    };
    const { rerender } = render(<InspectorBlock {...base} block={slider} />);
    const numberInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(numberInputs[2]!, { target: { value: "2" } });
    expect(base.onUpdate).toHaveBeenCalledWith({ step: 2 });
    fireEvent.change(screen.getByPlaceholderText(/ex: m/), {
      target: { value: "un" },
    });
    expect(base.onUpdate).toHaveBeenCalledWith({ unit: "un" });

    base.onUpdate.mockClear();
    const multi: FormBlock = {
      id: "m1",
      type: "multi_select",
      label: "M",
      description_ai: "d",
      options: [{ value: "a", label: "A" }],
    };
    rerender(<InspectorBlock {...base} block={multi} />);
    const jsonArea = screen.getByPlaceholderText(/Opção A/);
    fireEvent.change(jsonArea, {
      target: { value: '[{"value":"z","label":"Z"}]' },
    });
    expect(base.onUpdate).toHaveBeenCalledWith({
      options: [{ value: "z", label: "Z" }],
    });
    base.onUpdate.mockClear();
    fireEvent.change(jsonArea, { target: { value: '{"a":1}' } });
    expect(base.onUpdate).not.toHaveBeenCalled();
  });

  it("updates placeholder, helpText and description_ai", () => {
    const block: FormBlock = {
      id: "t1",
      type: "text",
      label: "T",
      description_ai: "old",
      placeholder: "ph",
      helpText: "help",
    };
    render(<InspectorBlock {...base} block={block} />);
    fireEvent.change(screen.getByPlaceholderText("Placeholder"), {
      target: { value: "new-ph" },
    });
    expect(base.onUpdate).toHaveBeenCalledWith({ placeholder: "new-ph" });
    fireEvent.change(screen.getByPlaceholderText("Help text"), {
      target: { value: "new-help" },
    });
    expect(base.onUpdate).toHaveBeenCalledWith({ helpText: "new-help" });
    fireEvent.change(
      screen.getByPlaceholderText(/O que é este dado/),
      { target: { value: "ai" } },
    );
    expect(base.onUpdate).toHaveBeenCalledWith({ description_ai: "ai" });
  });

  it("renders radio options editor", () => {
    render(
      <InspectorBlock
        {...base}
        block={{
          id: "r1",
          type: "radio",
          label: "R",
          description_ai: "d",
          options: [{ value: "a", label: "A" }],
        }}
      />,
    );
    expect(screen.getByText(/Opções \(JSON array\)/)).toBeInTheDocument();
  });

  it("clears options when JSON textarea is emptied to an empty array", () => {
    const block: FormBlock = {
      id: "s1",
      type: "radio",
      label: "Pick",
      description_ai: "d",
      options: [{ value: "a", label: "A" }],
    };
    render(<InspectorBlock {...base} block={block} />);
    const jsonArea = screen.getByPlaceholderText(/Opção A/);
    fireEvent.change(jsonArea, { target: { value: "" } });
    expect(base.onUpdate).toHaveBeenCalledWith({ options: [] });
  });

  it("uses default static_text and conditional_alert config when missing", () => {
    const { rerender } = render(
      <InspectorBlock
        {...base}
        block={{
          id: "st",
          type: "static_text",
          label: "T",
          description_ai: "d",
        }}
      />,
    );
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);

    rerender(
      <InspectorBlock
        {...base}
        block={{
          id: "ca",
          type: "conditional_alert",
          label: "",
          description_ai: "d",
        }}
      />,
    );
    expect(screen.getByPlaceholderText("Título")).toHaveValue("");
  });
});
