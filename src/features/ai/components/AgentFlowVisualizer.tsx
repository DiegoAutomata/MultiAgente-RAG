"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRagStore } from "../store/rag-store";
import { User, GitMerge, Database, Cpu, ShieldAlert, CheckCircle2 } from "lucide-react";

const AGENTS = [
  { id: "user",            label: "Ingesta",   Icon: User },
  { id: "semantic-router", label: "Router",    Icon: GitMerge },
  { id: "investigator",    label: "RAG",       Icon: Database },
  { id: "redactor",        label: "Redactor",  Icon: Cpu },
  { id: "auditor",         label: "Auditor",   Icon: ShieldAlert },
] as const;

const PAST_MAP: Record<string, string[]> = {
  "idle":            [],
  "user":            [],
  "semantic-router": ["user"],
  "investigator":    ["user","semantic-router"],
  "indexing":        ["user","semantic-router"],
  "redactor":        ["user","semantic-router","investigator"],
  "auditor":         ["user","semantic-router","investigator","redactor"],
};

const STATUS_TEXT: Record<string, { label: string; desc: string }> = {
  idle:             { label: "Inactivo",     desc: "Esperando consulta o documento." },
  user:             { label: "Recibiendo",   desc: "Preparando el documento para procesamiento." },
  "semantic-router":{ label: "Enrutando",    desc: "Clasificando intención de la consulta." },
  investigator:     { label: "Buscando",     desc: "Recuperando fragmentos por similitud semántica." },
  indexing:         { label: "Indexando",    desc: "Generando embeddings e indexando en BD vectorial." },
  redactor:         { label: "Redactando",   desc: "Claude estructura la respuesta con el contexto." },
  auditor:          { label: "Auditando",    desc: "Validando contra el documento. 0% alucinaciones." },
};

export function AgentFlowVisualizer() {
  const activeAgent = useRagStore(s => s.activeAgent);
  const past = PAST_MAP[activeAgent] ?? [];
  const status = STATUS_TEXT[activeAgent] ?? STATUS_TEXT.idle;
  const isActive = activeAgent !== "idle";

  return (
    <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 relative overflow-hidden">
      {/* Subtle glow */}
      {isActive && (
        <div className="absolute -top-6 -right-6 w-28 h-28 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs font-bold text-white tracking-tight flex items-center gap-1.5 uppercase font-mono">
            Motor Multi-Agente
            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse inline-block" />}
          </h3>
        </div>
        <AnimatePresence mode="wait">
          <motion.span
            key={activeAgent}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
              isActive
                ? "text-teal-400 bg-teal-500/10 border-teal-500/20"
                : "text-zinc-600 bg-zinc-900 border-zinc-800"
            }`}
          >
            {status.label}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Pipeline nodes */}
      <div className="flex items-center justify-between w-full">
        {AGENTS.map(({ id, label, Icon }, idx) => {
          const isNodeActive = activeAgent === id || (id === "investigator" && activeAgent === "indexing");
          const isPast = past.includes(id);

          return (
            <div key={id} className="flex items-center flex-1 last:flex-none">
              {/* Node */}
              <div className="flex flex-col items-center gap-1.5 relative">
                <motion.div
                  animate={{
                    scale: isNodeActive ? [1, 1.08, 1] : 1,
                    boxShadow: isNodeActive
                      ? "0 0 16px rgba(45,212,191,0.5)"
                      : "0 0 0 rgba(0,0,0,0)",
                  }}
                  transition={{ repeat: isNodeActive ? Infinity : 0, duration: 1.8 }}
                  className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all duration-400 ${
                    isNodeActive
                      ? "bg-teal-500/20 border-teal-400 text-teal-400"
                      : isPast
                      ? "bg-emerald-900/20 border-emerald-700/40 text-emerald-500"
                      : "bg-zinc-900 border-zinc-800 text-zinc-600"
                  }`}
                >
                  <Icon size={16} strokeWidth={isNodeActive ? 2.5 : 1.5} />
                  {isPast && !isNodeActive && (
                    <div className="absolute -top-1 -right-1 bg-[#080a0f] rounded-full">
                      <CheckCircle2 size={11} className="text-emerald-500" />
                    </div>
                  )}
                </motion.div>
                <span className={`text-[9px] font-mono font-bold tracking-tight transition-colors ${
                  isNodeActive ? "text-teal-400" : isPast ? "text-emerald-600" : "text-zinc-700"
                }`}>
                  {label}
                </span>
              </div>

              {/* Edge connector (not after last node) */}
              {idx < AGENTS.length - 1 && (
                <div className="flex-1 h-px mx-1.5 relative -mt-4 overflow-hidden bg-zinc-800/60 rounded-full">
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{ width: past.includes(AGENTS[idx + 1].id) || isNodeActive ? "100%" : "0%" }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                    className="h-full bg-gradient-to-r from-teal-600/60 to-teal-400"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status description */}
      <AnimatePresence mode="wait">
        <motion.p
          key={activeAgent}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="text-[10px] text-zinc-500 mt-3 font-medium leading-relaxed border-t border-white/5 pt-3"
        >
          <span className={isActive ? "text-teal-400" : "text-zinc-600"}>{status.label}: </span>
          {status.desc}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
