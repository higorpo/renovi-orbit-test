interface SettingsSectionHeaderProps {
  title: string;
  description?: string;
}

/** Desktop section title; hidden on mobile where stack chrome shows the title. */
export function SettingsSectionHeader({ title, description }: SettingsSectionHeaderProps) {
  return (
    <header className="mb-6 hidden space-y-1.5 md:block">
      <h2 className="font-display text-display-md font-bold tracking-tight text-ink">{title}</h2>
      {description ? <p className="max-w-2xl text-sm leading-relaxed text-body">{description}</p> : null}
    </header>
  );
}
