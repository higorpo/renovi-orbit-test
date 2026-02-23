const REMEMBER_ME_KEY = "renovi_remember_login";

export interface RememberMeData {
  email: string;
}

export function loadRememberMe(): RememberMeData | null {
  try {
    const raw = localStorage.getItem(REMEMBER_ME_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as RememberMeData;
    return data?.email ? data : null;
  } catch {
    localStorage.removeItem(REMEMBER_ME_KEY);
    return null;
  }
}

export function saveRememberMe(email: string): void {
  localStorage.setItem(REMEMBER_ME_KEY, JSON.stringify({ email }));
}

export function clearRememberMe(): void {
  localStorage.removeItem(REMEMBER_ME_KEY);
}
