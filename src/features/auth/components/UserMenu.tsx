"use client";

import { useAuth } from "../hooks/useAuth";
import { LogOut, User } from "lucide-react";

export function UserMenu() {
  const { user, isLoading, signOut } = useAuth();

  if (isLoading) {
    return <div className="w-32 h-9 bg-zinc-900/50 rounded-full border border-zinc-800 animate-pulse" />;
  }

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800">
        <div className="w-6 h-6 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
          <User size={12} className="text-teal-400" />
        </div>
        <span className="text-zinc-300 text-xs font-mono truncate max-w-[160px]">{user.email}</span>
      </div>
      <button
        onClick={signOut}
        className="flex items-center gap-1.5 bg-zinc-900/50 px-3 py-1.5 rounded-full border border-zinc-800 hover:border-red-500/40 hover:bg-red-500/5 text-zinc-500 hover:text-red-400 transition-all text-xs font-medium"
      >
        <LogOut size={12} />
        Salir
      </button>
    </div>
  );
}
