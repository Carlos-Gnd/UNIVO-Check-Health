import { Stethoscope } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 flex flex-col items-center justify-center">
      <div className="text-center text-white space-y-8">
        <div className="relative mx-auto w-24 h-24">
          <div className="absolute inset-0 rounded-2xl bg-white/10 animate-ping" />
          <div className="absolute inset-0 rounded-2xl bg-white/5 animate-ping [animation-delay:300ms]" />
          <div className="relative w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-xl">
            <Stethoscope className="w-12 h-12 text-white drop-shadow" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-wide drop-shadow">
            UNIVO Check-Health
          </h1>
          <p className="text-blue-100 text-sm tracking-widest uppercase">
            Verificando identidad...
          </p>
        </div>

        <div className="flex justify-center gap-2.5">
          <span className="w-2.5 h-2.5 bg-white rounded-full animate-bounce [animation-delay:0ms] opacity-90" />
          <span className="w-2.5 h-2.5 bg-white rounded-full animate-bounce [animation-delay:160ms] opacity-90" />
          <span className="w-2.5 h-2.5 bg-white rounded-full animate-bounce [animation-delay:320ms] opacity-90" />
        </div>

        <p className="text-blue-200/70 text-xs max-w-xs mx-auto leading-relaxed">
          Conectando con el servidor de identidad institucional UNIVO
        </p>
      </div>
    </div>
  );
}
