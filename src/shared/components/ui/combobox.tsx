import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from './utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command';

export type ComboOption = { value: string; label: string };

// Selector con BÚSQUEDA por escritura. Reemplaza a un <select> nativo cuando la
// lista puede ser grande (p. ej. miles de alumnos): el usuario teclea para filtrar.
// Filtra en cliente; para listas enormes (decenas de miles) conviene una búsqueda
// server-side, pero esto resuelve el caso de "no se puede filtrar".
export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Selecciona…',
  searchPlaceholder = 'Buscar…',
  emptyText = 'Sin resultados',
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-brand-100 bg-white px-3 text-sm text-brand-900 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-700/25 focus:border-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className={cn('truncate text-left', !selected && 'text-slate-400')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[14rem] p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label}__${opt.value}`}
                  onSelect={() => { onChange(opt.value); setOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
