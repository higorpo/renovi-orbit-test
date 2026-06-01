import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CHAT_INTERACTIVE_FOCUS,
  CHAT_MIN_TOUCH_TARGET,
} from "../../utils/conversationVisualState";
import type { ChatActionBannerModel } from "../../utils/chatActionBannerState";

export interface ChatActionBannerProps {
  banner: ChatActionBannerModel;
  onPrimaryAction: () => void;
  onDismiss: () => void;
  className?: string;
}

export function ChatActionBanner({
  banner,
  onPrimaryAction,
  onDismiss,
  className,
}: ChatActionBannerProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/60 bg-muted/40 px-4 py-4 shadow-sm",
        className,
      )}
      aria-live="polite"
    >
      <p className="text-sm leading-relaxed text-foreground">{banner.body}</p>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(CHAT_MIN_TOUCH_TARGET, "px-3", CHAT_INTERACTIVE_FOCUS)}
          onClick={onDismiss}
          aria-label={banner.dismissAriaLabel}
        >
          <span className="sr-only">{banner.dismissAriaLabel}</span>
          <span aria-hidden className="text-sm">
            Dispensar
          </span>
        </Button>

        <Button
          type="button"
          size="sm"
          className={cn(CHAT_MIN_TOUCH_TARGET, "rounded-full px-5", CHAT_INTERACTIVE_FOCUS)}
          onClick={onPrimaryAction}
          aria-label={banner.ctaAriaLabel}
        >
          {banner.ctaLabel}
        </Button>
      </div>
    </section>
  );
}

export function ChatActionBannerSlot({
  banner,
  isVisible,
  onPrimaryAction,
  onDismiss,
  className,
}: ChatActionBannerProps & { isVisible: boolean }) {
  if (!isVisible) return null;

  return (
    <ChatActionBanner
      banner={banner}
      onPrimaryAction={onPrimaryAction}
      onDismiss={onDismiss}
      className={className}
    />
  );
}
