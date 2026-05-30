export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center">
      <div className="text-center space-y-7">
        {/* Logo */}
        <div className="mx-auto w-20 h-20 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center justify-center overflow-hidden">
          <img
            src="/images/isologo.png"
            alt="Logo UNIVO Check-Health"
            className="w-16 h-16 object-contain"
          />
        </div>

        {/* Texto */}
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-slate-900 tracking-wide">
            UNIVO Check-Health
          </h1>
          <p className="text-sm text-slate-400 tracking-wide">
            Verificando identidad…
          </p>
        </div>

        {/* Indicador de carga */}
        <div className="flex justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-blue-300 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
