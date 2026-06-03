import { Clock, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ImagePreviewStrip } from "@/components/ImagePreviewStrip";
import { getServiceCardStyle, useServiceRequestPhotoUrls } from "@/features/request-quote";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import { cn } from "@/lib/utils";
import type { ConversationDetailResponse } from "../../types/chats.types";
import { formatChatDetailsLocation } from "../../utils/chatDetailsCopy";

export interface ChatDetailsServiceCardProps {
  detail: ConversationDetailResponse;
  className?: string;
}

export function ChatDetailsServiceCard({ detail, className }: ChatDetailsServiceCardProps) {
  const { urls: photoUrls, isLoading: photoUrlsLoading } = useServiceRequestPhotoUrls(
    detail.service_request.photos,
  );
  const serviceStyle = getServiceCardStyle({
    icon_key: detail.service.icon_key,
    color_key: detail.service.color_key,
  });
  const location = formatChatDetailsLocation(detail.address);

  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader className="space-y-3 !pb-3">
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
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">{detail.service.title}</p>
            <h3 className="text-base font-semibold leading-tight sm:text-lg">
              {detail.service_request.title}
            </h3>
          </div>
        </div>

        {detail.service_request.description ? (
          <p className="line-clamp-3 text-sm text-muted-foreground">
            {detail.service_request.description}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {location ? (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {location}
            </span>
          ) : null}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Publicado {formatRelativeDate(detail.service_request.created_at).toLowerCase()}
          </span>
        </div>
      </CardHeader>

      {detail.service_request.photos.length > 0 ? (
        <CardContent className="!pt-0">
          <ImagePreviewStrip
            urls={photoUrls}
            isLoading={photoUrlsLoading}
            className="mt-1"
          />
        </CardContent>
      ) : null}
    </Card>
  );
}
