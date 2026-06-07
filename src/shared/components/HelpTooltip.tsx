import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/components/ui/popover';

// Botón "?" de ayuda contextual. Úsalo junto a títulos o campos para explicar
// para qué sirve algo y cómo se usa, sin saturar la interfaz.
// Usa un Popover (no un tooltip de hover) para que funcione con TAP en móvil y
// tablet, y para que respete los bordes de la pantalla (no se desborda).
// Ej: <HelpTooltip text="Pega aquí el carné institucional del alumno." />
export function HelpTooltip({
  text,
  side = 'top',
  className = '',
}: {
  text: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Ayuda"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center justify-center text-brand-400 hover:text-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-700/30 rounded-full ${className}`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        collisionPadding={8}
        onClick={(e) => e.stopPropagation()}
        className="w-auto max-w-[min(18rem,calc(100vw-2rem))] p-3 text-left text-sm leading-relaxed"
      >
        {text}
      </PopoverContent>
    </Popover>
  );
}
