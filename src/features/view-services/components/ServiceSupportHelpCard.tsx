import { Headphones, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SERVICE_SUPPORT_HELP_CTA,
  SERVICE_SUPPORT_HELP_DESCRIPTION,
  SERVICE_SUPPORT_HELP_TITLE,
  SERVICE_SUPPORT_URL,
} from "../constants/serviceSupport.constants";

export interface ServiceSupportHelpCardProps {
  className?: string;
}

/**
 * Soft help banner linking to the main-site support page.
 * Self-contained: hides the CTA when `VITE_MAIN_SITE_URL` is not configured.
 */
export function ServiceSupportHelpCard({ className }: ServiceSupportHelpCardProps) {
  return (
    <aside
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-sky-200/80 bg-gradient-to-r from-sky-50 via-sky-50/70 to-card p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5",
        className,
      )}
      aria-label={SERVICE_SUPPORT_HELP_TITLE}
      data-testid="service-support-help-card"
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700"
          aria-hidden
        >
          <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="font-display text-[0.95rem] font-semibold leading-snug tracking-tight text-ink">
            {SERVICE_SUPPORT_HELP_TITLE}
          </p>
          <p className="text-sm leading-snug text-muted-foreground">
            {SERVICE_SUPPORT_HELP_DESCRIPTION}
          </p>
        </div>
      </div>

      {SERVICE_SUPPORT_URL ? (
        <Button
          asChild
          variant="outline"
          className="h-11 w-full shrink-0 border-border bg-card text-foreground hover:bg-card/90 sm:w-auto"
        >
          <a
            href={SERVICE_SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="service-support-help-cta"
          >
            <Headphones className="h-4 w-4" aria-hidden />
            {SERVICE_SUPPORT_HELP_CTA}
          </a>
        </Button>
      ) : null}
    </aside>
  );
}
