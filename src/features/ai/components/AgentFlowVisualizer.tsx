"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRagStore } from "../store/rag-store";
import { User, GitMerge, Database, Cpu, ShieldAlert, CheckCircle2 } from "lucide-react";

export function AgentFlowVisualizer() {
  const activeAgent = useRagStore(s => s.activeAgent);

  const Node = ({ id, label, icon: Icon, isActive, isPast }: any) => {
    const highlighted = isActive || isPast;
    return (
      <div className="relative flex flex-col items-center">
        <motion.div 
          animate={{
            scale: isActive ? [1, 1.1, 1] : 1,
            boxShadow: isActive ? "0px 0px 20px rgba(45,212,191,0.4)" : "0px 0px 0px rgba(0,0,0,0)"
          }}
          transition={{ repeat: isActive ? Infinity : 0, duration: 2 }}
          className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-2xl border-2 transition-all duration-500 z-10 
            ${isActive ? "bg-teal-500/20 border-teal-400 text-teal-400" : 
              isPast ? "bg-emerald-900/30 border-emerald-500/50 text-emerald-400" : 
              "bg-zinc-900/80 border-zinc-800 text-zinc-600"}`}
        >
          <Icon strokeWidth={isActive ? 2.5 : 1.5} size={22} className="relative z-10" />
          {isPast && !isActive && (
            <div className="absolute -top-1 -right-1 bg-black rounded-full">
              <CheckCircle2 size={14} className="text-emerald-500" />
            </div>
          )}
        </motion.div>
        
        <div className="absolute top-16 text-center w-24">
           <span className={`text-[10px] md:text-xs font-mono font-bold tracking-tight transition-colors duration-500
             ${isActive ? "text-teal-400" : isPast ? "text-emerald-500/80" : "text-zinc-600"}`}>
             {label}
           </span>
        </div>
      </div>
    );
  };

  const Edge = ({ active }: { active: boolean }) => (
    <div className="flex-1 h-0.5 mx-2 relative top-[-10px] md:top-[-16px] z-0 overflow-hidden bg-zinc-800/50 rounded-full">
       <motion.div 
         initial={{ width: "0%" }}
         animate={{ width: active ? "100%" : "0%" }}
         transition={{ duration: 0.5, ease: "easeInOut" }}
         className="h-full bg-gradient-to-r from-teal-500/50 to-teal-400 drop-shadow-[0_0_8px_rgba(45,212,191,0.8)]"
       />
    </div>
  );

  return (
    <div className="bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 py-10 shadow-2xl relative overflow-hidden flex flex-col justify-center">
       <div className="absolute -top-10 -left-10 w-40 h-40 bg-teal-500/5 rounded-full blur-[60px] pointer-events-none" />
       
       <div className="flex justify-between items-center mb-10 px-2 lg:px-4">
         <div>
            <h3 className="text-lg md:text-xl font-bold text-white tracking-tight flex items-center gap-2">
               Motor Multi-Agente
               {activeAgent !== 'idle' && <span className="flex h-2 w-2 rounded-full bg-teal-400 animate-pulse" />}
            </h3>
            <p className="text-xs text-zinc-500 mt-1 font-mono">Arquitectura Neural en Tiempo Real</p>
         </div>
       </div>

       <div className="flex items-center justify-between w-full px-2 pb-6">
          <Node id="user" label="Ingesta" icon={User}
            isActive={activeAgent === 'user'}
            isPast={activeAgent !== 'idle'} />
          <Edge active={['semantic-router','investigator','indexing','redactor','auditor'].includes(activeAgent)} />

          <Node id="semantic-router" label="Router" icon={GitMerge}
            isActive={activeAgent === 'semantic-router'}
            isPast={['investigator','indexing','redactor','auditor'].includes(activeAgent)} />
          <Edge active={['investigator','indexing','redactor','auditor'].includes(activeAgent)} />

          <Node id="investigator" label="RAG Engine" icon={Database}
            isActive={activeAgent === 'investigator' || activeAgent === 'indexing'}
            isPast={['redactor','auditor'].includes(activeAgent)} />
          <Edge active={['redactor','auditor'].includes(activeAgent)} />

          <Node id="redactor" label="Redactor" icon={Cpu}
            isActive={activeAgent === 'redactor'}
            isPast={activeAgent === 'auditor'} />
          <Edge active={activeAgent === 'auditor'} />

          <Node id="auditor" label="Auditor" icon={ShieldAlert}
            isActive={activeAgent === 'auditor'}
            isPast={false} />
       </div>

       {/* Dynamic Explanation Panel */}
       <div className="mt-8 pt-4 border-t border-zinc-800/80 min-h-[72px]">
          <AnimatePresence mode="wait">
             <motion.div
                key={activeAgent}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-sm text-zinc-400 leading-relaxed"
             >
                {activeAgent === 'idle' && (
                  <p><b className="text-white">Flujo Inactivo:</b> Esperando consulta o documento. Las capas de IA están en modo lectura.</p>
                )}
                {activeAgent === 'user' && (
                  <p><b className="text-teal-400">Recibiendo documento:</b> El sistema recibe el archivo y lo prepara para procesamiento.</p>
                )}
                {activeAgent === 'semantic-router' && (
                  <p><b className="text-teal-400">Semantic Router:</b> Evalúa si la consulta requiere recuperación de documentos o es contexto conversacional.</p>
                )}
                {(activeAgent === 'investigator' || activeAgent === 'indexing') && (
                  <p><b className="text-teal-400">RAG Engine:</b> {activeAgent === 'indexing' ? 'Segmentando texto, generando embeddings e indexando en la base vectorial...' : 'Extrae y re-rankea fragmentos del documento por cercanía semántica (Cosine Similarity).'}</p>
                )}
                {activeAgent === 'redactor' && (
                  <p><b className="text-teal-400">Redactor:</b> Claude procesa los fragmentos recuperados y estructura una respuesta coherente.</p>
                )}
                {activeAgent === 'auditor' && (
                  <p><b className="text-teal-400">Auditor Anti-Alucinación:</b> Valida cada cita contra el documento original. 0% alucinaciones garantizado.</p>
                )}
             </motion.div>
          </AnimatePresence>
       </div>
    </div>
  );
}
