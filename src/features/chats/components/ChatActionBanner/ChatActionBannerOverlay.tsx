import { AnimatePresence, motion } from "framer-motion";
import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const BANNER_OVERLAY_TRANSITION = {
  duration: 0.22,
  ease: [0.4, 0, 0.2, 1] as const,
};

const BANNER_HIDE_TRANSITION = {
  duration: 0.2,
  ease: "easeOut" as const,
};

export interface ChatActionBannerOverlayProps {
  isDisplayed: boolean;
  children: ReactNode;
  className?: string;
}

export const ChatActionBannerOverlay = forwardRef<HTMLDivElement, ChatActionBannerOverlayProps>(
  function ChatActionBannerOverlay({ isDisplayed, children, className }, ref) {
    return (
      <motion.div
        ref={ref}
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-10 overflow-visible bg-transparent px-4 pb-2",
          className,
        )}
        initial={{ opacity: 0, height: 0, paddingTop: 0 }}
        animate={
          isDisplayed
            ? {
                opacity: 1,
                height: "auto",
                paddingTop: 8,
              }
            : { opacity: 0 }
        }
        exit={{ opacity: 0 }}
        transition={isDisplayed ? BANNER_OVERLAY_TRANSITION : BANNER_HIDE_TRANSITION}
        aria-hidden={!isDisplayed}
      >
        <motion.div
          initial={false}
          animate={isDisplayed ? { y: 0 } : undefined}
          transition={BANNER_OVERLAY_TRANSITION}
          style={{ pointerEvents: isDisplayed ? "auto" : "none" }}
        >
          {children}
        </motion.div>
      </motion.div>
    );
  },
);

export interface ChatActionBannerOverlayHostProps {
  show: boolean;
  isDisplayed: boolean;
  children: ReactNode;
  className?: string;
}

/** Mounts the overlay with enter/exit when the banner is resolved for this chat visit. */
export const ChatActionBannerOverlayHost = forwardRef<HTMLDivElement, ChatActionBannerOverlayHostProps>(
  function ChatActionBannerOverlayHost({ show, isDisplayed, children, className }, ref) {
    return (
      <AnimatePresence initial={false}>
        {show ? (
          <ChatActionBannerOverlay
            key="chat-action-banner-overlay"
            ref={ref}
            isDisplayed={isDisplayed}
            className={className}
          >
            {children}
          </ChatActionBannerOverlay>
        ) : null}
      </AnimatePresence>
    );
  },
);
