import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProviderProfilePortfolio } from "../ProviderProfilePortfolio";
import { usePortfolioImages } from "../../hooks/usePortfolioImages";
import type { ProviderPublicProfile } from "../../types/providerProfilePublic.types";

vi.mock("../../hooks/usePortfolioImages", () => ({
  usePortfolioImages: vi.fn(
    (items: { id: string; image_paths: string[] }[]) => {
      const imageMap: Record<string, string[]> = {};
      for (const item of items) {
        imageMap[item.id] = item.image_paths.map(
          (p: string) => `https://cdn.com/${p}`,
        );
      }
      return { imageMap, isLoading: false };
    },
  ),
}));

const usePortfolioImagesMock = vi.mocked(usePortfolioImages);

function makeProfile(
  overrides: Partial<ProviderPublicProfile> = {},
): ProviderPublicProfile {
  return {
    provider_id: "p1",
    slug: "joao-silva",
    display_name: "João Silva",
    bio: null,
    profile_visibility: "public",
    service_area_cities: null,
    service_area_regions: null,
    service_area_neighborhoods: null,
    full_name: "João Silva",
    profile_image_path: null,
    created_at: "2024-01-01T00:00:00Z",
    offered_services: [],
    portfolio_items: [],
    ...overrides,
  };
}

describe("ProviderProfilePortfolio", () => {
  it("renders nothing when no portfolio items", () => {
    const { container } = render(
      <ProviderProfilePortfolio
        profile={makeProfile({ portfolio_items: [] })}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders heading and portfolio item with single image", () => {
    const items = [
      {
        id: "item-1",
        title: "Instalação elétrica",
        description: null,
        service_id: null,
        execution_date: null,
        image_paths: ["img1.jpg"],
        city_region: null,
        sort_order: 0,
      },
    ];
    const { container } = render(
      <ProviderProfilePortfolio
        profile={makeProfile({ portfolio_items: items })}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /portfólio/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Instalação elétrica")).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("renders multiple images for a portfolio item", () => {
    const items = [
      {
        id: "item-1",
        title: "Reforma completa",
        description: "Reforma de banheiro",
        service_id: null,
        execution_date: "2024-06-15",
        image_paths: ["img1.jpg", "img2.jpg", "img3.jpg"],
        city_region: null,
        sort_order: 0,
      },
    ];
    const { container } = render(
      <ProviderProfilePortfolio
        profile={makeProfile({ portfolio_items: items })}
      />,
    );
    expect(screen.getByText("Reforma completa")).toBeInTheDocument();
    expect(screen.getByText("Reforma de banheiro")).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(3);
  });

  it("renders execution date when provided", () => {
    const items = [
      {
        id: "item-1",
        title: "Trabalho",
        description: null,
        service_id: null,
        execution_date: "2024-06-15",
        image_paths: ["img.jpg"],
        city_region: null,
        sort_order: 0,
      },
    ];
    render(
      <ProviderProfilePortfolio
        profile={makeProfile({ portfolio_items: items })}
      />,
    );
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });

  it("renders multiple portfolio items", () => {
    const items = [
      {
        id: "item-1",
        title: "Trabalho A",
        description: null,
        service_id: null,
        execution_date: null,
        image_paths: ["a.jpg"],
        city_region: null,
        sort_order: 0,
      },
      {
        id: "item-2",
        title: "Trabalho B",
        description: null,
        service_id: null,
        execution_date: null,
        image_paths: ["b.jpg"],
        city_region: null,
        sort_order: 1,
      },
    ];
    render(
      <ProviderProfilePortfolio
        profile={makeProfile({ portfolio_items: items })}
      />,
    );
    expect(screen.getByText("Trabalho A")).toBeInTheDocument();
    expect(screen.getByText("Trabalho B")).toBeInTheDocument();
  });

  it("shows skeleton when images are loading", () => {
    usePortfolioImagesMock.mockReturnValueOnce({
      imageMap: {},
      isLoading: true,
    });
    const items = [
      {
        id: "item-1",
        title: "Trabalho",
        description: null,
        service_id: null,
        execution_date: null,
        image_paths: ["img.jpg"],
        city_region: null,
        sort_order: 0,
      },
    ];
    const { container } = render(
      <ProviderProfilePortfolio
        profile={makeProfile({ portfolio_items: items })}
      />,
    );
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders item with exactly 2 images using 2-column grid", () => {
    const items = [
      {
        id: "item-1",
        title: "Dois fotos",
        description: null,
        service_id: null,
        execution_date: null,
        image_paths: ["img1.jpg", "img2.jpg"],
        city_region: null,
        sort_order: 0,
      },
    ];
    const { container } = render(
      <ProviderProfilePortfolio
        profile={makeProfile({ portfolio_items: items })}
      />,
    );
    expect(container.querySelectorAll("img")).toHaveLength(2);
  });

  it("shows placeholder and title when images fail to load", () => {
    usePortfolioImagesMock.mockReturnValueOnce({
      imageMap: { "item-1": [] },
      isLoading: false,
    });
    const items = [
      {
        id: "item-1",
        title: "Trabalho sem imagem",
        description: "Descrição do trabalho",
        service_id: null,
        execution_date: null,
        image_paths: ["fail.jpg"],
        city_region: null,
        sort_order: 0,
      },
    ];
    render(
      <ProviderProfilePortfolio
        profile={makeProfile({ portfolio_items: items })}
      />,
    );
    expect(screen.getByText("Trabalho sem imagem")).toBeInTheDocument();
    expect(screen.getByText("Descrição do trabalho")).toBeInTheDocument();
  });
});
