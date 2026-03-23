import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelativeDate } from "@/lib/formatRelativeDate";
import { usePublicProfileImageUrl } from "@/features/provider-profile/hooks/usePublicProfileImageUrl";
import type { QuestionPreviewItem } from "../types/client-budgets.types";
import { QuestionStatusBadge } from "./QuestionStatusBadge";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "P").toUpperCase();
}

export function QuestionPreviewRow({ question }: { question: QuestionPreviewItem }) {
  const { url } = usePublicProfileImageUrl(question.provider_profile_image_path);
  return (
    <div className="space-y-1 rounded-lg border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={url} alt={question.provider_name} />
            <AvatarFallback>{initials(question.provider_name)}</AvatarFallback>
          </Avatar>
          <p className="truncate text-sm font-medium">{question.provider_name}</p>
        </div>
        <QuestionStatusBadge
          clientResponse={question.client_response}
          clientRespondedAt={question.client_responded_at}
        />
      </div>
      <p className="line-clamp-2 text-sm text-foreground">{question.question}</p>
      <p className="text-xs text-muted-foreground">{formatRelativeDate(question.created_at)}</p>
    </div>
  );
}
