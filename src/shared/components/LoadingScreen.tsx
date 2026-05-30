export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 bg-[radial-gradient(circle_at_top_left,rgba(245,166,35,0.16),transparent_30%),linear-gradient(135deg,#eef3fb_0%,#ffffff_60%)] flex flex-col items-center justify-center">
      <div className="text-center space-y-7">
        {/* Logo */}
        <div className="mx-auto w-20 h-20 rounded-2xl border border-gold-200 bg-white shadow-[0_18px_45px_rgba(26,45,107,0.14)] flex items-center justify-center overflow-hidden">
          <img
            src="/images/isologo.png"
            alt="Logo UNIVO Check-Health"
            className="w-16 h-16 object-contain"
          />
        </div>

        {/* Texto */}
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold text-brand-900 tracking-wide">
            UNIVO Check-Health
          </h1>
          <p className="text-sm text-brand-600 tracking-wide">
            Verificando identidad…
          </p>
        </div>

        {/* Indicador de carga */}
        <div className="flex justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gold-500 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-brand-700 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
