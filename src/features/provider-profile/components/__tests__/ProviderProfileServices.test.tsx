import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProviderProfileServices } from "../ProviderProfileServices";
import type { ProviderPublicProfile } from "../../types/providerProfilePublic.types";

vi.mock("@/features/request-quote", () => ({
  getServiceCardStyle: vi.fn(() => ({
    Icon: (props: React.SVGAttributes<SVGElement>) => (
      <svg data-testid="service-icon" {...props} />
    ),
    color: "from-sky-400 to-indigo-500",
  })),
}));

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

describe("ProviderProfileServices", () => {
  it("renders nothing when no services", () => {
    const { container } = render(
      <ProviderProfileServices
        profile={makeProfile({ offered_services: [] })}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders heading and service cards", () => {
    const services = [
      { service_id: "s1", title: "Eletricista", icon_key: "Zap", color_key: "sky_indigo" },
      { service_id: "s2", title: "Encanador", icon_key: "Droplet", color_key: "cyan_blue" },
    ];
    render(
      <ProviderProfileServices
        profile={makeProfile({ offered_services: services })}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /serviços oferecidos/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Eletricista")).toBeInTheDocument();
    expect(screen.getByText("Encanador")).toBeInTheDocument();
    expect(screen.getAllByTestId("service-icon")).toHaveLength(2);
  });

  it("renders single service correctly", () => {
    const services = [
      { service_id: "s1", title: "Pintor", icon_key: null, color_key: null },
    ];
    render(
      <ProviderProfileServices
        profile={makeProfile({ offered_services: services })}
      />,
    );
    expect(screen.getByText("Pintor")).toBeInTheDocument();
  });
});
