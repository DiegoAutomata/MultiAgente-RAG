// @ts-nocheck
"use client";

import { useChat } from "@ai-sdk/react";
import { Bot, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GenerativeChart } from "./GenerativeChart";
import { useRagStore } from "../store/rag-store";
import { useEffect, useRef, useState } from "react";

export function Chat() {
  const { messages, isLoading, error, sendMessage } = useChat({
    api: "/api/chat",
    maxSteps: 5 
  });
  const [input, setInput] = useState("");

  const setActiveAgent = useRagStore(s => s.setActiveAgent);
  const previousLoading = useRef(isLoading);

  useEffect(() => {
    if (!isLoading) {
       if (previousLoading.current) {
          setActiveAgent('auditor');
          setTimeout(() => setActiveAgent('idle'), 1500);
       } else {
          setActiveAgent('idle');
       }
       previousLoading.current = isLoading;
       return;
    }
    
    previousLoading.current = isLoading;
    const lastMsg = messages[messages.length - 1];
    
    if (lastMsg?.role === 'user' || !lastMsg) {
      setActiveAgent('semantic-router');
    } else if (lastMsg?.toolInvocations?.length) {
      const activeTool = lastMsg.toolInvocations.find(t => t.state === 'call');
      if (activeTool) {
        if (activeTool.toolName === 'investigate_database') setActiveAgent('investigator');
        if (activeTool.toolName === 'generate_chart') setActiveAgent('redactor');
      } else {
         setActiveAgent('redactor'); 
      }
    } else {
      setActiveAgent('redactor');
    }
  }, [messages, isLoading, setActiveAgent]);

  // Infer the exact types from useChat directly to bypass AI SDK module resolution issues
  type LocalMessage = typeof messages[0];
  type LocalToolInvocation = NonNullable<LocalMessage['toolInvocations']>[0];

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto h-[80vh] bg-zinc-950 text-white rounded-3xl shadow-2xl border border-zinc-900 shadow-teal-900/10 overflow-hidden relative">
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center mt-4">
             <div className="w-16 h-16 bg-teal-500/10 rounded-2xl flex items-center justify-center border border-teal-500/20 mb-6 backdrop-blur-md shadow-[0_0_30px_rgba(20,184,166,0.15)]">
                 <Bot size={32} className="text-teal-400" />
             </div>
             <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Enterprise RAG Auditor</h2>
             <p className="text-zinc-400 max-w-sm text-sm">Auditoría inteligente sobre repositorio B2B. Escribe tu primera consulta abajo para iniciar.</p>
          </div>
        )}

        {messages.map((m: LocalMessage) => (
          <div key={m.id} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role !== 'user' && (
              <div className="w-10 h-10 shrink-0 rounded-full bg-teal-500/20 flex items-center justify-center border border-teal-500/50 mt-1">
                <Bot size={20} className="text-teal-400" />
              </div>
            )}
            <div className={`flex flex-col gap-3 min-w-[50%] max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              
              {/* Message text */}
              {m.content && (
                <div className={`p-4 rounded-2xl text-[15px] ${m.role === 'user' ? 'bg-zinc-800 text-zinc-100 rounded-tr-sm' : 'bg-transparent text-zinc-300'}`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                </div>
              )}

              {/* Tool Invocations (Thought Process and Generative UI) */}
              <AnimatePresence>
                {m.toolInvocations?.map((tool: LocalToolInvocation) => {
                  if (tool.state === 'call') {
                     // 1. Thought Process Animation (While executing)
                     let label = "Analizando sistema...";
                     if (tool.toolName === 'investigate_database') label = "🔍 Investigador consultando la base vectorial corporativa...";
                     if (tool.toolName === 'generate_chart') label = "📊 Generando UI Analítica interactiva...";
                     if (tool.toolName === 'audit_content') label = "👮‍♂️ Auditor verificando veracidad de citas...";

                     return (
                       <motion.div 
                         key={tool.toolCallId}
                         initial={{ opacity: 0, y: 5 }} 
                         animate={{ opacity: 1, y: 0 }} 
                         exit={{ opacity: 0, scale: 0.95, y: -5 }}
                         className="flex items-center gap-3 text-teal-400 text-sm italic font-medium bg-teal-500/10 px-4 py-2.5 rounded-2xl border border-teal-500/20"
                       >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                            className="w-3.5 h-3.5 rounded-full border-b-2 border-teal-400 shrink-0"
                          />
                          {label}
                       </motion.div>
                     );
                  }

                  if (tool.state === 'result') {
                     // 2. Generative UI Render (When execution finishes)
                     if (tool.toolName === 'generate_chart') {
                        return (
                          <motion.div key={tool.toolCallId} initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full mt-2">
                             <GenerativeChart data={tool.result.data} title={tool.result.title} />
                          </motion.div>
                        )
                     }
                  }

                  return null;
                })}
              </AnimatePresence>

            </div>
          </div>
        ))}

        {/* Error State */}
        {error && (
          <div className="flex gap-4 justify-start">
             <div className="w-10 h-10 shrink-0 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/50 mt-1">
                 <AlertCircle size={20} className="text-red-400" />
             </div>
             <div className="p-4 rounded-2xl text-[15px] bg-red-950/50 border border-red-900/50 text-red-200">
               <p className="whitespace-pre-wrap leading-relaxed">Hubo un error de conexión: {error.message}.</p>
             </div>
          </div>
        )}

        {/* Global LLM Processing Initial Loader */}
        {isLoading && messages.length > 0 && messages[messages.length-1].role === 'user' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
             <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0 border border-teal-500/50">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-2.5 h-2.5 bg-teal-400 rounded-full"/>
             </div>
          </motion.div>
        )}
      </div>

      <div className="p-4 border-t border-zinc-900 bg-zinc-950/90 backdrop-blur-xl relative z-10">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (!input || input.trim().length === 0) return;
            sendMessage({ content: input, role: 'user' });
            setInput('');
          }} 
          className="flex gap-3"
        >
          <input
            name="chat-input"
            className="flex-1 bg-zinc-900 border border-zinc-800 text-white px-5 py-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all font-sans placeholder:text-zinc-500 shadow-inner"
            value={input}
            placeholder="Pregunta sobre las normas, reportes o analízalas..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (input && input.trim() && !isLoading) {
                   e.currentTarget.form?.requestSubmit();
                }
              }
            }}
          />
          <button 
            type="submit" 
            disabled={isLoading}
            className="px-8 py-4 bg-teal-500 min-w-[120px] text-zinc-950 font-bold tracking-tight rounded-2xl hover:bg-teal-400 focus:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(20,184,166,0.3)] hover:shadow-[0_0_30px_rgba(20,184,166,0.5)]"
          >
            Preguntar
          </button>
        </form>
      </div>
    </div>
  );
}
