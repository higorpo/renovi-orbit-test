import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getPasswordStrengthLabel,
  getPasswordStrengthColor,
  PASSWORD_REQUIREMENTS,
} from "../../utils/passwordPolicy";
import type { ResetPasswordFormData } from "../../types/resetPassword.validation";

const INPUT_CLASS =
  "bg-white/10 border-white/30 text-white placeholder:text-white/50 h-12 focus:border-[#C57A3A] focus:ring-[#C57A3A]/20";
const INPUT_ERROR_CLASS = "border-red-400";
const ERROR_MESSAGE_CLASS =
  "text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2";

export interface ResetPasswordFormProps {
  formData: ResetPasswordFormData;
  setFormData: React.Dispatch<React.SetStateAction<ResetPasswordFormData>>;
  errors: Record<string, string>;
  submitting: boolean;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (value: boolean) => void;
  passwordStrength: number;
  onSubmit: (e: React.FormEvent) => void;
}

export function ResetPasswordForm({
  formData,
  setFormData,
  errors,
  submitting,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  passwordStrength,
  onSubmit,
}: ResetPasswordFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="password" className="text-white/90 font-medium">
          Nova senha
        </Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Mínimo 10 caracteres"
            value={formData.password}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, password: e.target.value }))
            }
            className={cn(
              INPUT_CLASS,
              "pr-12",
              errors.password && INPUT_ERROR_CLASS
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>
        {formData.password && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    i < passwordStrength
                      ? getPasswordStrengthColor(passwordStrength)
                      : "bg-white/20"
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-white/60">
              {getPasswordStrengthLabel(passwordStrength)}
            </p>
          </div>
        )}
        {PASSWORD_REQUIREMENTS.map((req, idx) => {
          const passed = formData.password ? req.test(formData.password) : false;
          return (
            <p
              key={idx}
              className={cn(
                "text-xs flex items-center gap-2",
                passed ? "text-green-400/90" : "text-white/50"
              )}
            >
              {passed ? "✓" : "○"} {req.label}
            </p>
          );
        })}
        {errors.password && (
          <p className={ERROR_MESSAGE_CLASS}>{errors.password}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-white/90 font-medium">
          Confirmar nova senha
        </Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Repita a senha"
            value={formData.confirmPassword}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                confirmPassword: e.target.value,
              }))
            }
            className={cn(
              INPUT_CLASS,
              "pr-12",
              errors.confirmPassword && INPUT_ERROR_CLASS
            )}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
            aria-label={
              showConfirmPassword ? "Ocultar senha" : "Mostrar senha"
            }
          >
            {showConfirmPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className={ERROR_MESSAGE_CLASS}>{errors.confirmPassword}</p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full h-12 md:h-14 text-base md:text-lg font-semibold bg-[#C57A3A] hover:bg-[#C57A3A]/90 text-white shadow-lg shadow-[#C57A3A]/30"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Salvando...
          </>
        ) : (
          "Redefinir senha"
        )}
      </Button>
    </form>
  );
}
