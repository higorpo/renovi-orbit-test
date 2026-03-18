import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useProfileSeo } from "../useProfileSeo";
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
    ...overrides,
  };
}

function getMetaRobots(): string {
  return (
    document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? ""
  );
}

describe("useProfileSeo", () => {
  beforeEach(() => {
    document.title = "";
    document.querySelector('meta[name="robots"]')?.remove();
  });

  it("does nothing while loading", () => {
    renderHook(() => useProfileSeo(null, true, false));
    expect(document.title).toBe("");
  });

  it("sets noindex when error", () => {
    renderHook(() => useProfileSeo(null, false, true));
    expect(document.title).toContain("Perfil");
    expect(getMetaRobots()).toBe("noindex, nofollow");
  });

  it("sets noindex when no profile", () => {
    renderHook(() => useProfileSeo(null, false, false));
    expect(getMetaRobots()).toBe("noindex, nofollow");
  });

  it("sets title and robots for public profile", () => {
    const profile = makeProfile();
    renderHook(() => useProfileSeo(profile, false, false));
    expect(document.title).toBe("João Silva | Renovi");
    expect(getMetaRobots()).toBe("index, follow");
  });

  it("sets noindex for restricted profile", () => {
    const profile = makeProfile({ profile_visibility: "restricted" });
    renderHook(() => useProfileSeo(profile, false, false));
    expect(document.title).toBe("João Silva | Renovi");
    expect(getMetaRobots()).toBe("noindex, nofollow");
  });

  it("falls back to full_name when display_name is empty", () => {
    const profile = makeProfile({
      display_name: null,
      full_name: "Maria Souza",
    });
    renderHook(() => useProfileSeo(profile, false, false));
    expect(document.title).toBe("Maria Souza | Renovi");
  });

  it("uses 'Perfil' when both names are empty", () => {
    const profile = makeProfile({ display_name: null, full_name: null });
    renderHook(() => useProfileSeo(profile, false, false));
    expect(document.title).toBe("Perfil | Renovi");
  });
});
