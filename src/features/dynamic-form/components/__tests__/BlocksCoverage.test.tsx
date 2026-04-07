import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { FormSchema } from "../../types";
import { FormProvider } from "../FormContext";
import { StepRenderer } from "../StepRenderer";

const coverageSchema: FormSchema = {
  version: "2.0",
  id: "cov",
  title: "Cov",
  metadata: { categorySlug: "c", categoryId: null, status: "draft" },
  config: {},
  steps: [
    {
      id: "s1",
      order: 0,
      title: "Gallery and summary",
      blocks: [
        {
          id: "gallery",
          type: "image_gallery",
          label: "Estilo",
          required: false,
          description_ai: "Pick a style",
          helpText: "Escolha uma imagem",
          options: [
            {
              value: "a",
              label: "Local",
              image: "/favicon.ico",
              tags: ["t1", "t2", "t3", "t4"],
              description: "Desc",
            },
            { value: "b", label: "Invalid src", image: ":::" },
            { value: "c", label: "Remote", image: "https://example.com/fake.png" },
          ],
          config: { multiSelect: true, columns: 3 },
        },
        {
          id: "prev_default",
          type: "preview_summary",
          label: "Resumo",
          description_ai: "Summary default sections",
        },
        {
          id: "prev_cfg",
          type: "preview_summary",
          label: "Resumo 2",
          description_ai: "Summary with config",
          config: {
            sections: [
              { title: "Custom", icon: "📌", fieldIds: ["gallery"] },
            ],
          },
        },
      ],
    },
  ],
};

describe("BlocksCoverage (StepRenderer)", () => {
  it("renders image gallery (error fallback, multi-select) and preview summary blocks", () => {
    render(
      <FormProvider schema={coverageSchema} initialData={{}}>
        <StepRenderer />
      </FormProvider>
    );
    expect(screen.getByText("Escolha uma imagem")).toBeInTheDocument();
    const imgs = screen.getAllByRole("img");
    const remote = imgs.find((el) => el.getAttribute("src")?.includes("example.com"));
    expect(remote).toBeTruthy();
    if (remote) fireEvent.error(remote);
    fireEvent.click(screen.getByText("Local"));
    fireEvent.click(screen.getByText("Remote"));
    expect(screen.getByText(/estilos selecionados/)).toBeInTheDocument();
    expect(screen.getAllByText("Revise as informações antes de enviar").length).toBeGreaterThan(0);
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });
});
