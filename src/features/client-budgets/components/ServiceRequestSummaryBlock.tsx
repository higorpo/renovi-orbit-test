import { Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { getServiceCardStyle } from "@/features/request-quote";
import { formatRelativeDate } from "@/lib/formatRelativeDate";

interface ServiceRequestSummaryBlockProps {
  serviceTitle: string;
  serviceRequestTitle: string;
  description: string | null;
  iconKey: string | null;
  colorKey: string | null;
  location: string;
  createdAt: string;
}

export function ServiceRequestSummaryBlock({
  serviceTitle,
  serviceRequestTitle,
  description,
  iconKey,
  colorKey,
  location,
  createdAt,
}: ServiceRequestSummaryBlockProps) {
  const serviceStyle = getServiceCardStyle({
    icon_key: iconKey,
    color_key: colorKey,
  });

  return (
    <div className="space-y-2.5">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
            serviceStyle.color,
          )}
          aria-hidden
        >
          <serviceStyle.Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{serviceTitle}</p>
          <h3 className="text-base font-semibold leading-tight sm:text-lg">{serviceRequestTitle}</h3>
        </div>
      </div>

      {description ? <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {location ? (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {location}
          </span>
        ) : null}
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Publicado {formatRelativeDate(createdAt).toLowerCase()}
        </span>
      </div>
    </div>
  );
}
