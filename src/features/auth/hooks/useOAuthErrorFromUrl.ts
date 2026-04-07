import { useEffect } from "react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

function getOAuthErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const error = params.get("error") ?? hashParams.get("error");
  const description =
    params.get("error_description") ?? hashParams.get("error_description");
  if (!error) return null;
  try {
    return description
      ? decodeURIComponent(description.replace(/\+/g, " "))
      : error;
  } catch {
    return description ?? error;
  }
}

function clearOAuthErrorFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  url.hash = "";
  window.history.replaceState({}, "", url.pathname + url.search);
}

/**
 * On mount, checks for OAuth error in query/hash, shows a toast and cleans the URL.
 */
export function useOAuthErrorFromUrl(): void {
  useEffect(() => {
    const oauthError = getOAuthErrorFromUrl();
    if (!oauthError) return;

    clearOAuthErrorFromUrl();
    const isExchangeError = /exchange|external code/i.test(oauthError);
    if (isExchangeError) {
      toast.error("Erro ao conectar com Google", {
        description:
          "Verifique a configuração do Google OAuth no Supabase e no Google Cloud Console (redirect URI e Client Secret).",
      });
    } else {
      logger.warn("auth_oauth_callback_error", { oauthError });
      toast.error("Erro ao conectar com Google. Tente novamente.");
    }
  }, []);
}
