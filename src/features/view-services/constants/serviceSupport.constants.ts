const MAIN_SITE_BASE = (import.meta.env.VITE_MAIN_SITE_URL ?? "").replace(/\/$/, "");

/** Main-site support page. Null when `VITE_MAIN_SITE_URL` is unset. */
export const SERVICE_SUPPORT_URL: string | null = MAIN_SITE_BASE
  ? `${MAIN_SITE_BASE}/suporte`
  : null;

export const SERVICE_SUPPORT_HELP_TITLE = "Precisa de ajuda?";
export const SERVICE_SUPPORT_HELP_DESCRIPTION =
  "Nossa equipe está pronta para te ajudar em qualquer etapa do processo.";
export const SERVICE_SUPPORT_HELP_CTA = "Falar com o suporte";
