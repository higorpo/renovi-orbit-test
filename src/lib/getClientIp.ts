export async function getClientIpBestEffort(): Promise<string | null> {
  try {
    const response = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as { ip?: string };
    return typeof payload.ip === "string" ? payload.ip : null;
  } catch {
    return null;
  }
}
