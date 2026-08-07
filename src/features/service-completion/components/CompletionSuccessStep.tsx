/**
 * Reusable immersive success body for completion flows (provider mark-executed,
 * future client confirm, etc.). Pair with CompletionFlowSheetDialog chrome="immersive".
 */

import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useBreakpointMd } from "@/hooks/useBreakpoint";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type CompletionSuccessTip = {
  icon: LucideIcon;
  title: string;
  body: string;
};

export type CompletionSuccessStepProps = {
  eyebrow: string;
  title: string;
  description: string;
  tipsHeading: string;
  tipsSubheading: string;
  tips: readonly CompletionSuccessTip[];
  dismissLabel?: string;
  onDismiss: () => void;
  testId?: string;
  dismissTestId?: string;
  className?: string;
};

export function CompletionSuccessStep({
  eyebrow,
  title,
  description,
  tipsHeading,
  tipsSubheading,
  tips,
  dismissLabel = "Entendi",
  onDismiss,
  testId = "completion-success",
  dismissTestId = "completion-success-dismiss",
  className,
}: CompletionSuccessStepProps) {
  const isDesktop = useBreakpointMd();
  const reduceMotion = useReducedMotion();

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        aria-hidden
      >
        <div
          className="absolute inset-x-0 top-0 h-[min(70%,380px)]"
          style={{
            background: [
              "linear-gradient(180deg, hsl(var(--success) / 0.12) 0%, hsl(var(--success) / 0.05) 28%, transparent 62%)",
              "radial-gradient(95% 80% at 50% 0%, hsl(var(--success) / 0.18) 0%, hsl(var(--success) / 0.06) 45%, transparent 72%)",
              "radial-gradient(55% 50% at 82% 12%, hsl(var(--primary) / 0.07) 0%, transparent 70%)",
            ].join(", "),
          }}
        />
      </div>

      <div
        className={cn(
          "relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-5",
          isDesktop ? "px-5 pt-6" : "px-4 pt-10 touch-pan-y",
        )}
      >
        <div className="relative space-y-6" data-testid={testId}>
          <div className="flex flex-col items-center text-center">
            <motion.div
              className="relative mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center"
              initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 280, damping: 18, delay: 0.05 }
              }
            >
              <span
                className="absolute inset-0 rounded-full bg-[hsl(var(--success)/0.18)]"
                aria-hidden
              />
              {!reduceMotion ? (
                <motion.span
                  className="absolute inset-[-6px] rounded-full border border-[hsl(var(--success)/0.35)]"
                  initial={{ scale: 0.85, opacity: 0.8 }}
                  animate={{ scale: 1.35, opacity: 0 }}
                  transition={{
                    duration: 1.1,
                    ease: "easeOut",
                    repeat: Infinity,
                    repeatDelay: 0.6,
                  }}
                  aria-hidden
                />
              ) : null}
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-success text-success-foreground shadow-[0_10px_28px_-8px_hsl(var(--success)/0.55)]">
                <Check className="h-7 w-7" strokeWidth={2.5} aria-hidden />
              </span>
            </motion.div>

            <motion.p
              className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-success"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.12, duration: 0.35 }}
            >
              {eyebrow}
            </motion.p>

            <motion.h3
              className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.18, duration: 0.4 }}
            >
              {title}
            </motion.h3>

            <motion.p
              className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.26, duration: 0.4 }}
            >
              {description}
            </motion.p>
          </div>

          <motion.div
            className="overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-[0_1px_0_hsl(var(--border)/0.6)] backdrop-blur-sm"
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduceMotion ? 0 : 0.34, duration: 0.4 }}
          >
            <div className="border-b border-border/60 bg-primary/[0.03] px-4 py-3">
              <p className="text-sm font-semibold text-foreground">
                {tipsHeading}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                {tipsSubheading}
              </p>
            </div>

            <ol className="divide-y divide-border/50">
              {tips.map((tip, index) => {
                const Icon = tip.icon;
                return (
                  <motion.li
                    key={tip.title}
                    className="flex gap-3 px-4 py-3.5"
                    initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: reduceMotion ? 0 : 0.42 + index * 0.08,
                      duration: 0.35,
                    }}
                  >
                    <span
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
                      aria-hidden
                    >
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 space-y-0.5 text-left">
                      <p className="text-sm font-semibold leading-snug text-foreground">
                        <span className="mr-1.5 font-display text-xs font-bold text-copper">
                          {index + 1}.
                        </span>
                        {tip.title}
                      </p>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {tip.body}
                      </p>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </motion.div>
        </div>
      </div>

      <div
        className={cn(
          "relative shrink-0 border-t border-border/80 bg-background/95 py-3 backdrop-blur-md",
          isDesktop
            ? "flex justify-end px-5"
            : "px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)]",
        )}
      >
        <Button
          type="button"
          className="w-full transition-transform duration-150 ease-out active:scale-[0.97] sm:w-auto sm:min-w-[10rem]"
          data-testid={dismissTestId}
          onClick={onDismiss}
        >
          {dismissLabel}
        </Button>
      </div>
    </div>
  );
}
