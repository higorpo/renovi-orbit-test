import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  filterBrazilianBanks,
  findBrazilianBankByCode,
  formatBankLabel,
} from "../constants/brazilianBanks";
import { useBrazilianBanks } from "../hooks/useBrazilianBanks";

export type BankPickerProps = {
  value: string;
  onChange: (institutionCode: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-invalid"?: boolean;
};

export function BankPicker({
  value,
  onChange,
  disabled,
  id,
  "aria-invalid": ariaInvalid,
}: BankPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const banksQuery = useBrazilianBanks();
  const banks = banksQuery.data ?? [];

  const selected = findBrazilianBankByCode(value, banks);
  const options = useMemo(
    () => (search.trim() ? filterBrazilianBanks(search, banks) : [...banks]),
    [banks, search],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          disabled={disabled}
          className={cn(
            "flex min-h-11 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-base font-normal ring-offset-background transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="truncate">
            {selected ? formatBankLabel(selected) : "Selecione o banco"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nome ou código…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Nenhum banco encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((bank) => {
                const isSelected = bank.code === value;
                return (
                  <CommandItem
                    key={bank.code}
                    value={`${bank.code} ${bank.name}`}
                    onSelect={() => {
                      onChange(bank.code);
                      setOpen(false);
                      setSearch("");
                    }}
                    className="min-h-11 cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden
                    />
                    {formatBankLabel(bank)}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
