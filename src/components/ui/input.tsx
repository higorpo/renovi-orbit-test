/**
 * Input Component - Micro-Fase 5.1: Inputs Mobile-Friendly
 * 
 * Input otimizado para mobile com:
 * - inputMode automático por tipo
 * - autocomplete adequado
 * - Touch targets maiores (min 44px)
 * - Estados de erro claros
 * - Validação visual
 * 
 * PADRÃO BIG TECH: Inputs devem ser fáceis de usar em dispositivos touch
 */
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Mapeamento de tipo → inputMode para teclado correto em mobile
 */
const INPUT_MODE_MAP: Record<string, React.HTMLAttributes<HTMLInputElement>['inputMode']> = {
  tel: 'tel',
  email: 'email',
  url: 'url',
  number: 'numeric',
  search: 'search',
};

/**
 * Mapeamento de tipo → autocomplete sugerido
 */
const AUTOCOMPLETE_MAP: Record<string, string> = {
  email: 'email',
  tel: 'tel',
  password: 'current-password',
  'new-password': 'new-password',
  name: 'name',
  'given-name': 'given-name',
  'family-name': 'family-name',
  url: 'url',
};

export interface InputProps extends React.ComponentProps<"input"> {
  /** Estado de erro */
  error?: boolean;
  /** Mensagem de erro (exibida abaixo do input se fornecida) */
  errorMessage?: string;
  /** Ícone à esquerda */
  leftIcon?: React.ReactNode;
  /** Ícone à direita */
  rightIcon?: React.ReactNode;
  /** Variante de tamanho */
  size?: 'sm' | 'default' | 'lg';
  /** Força inputMode específico (sobrescreve automático) */
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className, 
    type = 'text', 
    error, 
    errorMessage,
    leftIcon,
    rightIcon,
    size = 'default',
    inputMode: forcedInputMode,
    autoComplete,
    ...props 
  }, ref) => {
    // Determina inputMode automático se não forçado
    const resolvedInputMode = forcedInputMode || INPUT_MODE_MAP[type || 'text'];
    
    // Determina autocomplete se não fornecido
    const resolvedAutoComplete = autoComplete || AUTOCOMPLETE_MAP[type || ''];

    // Classes de tamanho
    const sizeClasses = {
      sm: 'h-9 text-sm px-2.5',
      default: 'h-11 sm:h-10 text-base px-3', // Mobile: 44px, Desktop: 40px
      lg: 'h-12 text-base px-4',
    };

    const hasLeftIcon = Boolean(leftIcon);
    const hasRightIcon = Boolean(rightIcon);

    const inputElement = (
      <input
        type={type}
        inputMode={resolvedInputMode}
        autoComplete={resolvedAutoComplete}
        className={cn(
          // Base styles
          "flex w-full rounded-md border bg-background ring-offset-background transition-colors",
          // Tamanho
          sizeClasses[size],
          // Padding extra para ícones
          hasLeftIcon && "pl-10",
          hasRightIcon && "pr-10",
          // File input styles
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          // Placeholder
          "placeholder:text-muted-foreground",
          // Focus - ring mais visível em mobile
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Responsive text
          "md:text-sm",
          // Touch-friendly
          "touch-manipulation",
          // Estado normal vs erro
          error
            ? "border-destructive focus-visible:ring-destructive placeholder:text-destructive/60 bg-destructive/5"
            : "border-input hover:border-input/80",
          className,
        )}
        ref={ref}
        aria-invalid={error ? "true" : undefined}
        {...props}
      />
    );

    // Se tem ícones, wrappa em container
    if (hasLeftIcon || hasRightIcon || errorMessage) {
      return (
        <div className="relative w-full">
          {/* Ícone esquerdo */}
          {hasLeftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {leftIcon}
            </div>
          )}
          
          {inputElement}
          
          {/* Ícone direito */}
          {hasRightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {rightIcon}
            </div>
          )}
          
          {/* Mensagem de erro */}
          {error && errorMessage && (
            <p className="mt-1.5 text-xs text-destructive" role="alert">
              {errorMessage}
            </p>
          )}
        </div>
      );
    }

    return inputElement;
  },
);
Input.displayName = "Input";

export { Input };
