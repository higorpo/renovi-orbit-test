interface SettingsSectionHeaderProps {
  title: string;
  description?: string;
}

/** Desktop section title; hidden on mobile where stack chrome shows the title. */
export function SettingsSectionHeader({ title, description }: SettingsSectionHeaderProps) {
  return (
    <header className="mb-6 hidden space-y-1 md:block">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}
