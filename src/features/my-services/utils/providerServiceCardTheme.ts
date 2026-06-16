import type { ServiceListPhase } from "@/features/view-services/types/service.types";
import type { ProviderCardHighlightEmphasis } from "./providerServiceCardPresentation";

export interface ProviderCardTheme {
  card: string;
  phaseBadge: string;
  infoIcon: string;
  infoText: string;
  highlight: {
    box: string;
    title: string;
    detail: string;
    iconBox: string;
    icon: string;
  };
}

const PHASE_BADGE: Record<ServiceListPhase, string> = {
  negotiation:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-100",
  in_progress:
    "border-primary/20 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/15",
  completed:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100",
  cancelled:
    "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100",
};

const PHASE_INFO: Record<ServiceListPhase, { icon: string; text: string }> = {
  negotiation: {
    icon: "text-primary/80 dark:text-primary/90",
    text: "text-foreground/85",
  },
  in_progress: {
    icon: "text-primary/80 dark:text-primary/90",
    text: "text-foreground/85",
  },
  completed: {
    icon: "text-primary/80 dark:text-primary/90",
    text: "text-foreground/85",
  },
  cancelled: {
    icon: "text-primary/80 dark:text-primary/90",
    text: "text-foreground/85",
  },
};

function highlightForPhase(
  phase: ServiceListPhase,
  emphasis: ProviderCardHighlightEmphasis,
): ProviderCardTheme["highlight"] {
  if (emphasis === "urgent") {
    return {
      box: "border border-orange-300/70 bg-orange-50 dark:border-orange-700/50 dark:bg-orange-950/35",
      title: "text-orange-950 dark:text-orange-50",
      detail: "text-orange-800/80 dark:text-orange-200/80",
      iconBox: "bg-orange-200/80 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300",
      icon: "text-orange-700 dark:text-orange-300",
    };
  }

  if (emphasis === "cancelled") {
    return {
      box: "border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/35",
      title: "text-rose-950 dark:text-rose-50",
      detail: "text-rose-800/85 dark:text-rose-200/85",
      iconBox: "bg-rose-200/70 text-rose-700 dark:bg-rose-900/55 dark:text-rose-300",
      icon: "text-rose-700 dark:text-rose-300",
    };
  }

  if (phase === "completed") {
    return {
      box: "border border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-900/40 dark:bg-emerald-950/30",
      title: "text-emerald-950 dark:text-emerald-50",
      detail: "text-emerald-800/85 dark:text-emerald-200/85",
      iconBox: "bg-emerald-200/70 text-emerald-700 dark:bg-emerald-900/55 dark:text-emerald-300",
      icon: "text-emerald-700 dark:text-emerald-300",
    };
  }

  if (phase === "negotiation") {
    if (emphasis === "attention") {
      return {
        box: "border border-amber-300/80 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-950/35",
        title: "text-amber-950 dark:text-amber-50",
        detail: "text-amber-900/80 dark:text-amber-200/80",
        iconBox: "bg-amber-200/80 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
        icon: "text-amber-800 dark:text-amber-200",
      };
    }
    return {
      box: "border border-border/60 bg-muted/20",
      title: "text-foreground",
      detail: "text-muted-foreground",
      iconBox: "bg-muted/70 text-muted-foreground",
      icon: "text-muted-foreground",
    };
  }

  if (phase === "in_progress") {
    if (emphasis === "attention") {
      return {
        box: "border border-primary/30 bg-primary/8 dark:border-primary/35 dark:bg-primary/12",
        title: "text-foreground",
        detail: "text-foreground/70",
        iconBox: "bg-primary/15 text-primary dark:bg-primary/20",
        icon: "text-primary",
      };
    }
    return {
      box: "border border-primary/20 bg-primary/5 dark:border-primary/25 dark:bg-primary/10",
      title: "text-foreground",
      detail: "text-foreground/70",
      iconBox: "bg-primary/10 text-primary dark:bg-primary/15",
      icon: "text-primary",
    };
  }

  // cancelled phase fallback (non-cancelled emphasis)
  return {
    box: "border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/35",
    title: "text-rose-950 dark:text-rose-50",
    detail: "text-rose-800/85 dark:text-rose-200/85",
    iconBox: "bg-rose-200/70 text-rose-700 dark:bg-rose-900/55 dark:text-rose-300",
    icon: "text-rose-700 dark:text-rose-300",
  };
}

export function getProviderCardTheme(
  listPhase: ServiceListPhase,
  emphasis: ProviderCardHighlightEmphasis,
  options?: { isTodayService?: boolean },
): ProviderCardTheme {
  const info = PHASE_INFO[listPhase];

  return {
    card: [
      options?.isTodayService &&
        "border-orange-300/70 ring-1 ring-orange-300/30 dark:border-orange-700/50 dark:ring-orange-700/25",
      listPhase === "cancelled" &&
        "border-rose-200/80 bg-rose-50/20 dark:border-rose-900/40 dark:bg-rose-950/10",
    ]
      .filter(Boolean)
      .join(" "),
    phaseBadge: PHASE_BADGE[listPhase],
    infoIcon: info.icon,
    infoText: info.text,
    highlight: highlightForPhase(listPhase, emphasis),
  };
}
