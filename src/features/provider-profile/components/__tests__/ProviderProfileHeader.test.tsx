import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProviderProfileHeader } from "../ProviderProfileHeader";
import type { ProviderPublicProfile } from "../../types/providerProfilePublic.types";

vi.mock("../../hooks/usePublicProfileImageUrl", () => ({
  usePublicProfileImageUrl: vi.fn(() => ({ url: "", isLoading: false })),
}));

const shareMock = vi.fn();
vi.mock("../../hooks/useShareProfile", () => ({
  useShareProfile: vi.fn(() => ({
    share: shareMock,
    profileUrl: "https://example.com/perfil/joao-silva",
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
    ...overrides,
  };
}

describe("ProviderProfileHeader", () => {
  beforeEach(() => {
    shareMock.mockReset();
  });

  it("renders display name as heading", () => {
    render(<ProviderProfileHeader profile={makeProfile()} />);
    expect(
      screen.getByRole("heading", { name: /joão silva/i }),
    ).toBeInTheDocument();
  });

  it("falls back to full_name when display_name is null", () => {
    render(
      <ProviderProfileHeader
        profile={makeProfile({
          display_name: null,
          full_name: "Maria Souza",
        })}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /maria souza/i }),
    ).toBeInTheDocument();
  });

  it("shows 'Profissional' when both names are empty", () => {
    render(
      <ProviderProfileHeader
        profile={makeProfile({ display_name: null, full_name: null })}
      />,
    );
    expect(
      screen.getByRole("heading", { name: /profissional/i }),
    ).toBeInTheDocument();
  });

  it("renders since date when created_at is valid", () => {
    render(
      <ProviderProfileHeader
        profile={makeProfile({ created_at: "2024-03-15T12:00:00Z" })}
      />,
    );
    expect(screen.getByText(/no ar desde/i)).toBeInTheDocument();
  });

  it("renders cities when service_area_cities has entries", () => {
    render(
      <ProviderProfileHeader
        profile={makeProfile({
          service_area_cities: ["Florianópolis", "São José"],
        })}
      />,
    );
    expect(screen.getByText("Florianópolis, São José")).toBeInTheDocument();
  });

  it("does not render cities when service_area_cities is null", () => {
    render(
      <ProviderProfileHeader
        profile={makeProfile({ service_area_cities: null })}
      />,
    );
    expect(screen.queryByText("Florianópolis")).not.toBeInTheDocument();
  });

  it("renders share button and calls share on click", () => {
    render(<ProviderProfileHeader profile={makeProfile()} />);

    const shareBtn = screen.getByRole("button", {
      name: /compartilhar perfil/i,
    });
    expect(shareBtn).toBeInTheDocument();

    fireEvent.click(shareBtn);
    expect(shareMock).toHaveBeenCalledOnce();
  });

  it("does not render 'solicitar orçamento' button", () => {
    render(<ProviderProfileHeader profile={makeProfile()} />);
    expect(
      screen.queryByRole("button", { name: /solicitar orçamento/i }),
    ).not.toBeInTheDocument();
  });
});
