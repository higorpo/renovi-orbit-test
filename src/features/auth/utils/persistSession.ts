/**
 * Persist session preference for auth storage.
 * When true, session is stored in localStorage (survives browser close).
 * When false, session is stored in sessionStorage (logout when browser/tab closes).
 */
const PERSIST_SESSION_KEY = "orbit_persist_session";

export function getPersistSession(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(PERSIST_SESSION_KEY);
    if (raw === null) return true;
    return raw === "true";
  } catch {
    return true;
  }
}

export function setPersistSession(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PERSIST_SESSION_KEY, value ? "true" : "false");
  } catch {
    // ignore
  }
}
