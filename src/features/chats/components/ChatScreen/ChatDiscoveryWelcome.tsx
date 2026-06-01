import { MessageCircle } from "lucide-react";
import type { ProfileRole } from "@/features/auth";
import { cn } from "@/lib/utils";
import { getChatDiscoveryWelcomeContent } from "../../utils/chatDiscoveryWelcome";

export interface ChatDiscoveryWelcomeProps {
  viewerRole: ProfileRole;
  className?: string;
}

export function ChatDiscoveryWelcome({ viewerRole, className }: ChatDiscoveryWelcomeProps) {
  const { title, body } = getChatDiscoveryWelcomeContent(viewerRole);

  return (
    <section
      className={cn(
        "mx-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-border/60 bg-muted/30 px-5 py-6 text-center",
        className,
      )}
      aria-label={title}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
        aria-hidden
      >
        <MessageCircle className="h-6 w-6" />
      </div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </section>
  );
}
