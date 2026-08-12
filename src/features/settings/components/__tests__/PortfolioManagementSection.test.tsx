import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { DragEndEvent } from "@dnd-kit/core";
import { PortfolioManagementSection } from "../PortfolioManagementSection";

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: vi.fn(() => true),
}));

vi.mock("../../api/providerProfile.api", () => ({
  getPortfolioImageSignedUrl: vi.fn().mockResolvedValue("https://signed.url/img"),
}));

type PortfolioDndHandlers = {
  onDragStart?: () => void;
  onDragEnd?: (event: DragEndEvent) => void;
};

const portfolioDndHandlers: PortfolioDndHandlers = {};

const { sortableState } = vi.hoisted(() => ({
  sortableState: { isDragging: false },
}));

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: ({
      children,
      onDragStart,
      onDragEnd,
    }: {
      children?: React.ReactNode;
      onDragStart?: () => void;
      onDragEnd?: (event: DragEndEvent) => void;
    }) => {
      portfolioDndHandlers.onDragStart = onDragStart;
      portfolioDndHandlers.onDragEnd = onDragEnd;
      return <div data-testid="portfolio-dnd-context">{children}</div>;
    },
  };
});

vi.mock("@dnd-kit/sortable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/sortable")>();
  return {
    ...actual,
    SortableContext: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: () => {},
      transform: null,
      transition: undefined,
      isDragging: sortableState.isDragging,
    }),
  };
});

describe("PortfolioManagementSection", () => {
  const onCreateItem = vi.fn().mockResolvedValue(undefined);
  const onUpdateItem = vi.fn().mockResolvedValue(undefined);
  const onDeleteItem = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    portfolioDndHandlers.onDragStart = undefined;
    portfolioDndHandlers.onDragEnd = undefined;
    sortableState.isDragging = false;
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

  it("shows overflow count when more than five images are present", async () => {
    const getSigned = vi.mocked(
      await import("../../api/providerProfile.api").then((m) => m.getPortfolioImageSignedUrl)
    );
    getSigned.mockImplementation(async () => "https://signed.example/img.jpg");

    const paths = Array.from({ length: 6 }, (_, i) => `p/img-${i}.jpg`);
    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Many photos",
        description: null,
        sort_order: 0,
        image_paths: paths,
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

    await vi.waitFor(() => {
      expect(screen.getByText("+1")).toBeInTheDocument();
    });
  });

  it("renders static list without reorder handle when onReorderItems is omitted", () => {
    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Sem reorder",
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
        onUpdateItem={onUpdateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );
    expect(screen.queryByRole("button", { name: /Reordenar item/ })).not.toBeInTheDocument();
    expect(screen.getByText("Sem reorder")).toBeInTheDocument();
  });

  it("shows description and formatted execution date on an item", () => {
    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Obra",
        description: "Detalhes do serviço feito",
        sort_order: 0,
        image_paths: [],
        visibility: "public" as const,
        featured: false,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        execution_date: "2024-06-15T00:00:00.000Z",
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
    expect(screen.getByText("Detalhes do serviço feito")).toBeInTheDocument();
    expect(screen.getByText(/\d{2}\/\d{2}\/2024/)).toBeInTheDocument();
  });

  it("calls onUpdateItem when edit form is saved", async () => {
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
    fireEvent.change(screen.getByLabelText(/Título/), {
      target: { value: "Pintura atualizada" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    await vi.waitFor(() => {
      expect(onUpdateItem).toHaveBeenCalledWith(
        "item-1",
        expect.objectContaining({
          title: "Pintura atualizada",
          existingImagePaths: [],
          pathsToRemove: [],
        })
      );
    });
  });

  it("passes imageFiles to onCreateItem when user attaches files", async () => {
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
    fireEvent.change(screen.getByLabelText(/Título/), {
      target: { value: "Com fotos" },
    });
    const file = new File(["x"], "shot.jpg", { type: "image/jpeg" });
    const input = document.querySelector(
      "#portfolio-images"
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: /^Adicionar$/ }));
    await vi.waitFor(() => {
      expect(onCreateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Com fotos",
          imageFiles: [file],
        })
      );
    });
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

  it("does not submit add form when title is empty", () => {
    render(
      <PortfolioManagementSection
        items={[]}
        onCreateItem={onCreateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Adicionar trabalho/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Adicionar$/ }));
    expect(onCreateItem).not.toHaveBeenCalled();
  });

  it("closes add dialog when Cancelar is clicked", () => {
    render(
      <PortfolioManagementSection
        items={[]}
        onCreateItem={onCreateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Adicionar trabalho/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("passes description to onCreateItem when provided", async () => {
    render(
      <PortfolioManagementSection
        items={[]}
        onCreateItem={onCreateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Adicionar trabalho/ }));
    fireEvent.change(screen.getByLabelText(/Título/), {
      target: { value: "Com descrição" },
    });
    fireEvent.change(screen.getByLabelText(/Descrição/), {
      target: { value: "Detalhes do trabalho" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Adicionar$/ }));
    await vi.waitFor(() => {
      expect(onCreateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Com descrição",
          description: "Detalhes do trabalho",
        })
      );
    });
  });

  it("shows reorder handle when onReorderItems is provided", () => {
    const onReorderItems = vi.fn().mockResolvedValue(undefined);
    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Com reorder",
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
        onUpdateItem={onUpdateItem}
        onDeleteItem={onDeleteItem}
        onReorderItems={onReorderItems}
        isCreating={false}
        isDeleting={false}
      />
    );
    expect(screen.getByRole("button", { name: /Reordenar item/ })).toBeInTheDocument();
  });

  it("removes an attached preview image before submit", async () => {
    render(
      <PortfolioManagementSection
        items={[]}
        onCreateItem={onCreateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Adicionar trabalho/ }));
    fireEvent.change(screen.getByLabelText(/Título/), {
      target: { value: "Sem foto" },
    });
    const file = new File(["x"], "shot.jpg", { type: "image/jpeg" });
    const input = document.querySelector("#portfolio-images") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByAltText("shot.jpg")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Remover imagem shot.jpg/ }));
    expect(screen.queryByAltText("shot.jpg")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Adicionar$/ }));
    await vi.waitFor(() => {
      expect(onCreateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Sem foto",
          imageFiles: undefined,
        })
      );
    });
  });

  it("removes an existing image path when editing and saving", async () => {
    const getSigned = vi.mocked(
      await import("../../api/providerProfile.api").then((m) => m.getPortfolioImageSignedUrl)
    );
    getSigned.mockResolvedValue("https://signed.example/existing.jpg");

    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Com imagem",
        description: null,
        sort_order: 0,
        image_paths: ["p/existing.jpg"],
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

    fireEvent.click(screen.getByRole("button", { name: /Editar Com imagem/ }));
    await vi.waitFor(() => {
      expect(screen.getByRole("button", { name: /Remover imagem/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Remover imagem/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));

    await vi.waitFor(() => {
      expect(onUpdateItem).toHaveBeenCalledWith(
        "item-1",
        expect.objectContaining({
          title: "Com imagem",
          existingImagePaths: ["p/existing.jpg"],
          pathsToRemove: ["p/existing.jpg"],
        })
      );
    });
  });

  it("hides edit button when onUpdateItem is omitted", () => {
    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Só exclusão",
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
    expect(screen.queryByRole("button", { name: /Editar Só exclusão/ })).not.toBeInTheDocument();
  });

  it("attaches additional images while editing an existing item", async () => {
    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Obra",
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
    fireEvent.click(screen.getByRole("button", { name: /Editar Obra/ }));
    expect(screen.getByText(/Anexar mais imagens/)).toBeInTheDocument();
    const file = new File(["y"], "extra.jpg", { type: "image/jpeg" });
    fireEvent.change(document.querySelector("#portfolio-images") as HTMLInputElement, {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    await vi.waitFor(() => {
      expect(onUpdateItem).toHaveBeenCalledWith(
        "item-1",
        expect.objectContaining({
          title: "Obra",
          imageFiles: [file],
        })
      );
    });
  });

  it("shows sortable items with description and date when reorder is enabled", () => {
    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Com extras",
        description: "Detalhe sortable",
        sort_order: 0,
        image_paths: [],
        visibility: "public" as const,
        featured: false,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        execution_date: "2024-03-10T00:00:00.000Z",
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
        onReorderItems={vi.fn()}
        isCreating={false}
        isDeleting={false}
      />
    );
    expect(screen.getByText("Detalhe sortable")).toBeInTheDocument();
    expect(screen.getByText(/\d{2}\/\d{2}\/2024/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reordenar item/ })).toBeInTheDocument();
  });

  it("reorders items on drag end and notifies parent", async () => {
    const onReorderItems = vi.fn().mockResolvedValue(undefined);
    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Primeiro",
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
      {
        id: "item-2",
        provider_id: "p1",
        title: "Segundo",
        description: null,
        sort_order: 1,
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
        onReorderItems={onReorderItems}
        isCreating={false}
        isDeleting={false}
      />
    );

    expect(portfolioDndHandlers.onDragEnd).toBeTypeOf("function");
    portfolioDndHandlers.onDragStart?.();
    portfolioDndHandlers.onDragEnd?.({
      active: { id: "item-1" },
      over: { id: "item-2" },
    } as DragEndEvent);

    await vi.waitFor(() => {
      expect(onReorderItems).toHaveBeenCalledWith(["item-2", "item-1"]);
    });
  });

  it("ignores drag end when drop target is unchanged", () => {
    const onReorderItems = vi.fn().mockResolvedValue(undefined);
    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Único",
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
        onUpdateItem={onUpdateItem}
        onDeleteItem={onDeleteItem}
        onReorderItems={onReorderItems}
        isCreating={false}
        isDeleting={false}
      />
    );

    portfolioDndHandlers.onDragEnd?.({
      active: { id: "item-1" },
      over: { id: "item-1" },
    } as DragEndEvent);
    portfolioDndHandlers.onDragEnd?.({
      active: { id: "item-1" },
      over: null,
    } as DragEndEvent);

    expect(onReorderItems).not.toHaveBeenCalled();
  });

  it("applies dragging styles on sortable items", () => {
    sortableState.isDragging = true;
    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Arrastando",
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
    const { container } = render(
      <PortfolioManagementSection
        items={items}
        onCreateItem={onCreateItem}
        onUpdateItem={onUpdateItem}
        onDeleteItem={onDeleteItem}
        onReorderItems={vi.fn()}
        isCreating={false}
        isDeleting={false}
      />
    );
    expect(container.querySelector("li.opacity-50")).toBeInTheDocument();
  });

  it("shows delete spinner on sortable item while deleting", () => {
    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Apagando",
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
    let resolveDelete: (() => void) | undefined;
    const slowDelete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );
    render(
      <PortfolioManagementSection
        items={items}
        onCreateItem={onCreateItem}
        onUpdateItem={onUpdateItem}
        onDeleteItem={slowDelete}
        onReorderItems={vi.fn()}
        isCreating={false}
        isDeleting={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Excluir Apagando/ }));
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    resolveDelete?.();
  });

  it("does not sync ordered items from props while a drag is in progress", async () => {
    const onReorderItems = vi.fn().mockResolvedValue(undefined);
    const initial = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Primeiro",
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
      {
        id: "item-2",
        provider_id: "p1",
        title: "Segundo",
        description: null,
        sort_order: 1,
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
    const { rerender } = render(
      <PortfolioManagementSection
        items={initial}
        onCreateItem={onCreateItem}
        onUpdateItem={onUpdateItem}
        onDeleteItem={onDeleteItem}
        onReorderItems={onReorderItems}
        isCreating={false}
        isDeleting={false}
      />
    );

    portfolioDndHandlers.onDragStart?.();
    rerender(
      <PortfolioManagementSection
        items={[initial[1], initial[0]]}
        onCreateItem={onCreateItem}
        onUpdateItem={onUpdateItem}
        onDeleteItem={onDeleteItem}
        onReorderItems={onReorderItems}
        isCreating={false}
        isDeleting={false}
      />
    );
    // Still shows original order while dragging (props sync skipped)
    const titles = screen.getAllByText(/Primeiro|Segundo/).map((el) => el.textContent);
    expect(titles[0]).toBe("Primeiro");

    portfolioDndHandlers.onDragEnd?.({
      active: { id: "item-1" },
      over: { id: "item-2" },
    } as DragEndEvent);
    await vi.waitFor(() => {
      expect(onReorderItems).toHaveBeenCalled();
    });
  });

  it("renders editable existing images with signed urls in edit dialog", async () => {
    const getSigned = vi.mocked(
      await import("../../api/providerProfile.api").then((m) => m.getPortfolioImageSignedUrl),
    );
    getSigned.mockResolvedValue("https://signed.example/edit.jpg");

    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Com foto",
        description: null,
        sort_order: 0,
        image_paths: ["path/a.jpg"],
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
    fireEvent.click(screen.getByRole("button", { name: /Editar Com foto/ }));
    await vi.waitFor(() => {
      expect(screen.getByRole("dialog").querySelector("img")).toHaveAttribute(
        "src",
        "https://signed.example/edit.jpg",
      );
    });
  });

  it("opens edit dialog from sortable item edit button", () => {
    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Sortable edit",
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
        onUpdateItem={onUpdateItem}
        onDeleteItem={onDeleteItem}
        onReorderItems={vi.fn()}
        isCreating={false}
        isDeleting={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Editar Sortable edit/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sortable edit")).toBeInTheDocument();
  });

  it("clears existing image previews when all images are removed in edit mode", async () => {
    const getSigned = vi.mocked(
      await import("../../api/providerProfile.api").then((m) => m.getPortfolioImageSignedUrl),
    );
    getSigned.mockResolvedValue("https://signed.example/one.jpg");

    const items = [
      {
        id: "item-1",
        provider_id: "p1",
        title: "Uma foto",
        description: null,
        sort_order: 0,
        image_paths: ["path/only.jpg"],
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
    fireEvent.click(screen.getByRole("button", { name: /Editar Uma foto/ }));
    await vi.waitFor(() => {
      expect(screen.getByRole("dialog").querySelector("img")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Remover imagem/i }));
    await vi.waitFor(() => {
      expect(screen.getByRole("dialog").querySelector("img")).not.toBeInTheDocument();
    });
  });

  it("opens the hidden file input when attach button is clicked", () => {
    render(
      <PortfolioManagementSection
        items={[]}
        onCreateItem={onCreateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Adicionar trabalho/ }));
    const input = document.querySelector("#portfolio-images") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: /Anexar imagens/ }));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("shows the empty state and does not request thumbnails for empty paths", async () => {
    const getSigned = vi.mocked(
      await import("../../api/providerProfile.api").then(
        (m) => m.getPortfolioImageSignedUrl
      )
    );
    render(
      <PortfolioManagementSection
        items={[]}
        onCreateItem={onCreateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );

    expect(screen.getByText(/Nenhum item no portfólio/)).toBeInTheDocument();
    expect(getSigned).not.toHaveBeenCalled();
  });

  it("uses the compact centered layout for a title-only static item", () => {
    const item = {
      id: "compact",
      provider_id: "p1",
      title: "Somente título",
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
    };
    const { container } = render(
      <PortfolioManagementSection
        items={[item]}
        onCreateItem={onCreateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );

    expect(container.querySelector("li.items-center")).toBeInTheDocument();
    expect(container.querySelector("li.items-start")).not.toBeInTheDocument();
  });

  it("ignores an empty file selection and disables dialog actions while creating", () => {
    render(
      <PortfolioManagementSection
        items={[]}
        onCreateItem={onCreateItem}
        onDeleteItem={onDeleteItem}
        isCreating
        isDeleting={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Adicionar trabalho/ }));
    fireEvent.change(screen.getByLabelText(/Título/), {
      target: { value: "Em andamento" },
    });
    fireEvent.change(
      document.querySelector("#portfolio-images") as HTMLInputElement,
      { target: { files: [] } }
    );

    expect(screen.getByRole("button", { name: /Anexar imagens/ })).toBeDisabled();
    expect(screen.getByRole("dialog").querySelector(".animate-spin")).toBeInTheDocument();
    expect(onCreateItem).not.toHaveBeenCalled();
  });

  it("trims an empty edit description to null", async () => {
    const item = {
      id: "edit-empty-description",
      provider_id: "p1",
      title: "Trabalho",
      description: "Descrição antiga",
      sort_order: 0,
      image_paths: [],
      visibility: "public" as const,
      featured: false,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      execution_date: null,
      city_region: null,
      service_id: null,
    };
    render(
      <PortfolioManagementSection
        items={[item]}
        onCreateItem={onCreateItem}
        onUpdateItem={onUpdateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Editar Trabalho/ }));
    fireEvent.change(screen.getByLabelText(/Descrição/), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));

    await vi.waitFor(() => {
      expect(onUpdateItem).toHaveBeenCalledWith(
        "edit-empty-description",
        expect.objectContaining({ description: null })
      );
    });
  });

  it("shows the delete spinner in the static list", () => {
    const item = {
      id: "static-delete",
      provider_id: "p1",
      title: "Exclusão estática",
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
    };
    const slowDelete = vi.fn(() => new Promise<void>(() => {}));
    render(
      <PortfolioManagementSection
        items={[item]}
        onCreateItem={onCreateItem}
        onDeleteItem={slowDelete}
        isCreating={false}
        isDeleting={false}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Excluir Exclusão estática/ })
    );

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("disables delete buttons when isDeleting is true", () => {
    const item = {
      id: "del-disabled",
      provider_id: "p1",
      title: "Item",
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
    };
    render(
      <PortfolioManagementSection
        items={[item]}
        onCreateItem={onCreateItem}
        onDeleteItem={vi.fn()}
        isCreating={false}
        isDeleting
      />,
    );

    expect(screen.getByRole("button", { name: /Excluir Item/ })).toBeDisabled();
  });

  it("disables dialog submit while isUpdating", async () => {
    const item = {
      id: "edit-updating",
      provider_id: "p1",
      title: "Editável",
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
    };
    render(
      <PortfolioManagementSection
        items={[item]}
        onCreateItem={onCreateItem}
        onUpdateItem={vi.fn()}
        onDeleteItem={vi.fn()}
        isCreating={false}
        isUpdating
        isDeleting={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Editar Editável/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelar/ })).toBeEnabled();
  });

  it("keeps thumbnail placeholders when signed URLs are unavailable", async () => {
    const getSigned = vi.mocked(
      await import("../../api/providerProfile.api").then(
        (module) => module.getPortfolioImageSignedUrl
      )
    );
    getSigned.mockResolvedValue(null);
    const item = {
      id: "unsigned",
      provider_id: "p1",
      title: "Imagem indisponível",
      description: null,
      sort_order: 0,
      image_paths: ["path/missing.jpg"],
      visibility: "public" as const,
      featured: false,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      execution_date: null,
      city_region: null,
      service_id: null,
    };
    render(
      <PortfolioManagementSection
        items={[item]}
        onCreateItem={onCreateItem}
        onUpdateItem={onUpdateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Editar Imagem indisponível/ })
    );

    await vi.waitFor(() => {
      expect(getSigned).toHaveBeenCalledWith("path/missing.jpg");
    });
    expect(screen.getByRole("dialog").querySelector("img")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Remover imagem$/ })
    ).toBeInTheDocument();
  });

  it("uses empty image paths when an editable item omits them", async () => {
    const item = {
      id: "missing-paths",
      provider_id: "p1",
      title: "Sem propriedade de imagens",
      description: null,
      sort_order: 0,
      image_paths: undefined as unknown as string[],
      visibility: "public" as const,
      featured: false,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      execution_date: null,
      city_region: null,
      service_id: null,
    };
    render(
      <PortfolioManagementSection
        items={[item]}
        onCreateItem={onCreateItem}
        onUpdateItem={onUpdateItem}
        onDeleteItem={onDeleteItem}
        onReorderItems={vi.fn()}
        isCreating={false}
        isDeleting={false}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Editar Sem propriedade de imagens/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));

    await vi.waitFor(() => {
      expect(onUpdateItem).toHaveBeenCalledWith(
        "missing-paths",
        expect.objectContaining({
          existingImagePaths: [],
          pathsToRemove: [],
        })
      );
    });
  });

  it("ignores late thumbnail resolution after unmount", async () => {
    const getSigned = vi.mocked(
      await import("../../api/providerProfile.api").then(
        (module) => module.getPortfolioImageSignedUrl
      )
    );
    let resolveSignedUrl!: (url: string) => void;
    getSigned.mockReturnValue(
      new Promise((resolve) => {
        resolveSignedUrl = resolve;
      })
    );
    const item = {
      id: "late-image",
      provider_id: "p1",
      title: "Imagem tardia",
      description: null,
      sort_order: 0,
      image_paths: ["path/late.jpg"],
      visibility: "public" as const,
      featured: false,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      execution_date: null,
      city_region: null,
      service_id: null,
    };
    const { unmount } = render(
      <PortfolioManagementSection
        items={[item]}
        onCreateItem={onCreateItem}
        onDeleteItem={onDeleteItem}
        isCreating={false}
        isDeleting={false}
      />
    );

    unmount();
    resolveSignedUrl("https://signed.example/late.jpg");
    await Promise.resolve();

    expect(screen.queryByAltText("Imagem tardia")).not.toBeInTheDocument();
  });
});
