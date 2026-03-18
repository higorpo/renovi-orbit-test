import type { ProviderPublicProfile } from "../types/providerProfilePublic.types";

export interface ProviderProfileAboutProps {
  profile: ProviderPublicProfile;
}

export function ProviderProfileAbout({ profile }: ProviderProfileAboutProps) {
  const bio = profile.bio?.trim();
  if (!bio) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Sobre</h2>
      <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
        {bio}
      </p>
    </section>
  );
}
