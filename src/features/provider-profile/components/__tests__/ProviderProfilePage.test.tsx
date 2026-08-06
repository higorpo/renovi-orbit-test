import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProviderProfilePage } from "../ProviderProfilePage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { useProviderPublicProfile } from "../../hooks/useProviderPublicProfile";
import type { ProviderPublicProfile } from "../../types/providerProfilePublic.types";

vi.mock("../../hooks/useProviderPublicProfile", () => ({
  useProviderPublicProfile: vi.fn(),
}));

vi.mock("../../hooks/useProfileSeo", () => ({
  useProfileSeo: vi.fn(),
}));

vi.mock("../ProviderProfileHeader", () => ({
  ProviderProfileHeader: ({ profile }: { profile: ProviderPublicProfile }) => (
    <div data-testid="header">{profile.display_name}</div>
  ),
}));

vi.mock("../ProviderProfileAbout", () => ({
  ProviderProfileAbout: () => <div data-testid="about" />,
}));

vi.mock("../ProviderProfileServices", () => ({
  ProviderProfileServices: () => <div data-testid="services" />,
}));

vi.mock("../ProviderProfilePortfolio", () => ({
  ProviderProfilePortfolio: () => <div data-testid="portfolio" />,
}));

vi.mock("../ProviderProfileServiceArea", () => ({
  ProviderProfileServiceArea: () => <div data-testid="service-area" />,
}));

vi.mock("../ProviderProfileReviews", () => ({
  ProviderProfileReviews: () => <div data-testid="reviews" />,
}));

vi.mock("../ProviderProfileCtaBanner", () => ({
  ProviderProfileCtaBanner: () => <div data-testid="cta-banner" />,
}));

vi.mock("../ProviderProfileSkeleton", () => ({
  ProviderProfileSkeleton: () => (
    <div data-testid="skeleton" className="animate-pulse" />
  ),
}));

const useProviderPublicProfileMock = vi.mocked(useProviderPublicProfile);

function TestWrapper({ slug }: { slug: string }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/perfil/${slug}`]}>
        <Routes>
          <Route path="/perfil/:slug" element={<ProviderProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const mockProfile: ProviderPublicProfile = {
  provider_id: "p1",
  slug: "joao-silva",
  display_name: "João Silva",
  bio: "Eletricista.",
  profile_visibility: "public",
  service_area_cities: ["Florianópolis"],
  service_area_regions: null,
  service_area_neighborhoods: null,
  full_name: "João Silva",
  profile_image_path: null,
  created_at: "2024-01-01T00:00:00Z",
  offered_services: [
    { service_id: "s1", title: "Eletricista", icon_key: "Zap", color_key: "sky_indigo" },
  ],
  portfolio_items: [],
  rating_avg: null,
  rating_count: 0,
  completed_services_count: 0,
};

describe("ProviderProfilePage", () => {
  beforeEach(() => {
    useProviderPublicProfileMock.mockReset();
  });

  it("shows skeleton when loading", () => {
    useProviderPublicProfileMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useProviderPublicProfileMock>);

    render(<TestWrapper slug="joao" />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("header")).not.toBeInTheDocument();
  });

  it("shows not found when no profile", () => {
    useProviderPublicProfileMock.mockReturnValue({
      data: { data: null, error: null },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useProviderPublicProfileMock>);

    render(<TestWrapper slug="unknown" />);
    expect(
      screen.getByRole("heading", { name: /perfil não encontrado/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /voltar ao início/i }),
    ).toBeInTheDocument();
  });

  it("shows not found on error", () => {
    useProviderPublicProfileMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as ReturnType<typeof useProviderPublicProfileMock>);

    render(<TestWrapper slug="x" />);
    expect(
      screen.getByRole("heading", { name: /perfil não encontrado/i }),
    ).toBeInTheDocument();
  });

  it("renders all profile sections when data exists", () => {
    useProviderPublicProfileMock.mockReturnValue({
      data: { data: mockProfile, error: null },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useProviderPublicProfileMock>);

    render(<TestWrapper slug="joao-silva" />);
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("about")).toBeInTheDocument();
    expect(screen.getByTestId("services")).toBeInTheDocument();
    expect(screen.getByTestId("portfolio")).toBeInTheDocument();
    expect(screen.getByTestId("reviews")).toBeInTheDocument();
    expect(screen.getByTestId("service-area")).toBeInTheDocument();
    expect(screen.getByTestId("cta-banner")).toBeInTheDocument();
  });

  it("renders Renovi logo linking to home", () => {
    useProviderPublicProfileMock.mockReturnValue({
      data: { data: mockProfile, error: null },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useProviderPublicProfileMock>);

    render(<TestWrapper slug="joao-silva" />);
    const logo = screen.getByAltText("Renovi");
    expect(logo).toBeInTheDocument();
    expect(logo.closest("a")).toHaveAttribute("href", "/");
  });

  it("does not render solicitar orçamento button", () => {
    useProviderPublicProfileMock.mockReturnValue({
      data: { data: mockProfile, error: null },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useProviderPublicProfileMock>);

    render(<TestWrapper slug="joao-silva" />);
    expect(
      screen.queryByRole("button", { name: /solicitar orçamento/i }),
    ).not.toBeInTheDocument();
  });

  it("renders 'voltar ao início' button when no profile and navigates on click", async () => {
    useProviderPublicProfileMock.mockReturnValue({
      data: { data: null, error: null },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useProviderPublicProfileMock>);

    render(<TestWrapper slug="unknown" />);
    const backBtn = screen.getByRole("button", { name: /voltar ao início/i });
    backBtn.click();
  });
});
