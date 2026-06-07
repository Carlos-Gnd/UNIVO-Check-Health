import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="rounded-xl bg-gradient-to-r from-brand-700 via-brand-800 to-brand-900 p-5 shadow-[0_4px_20px_rgba(10,17,40,0.28)] border border-gold-400/15">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-11 rounded-full bg-gold-400 shrink-0" />
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            {description && <p className="text-sm text-brand-100/70 mt-0.5">{description}</p>}
          </div>
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}
