import { useEffect, useState } from "react";

const KEYBOARD_GAP_THRESHOLD_PX = 80;

export function readKeyboardVisible(): boolean {
  const cssHeight = document.documentElement.style.getPropertyValue("--keyboard-height").trim();
  if (cssHeight && cssHeight !== "0px") return true;

  const vv = window.visualViewport;
  if (!vv) return false;

  return window.innerHeight - vv.height - vv.offsetTop > KEYBOARD_GAP_THRESHOLD_PX;
}

/** True while the on-screen keyboard is likely open (Capacitor CSS var or visualViewport). */
export function useVirtualKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(readKeyboardVisible());

    update();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  return visible;
}
