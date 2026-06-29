export function getEnvSecret(name: string): string {
  const envName = name.toUpperCase();
  const value = Deno.env.get(envName)?.trim();

  if (!value) {
    throw new Error(`SECRET_NOT_CONFIGURED:${envName}`);
  }

  return value;
}
