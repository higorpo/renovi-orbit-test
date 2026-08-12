import { cn } from "@/lib/utils";

interface SettingsSectionShellProps {
  children: React.ReactNode;
  className?: string;
}

/** Consistent section page padding for mobile stack + desktop outlet. */
export function SettingsSectionShell({ children, className }: SettingsSectionShellProps) {
  return (
    <div className={cn("space-y-5 px-4 py-5 md:space-y-6 md:px-0 md:py-0", className)}>
      {children}
    </div>
  );
}

interface SettingsAutosaveHintProps {
  isSaving: boolean;
}

export function SettingsAutosaveHint({ isSaving }: SettingsAutosaveHintProps) {
  return (
    <p
      className="flex items-center gap-2 text-caption text-muted-foreground"
      aria-live="polite"
    >
      {isSaving ? (
        <>
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
            aria-hidden
          />
          Salvando…
        </>
      ) : (
        "Alterações salvas automaticamente."
      )}
    </p>
  );
}
