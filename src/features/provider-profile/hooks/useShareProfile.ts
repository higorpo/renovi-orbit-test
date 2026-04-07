import { useCallback } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { buildProfileUrl } from "../utils/profileUrl";
import type { ProviderPublicProfile } from "../types/providerProfilePublic.types";

/**
 * Provides a share function for the provider profile (Web Share API with clipboard fallback).
 */
export function useShareProfile(profile: ProviderPublicProfile) {
  const displayName =
    profile.display_name?.trim() || profile.full_name?.trim() || "Profissional";
  const profileUrl = buildProfileUrl(profile.slug);

  const copyLink = useCallback(async () => {
    if (!navigator.clipboard?.writeText) {
      toast.error("Não foi possível copiar o link neste dispositivo.");
      return;
    }
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast.success("Link copiado!", {
        description: "O link do perfil foi copiado para a área de transferência.",
      });
    } catch (err) {
      logger.warn("share_profile_clipboard_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error("Não foi possível copiar o link.");
    }
  }, [profileUrl]);

  const share = useCallback(async () => {
    const shareData = {
      title: `${displayName} | Renovi`,
      url: profileUrl,
      text: `Conheça o perfil de ${displayName} na Renovi.`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        await copyLink();
      }
    } else {
      await copyLink();
    }
  }, [displayName, profileUrl, copyLink]);

  return { share, profileUrl };
}
