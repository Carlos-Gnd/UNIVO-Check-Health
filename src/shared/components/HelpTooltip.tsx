import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';

// Botón "?" de ayuda contextual. Úsalo junto a títulos o campos para explicar
// para qué sirve algo y cómo se usa, sin saturar la interfaz.
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
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Ayuda"
          className={`inline-flex items-center justify-center text-brand-400 hover:text-brand-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-700/30 rounded-full ${className}`}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-left leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
