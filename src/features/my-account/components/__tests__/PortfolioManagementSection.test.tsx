import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PortfolioManagementSection } from "../PortfolioManagementSection";

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: vi.fn(() => true),
}));

vi.mock("../../api/providerProfile.api", () => ({
  getPortfolioImageSignedUrl: vi.fn().mockResolvedValue("https://signed.url/img"),
}));

describe("PortfolioManagementSection", () => {
  const onCreateItem = vi.fn().mockResolvedValue(undefined);
  const onUpdateItem = vi.fn().mockResolvedValue(undefined);
  const onDeleteItem = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders section title and add button", () => {
    render(
      <PortfolioManagementSection
        items={[]}
        onCreateItem={onCreateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );
    expect(screen.getByText("Portfólio")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Adicionar trabalho/ })
    ).toBeInTheDocument();
  });

  it("opens add dialog when Adicionar trabalho is clicked", () => {
    render(
      <PortfolioManagementSection
        items={[]}
        onCreateItem={onCreateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Adicionar trabalho/ })
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/Título/)).toBeInTheDocument();
  });

  it("renders existing items", () => {
    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Pintura residencial",
        description: "Desc",
        sort_order: 0,
        image_paths: [],
        visibility: "public" as const,
        featured: false,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        execution_date: null,
        city_region: null,
        service_id: null,
      },
    ];
    render(
      <PortfolioManagementSection
        items={items}
        onCreateItem={onCreateItem}
        onUpdateItem={onUpdateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );
    expect(screen.getByText("Pintura residencial")).toBeInTheDocument();
  });

  it("disables add button when disabled", () => {
    render(
      <PortfolioManagementSection
        items={[]}
        onCreateItem={onCreateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
        disabled
      />
    );
    expect(
      screen.getByRole("button", { name: /Adicionar trabalho/ })
    ).toBeDisabled();
  });

  it("calls onCreateItem when submitting add form with title", async () => {
    render(
      <PortfolioManagementSection
        items={[]}
        onCreateItem={onCreateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Adicionar trabalho/ })
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Título/), {
      target: { value: "Novo trabalho" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    await vi.waitFor(() => {
      expect(onCreateItem).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Novo trabalho" })
      );
    });
  });

  it("opens edit dialog when Editar is clicked on an item", () => {
    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Pintura residencial",
        description: "Desc",
        sort_order: 0,
        image_paths: [],
        visibility: "public" as const,
        featured: false,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        execution_date: null,
        city_region: null,
        service_id: null,
      },
    ];
    render(
      <PortfolioManagementSection
        items={items}
        onCreateItem={onCreateItem}
        onUpdateItem={onUpdateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Editar Pintura residencial/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Pintura residencial")).toBeInTheDocument();
  });

  it("calls onDeleteItem when Excluir is clicked", async () => {
    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Pintura",
        description: null,
        sort_order: 0,
        image_paths: [],
        visibility: "public" as const,
        featured: false,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        execution_date: null,
        city_region: null,
        service_id: null,
      },
    ];
    render(
      <PortfolioManagementSection
        items={items}
        onCreateItem={onCreateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Excluir Pintura/ }));
    await vi.waitFor(() => {
      expect(onDeleteItem).toHaveBeenCalledWith("item-1");
    });
  });
});
