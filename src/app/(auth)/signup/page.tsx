"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, UserPlus, CheckCircle } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      setSuccess(true);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-teal-900/30 rounded-[100%] blur-[120px] -z-10 pointer-events-none" />

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <p className="text-teal-400 text-xs font-mono tracking-widest uppercase font-bold">Enterprise RAG Auditor</p>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Crear Cuenta</h1>
          <p className="text-zinc-500 text-sm mt-2">Tu espacio de auditoría IA privado</p>
        </div>

        <div className="bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-8 shadow-2xl">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <CheckCircle className="text-teal-400" size={48} />
              <h2 className="text-white font-bold text-lg">¡Cuenta creada!</h2>
              <p className="text-zinc-400 text-sm">
                Te enviamos un correo de confirmación. Revisa tu bandeja de entrada y confirma tu email para acceder.
              </p>
              <Link
                href="/login"
                className="mt-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors text-sm"
              >
                Ir al Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-zinc-400 font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="tu@empresa.com"
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-teal-500/60 transition-colors text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-zinc-400 font-medium">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-teal-500/60 transition-colors text-sm"
                />
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <><Loader2 size={18} className="animate-spin" /> Creando cuenta...</>
                ) : (
                  <><UserPlus size={18} /> Crear Cuenta</>
                )}
              </button>
            </form>
          )}

          {!success && (
            <p className="text-center text-zinc-600 text-sm mt-6">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="text-teal-400 hover:text-teal-300 transition-colors font-medium">
                Inicia sesión
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
