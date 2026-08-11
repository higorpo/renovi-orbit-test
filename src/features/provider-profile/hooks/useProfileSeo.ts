import { useEffect } from "react";
import type { ProviderPublicProfile } from "../types/providerProfilePublic.types";

const SITE_NAME = "Prestway";

function setMetaRobots(content: string) {
  let el = document.querySelector('meta[name="robots"]');
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", "robots");
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Sets document title and robots meta based on profile and visibility.
 * - Public profile: index, follow; title "{display_name} | Prestway"
 * - Restricted or not found: noindex, nofollow
 */
export function useProfileSeo(
  profile: ProviderPublicProfile | null | undefined,
  isLoading: boolean,
  isError: boolean
) {
  useEffect(() => {
    if (isLoading) return;
    if (isError || !profile) {
      document.title = `Perfil | ${SITE_NAME}`;
      setMetaRobots("noindex, nofollow");
      return;
    }
    const publicAndIndexable = profile.profile_visibility === "public";
    const title = profile.display_name?.trim() || profile.full_name?.trim() || "Perfil";
    document.title = `${title} | ${SITE_NAME}`;
    setMetaRobots(publicAndIndexable ? "index, follow" : "noindex, nofollow");
  }, [profile, isLoading, isError]);
}
