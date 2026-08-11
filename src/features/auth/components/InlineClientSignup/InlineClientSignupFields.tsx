import { Eye, EyeOff, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SectionTitleWithIcon } from "@/components/ui/section-title-with-icon";
import { cn } from "@/lib/utils";
import { PASSWORD_REQUIREMENTS } from "../../utils/passwordPolicy";
import { usePasswordFieldDisplay } from "../../hooks/usePasswordFieldDisplay";
import type { ClientSignupIdentityData } from "../../types/clientSignupIdentity.validation";

export interface InlineClientSignupFieldsProps {
  data: ClientSignupIdentityData;
  onDataChange: (
    data: ClientSignupIdentityData | ((prev: ClientSignupIdentityData) => ClientSignupIdentityData)
  ) => void;
  title?: string;
  /** Label or custom content for the terms checkbox (e.g. text with links). */
  termsLabel?: React.ReactNode;
}

const BASE_URL = (import.meta.env.VITE_MAIN_SITE_URL ?? "").replace(/\/$/, "");

const DEFAULT_TERMS_LABEL = (
  <>
    Li e aceito os{" "}
    <a
      href={`${BASE_URL}/juridico/termos-de-uso`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline underline-offset-2 hover:no-underline"
    >
      Termos de Uso
    </a>
    ,{" "}
    <a
      href={`${BASE_URL}/juridico/politica-de-privacidade`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline underline-offset-2 hover:no-underline"
    >
      Política de Privacidade
    </a>
    {" "}e o{" "}
    <a
      href={`${BASE_URL}/juridico/adesao-cliente`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline underline-offset-2 hover:no-underline"
    >
      Termo de Adesão do Cliente
    </a>
    {" "}da Prestway.
  </>
);

export function InlineClientSignupFields({
  data,
  onDataChange,
  title = "Seus dados",
  termsLabel = DEFAULT_TERMS_LABEL,
}: InlineClientSignupFieldsProps) {
  const {
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    passwordDisplay,
  } = usePasswordFieldDisplay({ password: data.password });

  return (
    <div className="space-y-4 sm:space-y-6">
      <SectionTitleWithIcon title={title} icon={User} />
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
        <div>
          <Label className="text-foreground">Nome</Label>
          <Input
            value={data.firstName}
            onChange={(e) => onDataChange((prev) => ({ ...prev, firstName: e.target.value }))}
            placeholder="Nome"
            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div>
          <Label className="text-foreground">Sobrenome</Label>
          <Input
            value={data.lastName}
            onChange={(e) => onDataChange((prev) => ({ ...prev, lastName: e.target.value }))}
            placeholder="Sobrenome"
            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-foreground">E-mail</Label>
          <Input
            type="email"
            value={data.email}
            onChange={(e) => onDataChange((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="seu@email.com"
            className="bg-background border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-foreground">Senha</Label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={data.password}
              onChange={(e) => onDataChange((prev) => ({ ...prev, password: e.target.value }))}
              className="bg-background border-border text-foreground placeholder:text-muted-foreground pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", passwordDisplay.colorClass)}
              style={{ width: `${passwordDisplay.widthPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{passwordDisplay.label}</p>
          <ul className="text-xs text-muted-foreground mt-2 space-y-1">
            {PASSWORD_REQUIREMENTS.map((r, i) => (
              <li key={i} className={r.test(data.password) ? "text-green-600" : ""}>
                {r.test(data.password) ? "✓" : "○"} {r.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="sm:col-span-2">
          <Label className="text-foreground">Confirmar senha</Label>
          <div className="relative">
            <Input
              type={showConfirmPassword ? "text" : "password"}
              value={data.confirmPassword}
              onChange={(e) =>
                onDataChange((prev) => ({ ...prev, confirmPassword: e.target.value }))
              }
              className={cn(
                "bg-background border-border text-foreground placeholder:text-muted-foreground pr-10",
                data.confirmPassword.length > 0 && data.password !== data.confirmPassword &&
                  "border-destructive focus-visible:ring-destructive"
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 text-muted-foreground hover:text-foreground"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          {data.confirmPassword.length > 0 && data.password !== data.confirmPassword && (
            <p className="text-xs text-destructive mt-1" role="alert">
              As senhas não coincidem.
            </p>
          )}
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <Checkbox
            id="terms-inline"
            checked={data.termsAccepted}
            onCheckedChange={(v) =>
              onDataChange((prev) => ({ ...prev, termsAccepted: v === true }))
            }
            className="h-4 w-4 shrink-0 border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
          <Label htmlFor="terms-inline" className="text-foreground text-sm cursor-pointer leading-tight">
            {termsLabel}
          </Label>
        </div>
      </div>
    </div>
  );
}
