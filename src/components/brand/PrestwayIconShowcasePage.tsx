import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PrestwayIcon,
  type PrestwayIconLayout,
  type PrestwayIconVariant,
  type PrestwayWordmarkTone,
} from "./PrestwayIcon";

const VARIANTS: readonly PrestwayIconVariant[] = [
  "client",
  "provider",
  "inst",
  "white",
  "dark",
];

const LAYOUTS: readonly PrestwayIconLayout[] = ["icon", "full", "wordmark"];

const WORDMARK_TONES: readonly (PrestwayWordmarkTone | undefined)[] = [
  undefined,
  "dark",
  "white",
];

type SwatchProps = {
  label: string;
  code: string;
  darkSurface?: boolean;
  className?: string;
  children: ReactNode;
};

function Swatch({ label, code, darkSurface, className, children }: SwatchProps) {
  return (
    <article className="space-y-2">
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border border-border/60 px-4 py-6",
          darkSurface ? "bg-neutral-950" : "bg-background",
          className
        )}
      >
        {children}
      </div>
      <div className="space-y-0.5 px-0.5">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          {code}
        </p>
      </div>
    </article>
  );
}

function needsDarkSurface(
  variant: PrestwayIconVariant,
  wordmarkTone?: PrestwayWordmarkTone
): boolean {
  if (variant === "white") return true;
  if (wordmarkTone === "white") return true;
  return false;
}

export function PrestwayIconShowcasePage() {
  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8 pb-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="space-y-2">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Dev only
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Prestway Icon — Showcase
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Todas as combinações de <code className="text-xs">variant</code>,{" "}
            <code className="text-xs">layout</code> e{" "}
            <code className="text-xs">wordmarkTone</code> do componente de marca.
          </p>
          <p className="font-mono text-[11px] text-muted-foreground/80">
            /dev/demo/prestway-icon-showcase
          </p>
        </header>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">layout=&quot;icon&quot;</h2>
            <p className="text-xs text-muted-foreground">
              Símbolo isolado · {VARIANTS.length} variantes
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
            {VARIANTS.map((variant) => (
              <Swatch
                key={variant}
                label={variant}
                code={`variant="${variant}"`}
                darkSurface={needsDarkSurface(variant)}
              >
                <PrestwayIcon variant={variant} className="h-16" />
              </Swatch>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">layout=&quot;full&quot;</h2>
            <p className="text-xs text-muted-foreground">
              Lockup completo (marca + Prestway) · wordmarkTone padrão
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VARIANTS.map((variant) => (
              <Swatch
                key={variant}
                label={variant}
                code={`variant="${variant}" layout="full"`}
                darkSurface={needsDarkSurface(variant)}
              >
                <PrestwayIcon variant={variant} layout="full" className="h-10 w-auto" />
              </Swatch>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              layout=&quot;full&quot; + wordmarkTone
            </h2>
            <p className="text-xs text-muted-foreground">
              Marcas coloridas com wordmark escuro ou branco (como logo-inst-dark /
              logo-inst-white)
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(["client", "provider", "inst"] as const).flatMap((variant) =>
              (["dark", "white"] as const).map((tone) => (
                <Swatch
                  key={`${variant}-${tone}`}
                  label={`${variant} · wordmark ${tone}`}
                  code={`variant="${variant}" layout="full" wordmarkTone="${tone}"`}
                  darkSurface={needsDarkSurface(variant, tone)}
                >
                  <PrestwayIcon
                    variant={variant}
                    layout="full"
                    wordmarkTone={tone}
                    className="h-10 w-auto"
                  />
                </Swatch>
              ))
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              layout=&quot;wordmark&quot;
            </h2>
            <p className="text-xs text-muted-foreground">
              Só o nome Prestway · tons dark / white
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(["dark", "white"] as const).map((tone) => (
              <Swatch
                key={tone}
                label={`wordmark · ${tone}`}
                code={`layout="wordmark" wordmarkTone="${tone}"`}
                darkSurface={tone === "white"}
              >
                <PrestwayIcon
                  layout="wordmark"
                  wordmarkTone={tone}
                  className="h-8 w-auto"
                />
              </Swatch>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Matriz completa</h2>
            <p className="text-xs text-muted-foreground">
              Todos os layouts × variantes × wordmarkTone (quando aplicável)
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border/60 bg-background">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40">
                  <th className="px-3 py-2 font-medium">layout</th>
                  <th className="px-3 py-2 font-medium">variant</th>
                  <th className="px-3 py-2 font-medium">wordmarkTone</th>
                  <th className="px-3 py-2 font-medium">Preview</th>
                </tr>
              </thead>
              <tbody>
                {LAYOUTS.flatMap((layout) =>
                  VARIANTS.flatMap((variant) => {
                    const tones =
                      layout === "icon" ? ([undefined] as const) : WORDMARK_TONES;
                    return tones.map((tone) => {
                      const darkSurface = needsDarkSurface(
                        variant,
                        tone === undefined ? undefined : tone
                      );
                      const codeParts = [
                        `variant="${variant}"`,
                        layout !== "icon" ? `layout="${layout}"` : null,
                        tone ? `wordmarkTone="${tone}"` : null,
                      ].filter(Boolean);

                      return (
                        <tr
                          key={`${layout}-${variant}-${tone ?? "default"}`}
                          className="border-b border-border/40 last:border-0"
                        >
                          <td className="px-3 py-2 font-mono text-xs">{layout}</td>
                          <td className="px-3 py-2 font-mono text-xs">{variant}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {tone ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <div
                              className={cn(
                                "inline-flex items-center rounded-md px-3 py-2",
                                darkSurface ? "bg-neutral-950" : "bg-muted/50"
                              )}
                              title={codeParts.join(" ")}
                            >
                              <PrestwayIcon
                                variant={variant}
                                layout={layout}
                                wordmarkTone={tone}
                                className={
                                  layout === "icon"
                                    ? "h-8"
                                    : layout === "full"
                                      ? "h-6 w-auto"
                                      : "h-5 w-auto"
                                }
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
