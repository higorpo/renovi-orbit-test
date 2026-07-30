import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROVIDER_KYC_SUPPORT_URL } from "../../constants/kyc.constants";
import { cn } from "@/lib/utils";

export type KycStatusLayoutProps = {
  icon: LucideIcon;
  title: string;
  body: string;
  /** When true, shows the support CTA (default true). */
  showSupportCta?: boolean;
  supportLabel?: string;
  action?: ReactNode;
  className?: string;
  /** Extra content below the body (e.g. spinner). */
  children?: ReactNode;
};

export function KycStatusLayout({
  icon: Icon,
  title,
  body,
  showSupportCta = true,
  supportLabel = "Falar com suporte",
  action,
  className,
  children,
}: KycStatusLayoutProps) {
  const supportHref = PROVIDER_KYC_SUPPORT_URL || "/dashboard/help";

  return (
    <div
      className={cn(
        "container flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-10 text-center",
        className,
      )}
      role="status"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
      {children ? <div className="mt-5 w-full">{children}</div> : null}
      {(action || showSupportCta) ? (
        <div className="mt-6 flex w-full max-w-xs flex-col items-stretch gap-2">
          {action}
          {showSupportCta ? (
            <Button asChild variant={action ? "outline" : "default"} className="gap-2">
              <a href={supportHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" aria-hidden />
                {supportLabel}
              </a>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
