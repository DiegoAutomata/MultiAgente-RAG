"use client";

import { Brain, GitMerge, Search, Database, PenLine, ShieldCheck, BarChart3, Layers, User, Ruler, Lock, Ban } from "lucide-react";

export function ArchitectureDiagram() {
  return (
    <div className="w-full h-full bg-zinc-950 rounded-2xl p-5 font-mono select-none flex flex-col">
      {/* Title */}
      <h2 className="text-center text-[12px] font-black text-white uppercase tracking-[0.15em] mb-5 shrink-0">
        Corporate RAG · Multi-Agent System Architecture
      </h2>

      <div className="flex gap-3 flex-1 min-h-0">

        {/* === LEFT: Orchestrator + Router === */}
        <div className="flex flex-col gap-2.5 w-[190px] shrink-0">
          {/* User input */}
          <div className="flex items-center gap-2 border border-zinc-700 rounded-xl px-2.5 py-2 bg-zinc-900/60">
            <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
              <User size={10} className="text-zinc-300" />
            </div>
            <span className="text-[9px] text-zinc-400 font-bold">USUARIO</span>
          </div>

          {/* Arrow down */}
          <div className="flex flex-col items-center gap-0.5 self-center">
            <div className="w-px h-3 bg-zinc-600" />
            <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-zinc-600" />
          </div>

          {/* Orchestrator */}
          <div className="border border-orange-500/50 rounded-xl p-2.5 bg-orange-500/5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Brain size={11} className="text-orange-400 shrink-0" />
              <span className="text-[9px] font-black text-orange-400 uppercase tracking-wide">Orquestrador</span>
            </div>
            <p className="text-[8px] text-zinc-500 leading-relaxed">Gestor Central de Tareas</p>

            {/* Semantic Router inside */}
            <div className="mt-2 border border-orange-500/20 rounded-lg p-1.5 bg-orange-500/5">
              <div className="flex items-center gap-1 mb-0.5">
                <GitMerge size={9} className="text-amber-400" />
                <span className="text-[8px] font-bold text-amber-400">Router Semántico</span>
              </div>
              <p className="text-[7.5px] text-zinc-600">Clasifica la consulta · Haiku</p>
            </div>
          </div>

          {/* Arrow right → to RAG + arrow down → to Results */}
          <div className="flex flex-col items-center gap-0.5 self-center">
            <div className="w-px h-3 bg-zinc-600" />
            <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-zinc-600" />
          </div>

          {/* Results screen */}
          <div className="border border-purple-500/40 rounded-xl p-2.5 bg-purple-500/5">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 size={11} className="text-purple-400 shrink-0" />
              <span className="text-[9px] font-black text-purple-400 uppercase tracking-wide">Respuesta</span>
            </div>
            <p className="text-[8px] text-zinc-500">Texto · Gráficos · Datos</p>
          </div>
        </div>

        {/* === CENTER: RAG Engine + Multi-Agent Loop === */}
        <div className="flex-1 flex flex-col gap-2.5 min-w-0 min-h-0">

          {/* RAG ENGINE */}
          <div className="border border-blue-500/40 rounded-xl p-3 bg-blue-500/5 flex-1 flex flex-col justify-between">
            <p className="text-[8px] font-black text-blue-400 uppercase tracking-wider mb-2">RAG Engine · Motor de Recuperación</p>
            <div className="flex gap-2">
              {/* Investigator */}
              <div className="flex-1 border border-blue-500/20 rounded-lg p-2 bg-blue-500/5">
                <div className="flex items-center gap-1 mb-1">
                  <Search size={9} className="text-blue-300" />
                  <span className="text-[8px] font-bold text-blue-300">Agente Búsqueda</span>
                </div>
                <p className="text-[7.5px] text-zinc-600">Encuentra fragmentos relevantes</p>
              </div>
              {/* Embedding */}
              <div className="flex-1 border border-blue-500/20 rounded-lg p-2 bg-blue-500/5">
                <div className="flex items-center gap-1 mb-1">
                  <Layers size={9} className="text-sky-300" />
                  <span className="text-[8px] font-bold text-sky-300">Embedding</span>
                </div>
                <p className="text-[7.5px] text-zinc-600">Texto → Vectores 384-dim</p>
              </div>
            </div>
            {/* Hybrid search badge */}
            <div className="mt-2 flex items-center justify-center gap-1.5 border border-blue-500/15 rounded-lg py-1 bg-black/30">
              <Database size={8} className="text-blue-400" />
              <span className="text-[7.5px] text-blue-400 font-bold">Búsqueda Híbrida · BM25 + Cosine · RRF</span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-px h-2 bg-zinc-700" />
              <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-zinc-700" />
            </div>
          </div>

          {/* MULTI-AGENT LOOP */}
          <div className="border border-yellow-500/40 rounded-xl p-3 bg-yellow-500/5 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[8px] font-black text-yellow-400 uppercase tracking-wider">Multi-Agent Loop</p>
              <span className="text-[7px] text-zinc-600 border border-zinc-800 px-1.5 py-0.5 rounded-full">Max 2 intentos</span>
            </div>
            <div className="flex gap-2 items-center">
              {/* Writer */}
              <div className="flex-1 border border-yellow-500/20 rounded-lg p-2 bg-yellow-500/5">
                <div className="flex items-center gap-1 mb-1">
                  <PenLine size={9} className="text-yellow-300" />
                  <span className="text-[8px] font-bold text-yellow-300">Agente Escritor</span>
                </div>
                <p className="text-[7.5px] text-zinc-600">Claude Sonnet 4.6</p>
              </div>
              {/* Arrow */}
              <div className="flex items-center gap-0.5 shrink-0">
                <div className="h-px w-3 bg-zinc-700" />
                <div className="w-0 h-0 border-t-[3px] border-b-[3px] border-l-[4px] border-t-transparent border-b-transparent border-l-zinc-700" />
              </div>
              {/* Auditor */}
              <div className="flex-1 border border-yellow-500/20 rounded-lg p-2 bg-yellow-500/5">
                <div className="flex items-center gap-1 mb-1">
                  <ShieldCheck size={9} className="text-green-400" />
                  <span className="text-[8px] font-bold text-green-400">Verificación</span>
                </div>
                <p className="text-[7.5px] text-zinc-600">0% alucinaciones</p>
              </div>
            </div>
          </div>
        </div>

        {/* === RIGHT: Data Layer + Benefits === */}
        <div className="flex flex-col gap-2.5 w-[155px] shrink-0 h-full">

          {/* Data Layer */}
          <div className="border border-emerald-500/40 rounded-xl p-2.5 bg-emerald-500/5 flex-1 flex flex-col">
            <p className="text-[8px] font-black text-emerald-400 uppercase tracking-wider mb-2">Data Layer · Supabase</p>
            <div className="flex flex-col gap-1.5">
              <div className="border border-emerald-500/20 rounded-lg p-1.5 bg-black/30">
                <div className="flex items-center gap-1 mb-0.5">
                  <Database size={8} className="text-emerald-400" />
                  <span className="text-[7.5px] font-bold text-emerald-300">Vectores</span>
                </div>
                <p className="text-[7px] text-zinc-600">pgvector 384-dim</p>
              </div>
              <div className="border border-emerald-500/20 rounded-lg p-1.5 bg-black/30">
                <div className="flex items-center gap-1 mb-0.5">
                  <Layers size={8} className="text-emerald-400" />
                  <span className="text-[7.5px] font-bold text-emerald-300">Metadatos</span>
                </div>
                <p className="text-[7px] text-zinc-600">Docs + Chunks + RLS</p>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="border border-zinc-700/50 rounded-xl p-2.5 bg-zinc-900/40">
            <p className="text-[8px] font-black text-zinc-400 uppercase tracking-wider mb-1.5">Beneficios</p>
            <div className="flex flex-col gap-1">
              {[
                { Icon: Ban, label: "Alucinaciones", color: "text-green-500" },
                { Icon: Ruler, label: "Precisión exacta", color: "text-blue-400" },
                { Icon: Lock, label: "Auditable", color: "text-amber-400" },
              ].map(({ Icon, label, color }, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Icon size={8} className={color} />
                  <span className="text-[7.5px] text-zinc-500">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stack */}
          <div className="border border-zinc-800 rounded-xl p-2.5 bg-zinc-900/40">
            <p className="text-[8px] font-black text-zinc-500 uppercase tracking-wider mb-1.5">Stack</p>
            <div className="flex flex-col gap-0.5">
              {["Next.js 16", "React 19", "Sonnet 4.6 / Haiku", "Vercel AI SDK", "Supabase + pgvector"].map(s => (
                <span key={s} className="text-[7.5px] text-zinc-600">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
