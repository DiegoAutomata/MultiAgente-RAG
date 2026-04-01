import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-teal-900/30 rounded-[100%] blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center gap-6 max-w-md">
        {/* Badge */}
        <div className="flex items-center gap-2 bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-800">
          <div className="w-2 h-2 rounded-full bg-red-400" />
          <p className="text-red-400 text-xs font-mono tracking-widest uppercase font-bold">Error 404</p>
        </div>

        {/* Code */}
        <p className="text-8xl font-black text-white tracking-tighter">404</p>

        {/* Message */}
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Página no encontrada</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            La ruta que buscas no existe en este sistema. Vuelve al auditor para continuar tu análisis.
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/"
          className="mt-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors text-sm"
        >
          Volver al Auditor
        </Link>
      </div>
    </main>
  );
}
