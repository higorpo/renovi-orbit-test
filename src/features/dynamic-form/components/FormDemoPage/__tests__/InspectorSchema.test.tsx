import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { FormSchema } from "../../../types";
import { InspectorSchema } from "../InspectorSchema";

const baseSchema: FormSchema = {
  version: "2.0",
  id: "schema-1",
  title: "My form",
  description: "Desc",
  metadata: {
    categorySlug: "cat",
    categoryId: "cid-1",
    status: "draft",
  },
  config: { showProgressBar: true },
  steps: [],
};

describe("InspectorSchema", () => {
  it("calls onUpdate when id, title, description and metadata inputs change", () => {
    const onUpdate = vi.fn();
    render(<InspectorSchema schema={baseSchema} onUpdate={onUpdate} />);

    fireEvent.change(screen.getByPlaceholderText("ex: demo-all-blocks"), {
      target: { value: "new-id" },
    });
    expect(onUpdate).toHaveBeenCalledWith({ id: "new-id" });

    fireEvent.change(screen.getByPlaceholderText("Título do formulário"), {
      target: { value: "New title" },
    });
    expect(onUpdate).toHaveBeenCalledWith({ title: "New title" });

    fireEvent.change(screen.getByPlaceholderText("Descrição opcional"), {
      target: { value: "New desc" },
    });
    expect(onUpdate).toHaveBeenCalledWith({ description: "New desc" });

    fireEvent.change(screen.getByPlaceholderText("ex: demo-form"), {
      target: { value: "slug-x" },
    });
    expect(onUpdate).toHaveBeenCalledWith({
      metadata: { ...baseSchema.metadata, categorySlug: "slug-x" },
    });

    fireEvent.change(screen.getByPlaceholderText("null ou ID"), {
      target: { value: "" },
    });
    expect(onUpdate).toHaveBeenCalledWith({
      metadata: { ...baseSchema.metadata, categoryId: null },
    });
  });

  it("updates metadata status via select and toggles showProgressBar", async () => {
    const onUpdate = vi.fn();
    render(<InspectorSchema schema={baseSchema} onUpdate={onUpdate} />);

    const triggers = screen.getAllByRole("combobox");
    const statusTrigger = triggers.find((el) => el.textContent?.includes("draft"));
    expect(statusTrigger).toBeTruthy();
    fireEvent.click(statusTrigger!);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "active" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("option", { name: "active" }));
    expect(onUpdate).toHaveBeenCalledWith({
      metadata: { ...baseSchema.metadata, status: "active" },
    });

    const progressSwitch = screen.getByRole("switch");
    fireEvent.click(progressSwitch);
    expect(onUpdate).toHaveBeenCalledWith({
      config: { ...baseSchema.config, showProgressBar: false },
    });
  });
});
