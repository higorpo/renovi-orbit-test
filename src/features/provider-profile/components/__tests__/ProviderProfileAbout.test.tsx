import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProviderProfileAbout } from "../ProviderProfileAbout";
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

describe("ProviderProfileAbout", () => {
  it("renders nothing when bio is null", () => {
    const { container } = render(
      <ProviderProfileAbout profile={makeProfile({ bio: null })} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when bio is empty string", () => {
    const { container } = render(
      <ProviderProfileAbout profile={makeProfile({ bio: "   " })} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders bio text with heading", () => {
    render(
      <ProviderProfileAbout
        profile={makeProfile({ bio: "Eletricista com 10 anos de experiência." })}
      />,
    );
    expect(screen.getByRole("heading", { name: /sobre/i })).toBeInTheDocument();
    expect(
      screen.getByText("Eletricista com 10 anos de experiência."),
    ).toBeInTheDocument();
  });
});
