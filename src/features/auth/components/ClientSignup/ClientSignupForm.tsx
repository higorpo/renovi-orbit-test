import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Users,
  Shield,
  Wallet,
  Check,
  X,
  Mail,
  Inbox,
  Link2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PASSWORD_REQUIREMENTS,
} from "../../utils/passwordPolicy";
import type { PasswordStrengthDisplay } from "../../utils/passwordPolicy";
import type { ClientSignupFormData } from "../../types/clientSignup.validation";
import { STEPS } from "../../hooks/useClientSignupForm";

const INPUT_CLASS =
  "bg-white/10 border-white/30 text-white placeholder:text-white/50 h-12 focus:border-[#2563EB]";
const INPUT_ERROR_CLASS = "border-red-400";
const ERROR_MESSAGE_CLASS = "text-sm text-red-400";

const CONFIRM_STEPS = [
  {
    icon: Mail,
    title: "Acesse sua caixa de entrada",
    description: "Abra o email que você utilizou no cadastro.",
  },
  {
    icon: Inbox,
    title: "Procure o email da Prestway",
    description:
      "Assunto algo como \"Confirme seu email\" ou \"Confirmar cadastro\".",
  },
  {
    icon: Link2,
    title: "Clique no link de confirmação",
    description: "Um único clique confirma sua conta e libera o login.",
  },
] as const;

export interface ClientSignupFormProps {
  currentStep: number;
  formData: ClientSignupFormData;
  setFormData: React.Dispatch<React.SetStateAction<ClientSignupFormData>>;
  errors: Record<string, string>;
  submitting: boolean;
  signupSuccess?: boolean;
  registeredEmail?: string;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (value: boolean) => void;
  passwordDisplay: PasswordStrengthDisplay;
  onNext: () => void;
  onBack: () => void;
  onSubmit: () => void;
  onGoogleSignup: () => void;
}

export function ClientSignupForm({
  currentStep,
  formData,
  setFormData,
  errors,
  submitting,
  signupSuccess = false,
  registeredEmail = "",
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  passwordDisplay,
  onNext,
  onBack,
  onSubmit,
  onGoogleSignup: _onGoogleSignup,
}: ClientSignupFormProps) {
  if (signupSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F97316]/20">
            <CheckCircle2 className="h-8 w-8 text-[#F97316]" aria-hidden />
          </div>
          <h2 className="text-xl font-semibold text-white">
            Cadastro realizado com sucesso!
          </h2>
          <p className="mt-2 text-sm text-white/80">
            Enviamos um link de confirmação para{" "}
            <span className="font-medium text-white">{registeredEmail}</span>.
            Confirme sua conta para fazer login e usar a plataforma.
          </p>
        </div>

        <div className="rounded-xl bg-white/5 p-4">
          <h3 className="mb-3 text-sm font-semibold text-white/90">
            Como confirmar sua conta
          </h3>
          <ol className="space-y-4">
            {CONFIRM_STEPS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <li key={idx} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F97316]/20 text-[#F97316]">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {idx + 1}. {step.title}
                    </p>
                    <p className="mt-0.5 text-xs text-white/70">
                      {step.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden />
          <div>
            <p className="text-sm font-medium text-amber-200">
              Não encontrou o email?
            </p>
            <p className="mt-1 text-xs text-white/80">
              Verifique a pasta de <strong>spam</strong> ou{" "}
              <strong>lixo eletrônico</strong>. O email pode levar alguns minutos
              para chegar. Se ainda não aparecer, entre em contato conosco.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      {/* Progress steps */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((_, idx) => (
          <div key={idx} className="flex items-center">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                idx < currentStep && "bg-[#F97316] text-white",
                idx === currentStep && "bg-white text-[#2563EB]",
                idx > currentStep && "bg-white/20 text-white/50"
              )}
            >
              {idx < currentStep ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                idx + 1
              )}
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-8 md:w-12 h-1 mx-1 rounded",
                  idx < currentStep ? "bg-[#F97316]" : "bg-white/20"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 0: Basic info */}
        {currentStep === 0 && (
          <motion.div
            key="step0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-white/90 font-medium">
              Nome Completo *
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Seu nome completo"
              value={formData.fullName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, fullName: e.target.value }))
              }
              className={cn(INPUT_CLASS, errors.fullName && INPUT_ERROR_CLASS)}
            />
            {errors.fullName && (
              <p className={ERROR_MESSAGE_CLASS}>{errors.fullName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/90 font-medium">
              Email *
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, email: e.target.value }))
              }
              className={cn(INPUT_CLASS, errors.email && INPUT_ERROR_CLASS)}
            />
            {errors.email && (
              <p className={ERROR_MESSAGE_CLASS}>{errors.email}</p>
            )}
          </div>

          <Button
            type="button"
            onClick={onNext}
            className="w-full h-12 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold !mt-8"
          >
            Continuar
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          </motion.div>
        )}

        {/* Step 1: Password */}
        {currentStep === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/90 font-medium">
              Senha *
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
              <div className="space-y-2">
                <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      passwordDisplay.colorClass
                    )}
                    style={{ width: `${passwordDisplay.widthPercent}%` }}
                  />
                </div>
                <p className="text-xs text-white/50">
                  {passwordDisplay.label}
                </p>
              </div>
            )}
            <div className="space-y-1 mt-2">
              {PASSWORD_REQUIREMENTS.map((req, idx) => {
                const passed = formData.password
                  ? req.test(formData.password)
                  : false;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-xs"
                  >
                    {passed ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <X className="h-3 w-3 text-white/30" />
                    )}
                    <span
                      className={
                        passed ? "text-green-400" : "text-white/50"
                      }
                    >
                      {req.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {errors.password && (
              <p className={ERROR_MESSAGE_CLASS}>{errors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-white/90 font-medium"
            >
              Confirmar Senha *
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Digite a senha novamente"
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
                onClick={() =>
                  setShowConfirmPassword(!showConfirmPassword)
                }
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
              <p className={ERROR_MESSAGE_CLASS}>
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onBack}
              variant="outline"
              className="flex-1 h-12 bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Voltar
            </Button>
            <Button
              type="button"
              onClick={onNext}
              className="flex-1 h-12 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold"
            >
              Continuar
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
          </motion.div>
        )}

        {/* Step 2: Confirmation */}
        {currentStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
          <div className="bg-white/5 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-white">
              Com sua conta você terá:
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Users className="h-4 w-4 text-[#F97316]" />
                <span>Acesso a profissionais verificados</span>
              </div>
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Shield className="h-4 w-4 text-[#F97316]" />
                <span>Proteção Escrow em todos os pagamentos</span>
              </div>
              <div className="flex items-center gap-2 text-white/80 text-sm">
                <Wallet className="h-4 w-4 text-[#F97316]" />
                <span>Orçamentos gratuitos e sem compromisso</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <p className="text-white/60 text-sm">Nome</p>
            <p className="text-white font-medium">{formData.fullName}</p>
            <p className="text-white/60 text-sm mt-3">Email</p>
            <p className="text-white font-medium">{formData.email}</p>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="terms"
              checked={formData.termsAccepted}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  termsAccepted: checked === true,
                }))
              }
              className="mt-1 border-white/30 data-[state=checked]:bg-[#2563EB] data-[state=checked]:border-[#2563EB]"
            />
            <label
              htmlFor="terms"
              className="text-sm text-white/70 cursor-pointer"
            >
              Li e aceito os{" "}
              <a
                href={`${(import.meta.env.VITE_MAIN_SITE_URL ?? "").replace(/\/$/, "")}/juridico/termos-de-uso`}
                className="text-[#F97316] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Termos de Uso
              </a>{" "}
              e a{" "}
              <a
                href={`${(import.meta.env.VITE_MAIN_SITE_URL ?? "").replace(/\/$/, "")}/juridico/politica-de-privacidade`}
                className="text-[#F97316] hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Política de Privacidade
              </a>
            </label>
          </div>
          {errors.termsAccepted && (
            <p className={ERROR_MESSAGE_CLASS}>{errors.termsAccepted}</p>
          )}
          {errors.recaptcha && (
            <p className={ERROR_MESSAGE_CLASS}>{errors.recaptcha}</p>
          )}

          <p className="text-xs text-white/60">
            Esta ação é protegida por reCAPTCHA.
          </p>

          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onBack}
              variant="outline"
              className="flex-1 h-12 bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Voltar
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={submitting || !formData.termsAccepted}
              className="flex-1 h-12 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar minha conta"
              )}
            </Button>
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
