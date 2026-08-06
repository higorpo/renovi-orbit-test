import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProviderProfileServiceArea } from "../ProviderProfileServiceArea";
import type { ProviderPublicProfile } from "../../types/providerProfilePublic.types";

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
    rating_avg: null,
    rating_count: 0,
    completed_services_count: 0,
    ...overrides,
  };
}

describe("ProviderProfileServiceArea", () => {
  it("renders nothing when no cities and no neighborhoods", () => {
    const { container } = render(
      <ProviderProfileServiceArea profile={makeProfile()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders single city when provided", () => {
    render(
      <ProviderProfileServiceArea
        profile={makeProfile({
          service_area_cities: ["Florianópolis"],
        })}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /área de atuação/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Florianópolis")).toBeInTheDocument();
  });

  it("renders multiple cities joined by comma", () => {
    render(
      <ProviderProfileServiceArea
        profile={makeProfile({
          service_area_cities: ["Florianópolis", "São José"],
        })}
      />,
    );
    expect(
      screen.getByText("Florianópolis, São José"),
    ).toBeInTheDocument();
  });

  it("renders neighborhoods as badges", () => {
    render(
      <ProviderProfileServiceArea
        profile={makeProfile({
          service_area_neighborhoods: ["Centro", "Trindade", "Agronômica"],
        })}
      />,
    );
    expect(screen.getByText("Centro")).toBeInTheDocument();
    expect(screen.getByText("Trindade")).toBeInTheDocument();
    expect(screen.getByText("Agronômica")).toBeInTheDocument();
  });

  it("renders both cities and neighborhoods", () => {
    render(
      <ProviderProfileServiceArea
        profile={makeProfile({
          service_area_cities: ["Florianópolis", "São José"],
          service_area_neighborhoods: ["Centro", "Trindade"],
        })}
      />,
    );
    expect(
      screen.getByText("Florianópolis, São José"),
    ).toBeInTheDocument();
    expect(screen.getByText("Centro")).toBeInTheDocument();
    expect(screen.getByText("Trindade")).toBeInTheDocument();
  });

  it("filters empty neighborhood strings", () => {
    render(
      <ProviderProfileServiceArea
        profile={makeProfile({
          service_area_neighborhoods: ["Centro", "", "Trindade"],
        })}
      />,
    );
    expect(screen.getByText("Centro")).toBeInTheDocument();
    expect(screen.getByText("Trindade")).toBeInTheDocument();
  });
});
