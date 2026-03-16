import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const PLACEHOLDER =
  "Buscar serviço... Ex: eletricista, pintura, banheiro";

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SearchBar({ value, onChange, disabled }: SearchBarProps) {
  const id = useId();
  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id={id}
        type="search"
        placeholder={PLACEHOLDER}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="pl-9"
        autoComplete="off"
        aria-label="Buscar serviço"
      />
    </div>
  );
}
