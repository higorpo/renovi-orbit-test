import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation } from "react-router";
import { cn } from "@/lib/utils";

const SLIDE_EASE = [0.32, 0.72, 0, 1] as const;
const SLIDE_DURATION = 0.28;

interface MobileStackTransitionProps {
  children: ReactNode;
  className?: string;
}

function useStackSlideDirection(): number {
  const location = useLocation();
  const previousRef = useRef({ pathname: location.pathname, key: location.key });
  const [direction, setDirection] = useState(1);

  useLayoutEffect(() => {
    const previous = previousRef.current;
    const wentBack =
      location.key !== previous.key &&
      location.pathname.length <= previous.pathname.length;

    setDirection(wentBack ? -1 : 1);
    previousRef.current = { pathname: location.pathname, key: location.key };
  }, [location.key, location.pathname]);

  return direction;
}

export function MobileStackTransition({ children, className }: MobileStackTransitionProps) {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const direction = useStackSlideDirection();

  if (prefersReducedMotion) {
    return <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>{children}</div>;
  }

  return (
    <div className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", className)}>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={location.pathname}
          custom={direction}
          initial="enter"
          animate="center"
          exit="exit"
          variants={{
            enter: (slideDirection: number) => ({
              x: slideDirection > 0 ? "100%" : "-24%",
              opacity: slideDirection > 0 ? 1 : 0.92,
            }),
            center: { x: 0, opacity: 1 },
            exit: (slideDirection: number) => ({
              x: slideDirection > 0 ? "-24%" : "100%",
              opacity: slideDirection > 0 ? 0.92 : 1,
            }),
          }}
          transition={{ duration: SLIDE_DURATION, ease: SLIDE_EASE }}
          className="absolute inset-0 flex min-h-0 min-w-0 flex-col overflow-y-auto overflow-x-hidden bg-background"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
