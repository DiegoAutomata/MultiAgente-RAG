// @ts-nocheck
"use client";

import { useChat } from "@ai-sdk/react";
import { Bot, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GenerativeChart } from "./GenerativeChart";
import { useRagStore } from "../store/rag-store";
import { useEffect, useRef, useState } from "react";

export function Chat() {
  // AI SDK v6: isLoading no existe, usar status en su lugar
  const { messages, error, sendMessage, status } = useChat({
    api: "/api/chat",
  });
  const [input, setInput] = useState("");

  const setActiveAgent = useRagStore(s => s.setActiveAgent);
  const isLoading = status === "streaming" || status === "submitted";
  const previousLoading = useRef(false);

  // Auto-scroll al último mensaje cuando cambia el estado
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  // Actualizar agente activo en el visualizador
  useEffect(() => {
    if (!isLoading) {
      if (previousLoading.current) {
        setActiveAgent('auditor');
        setTimeout(() => setActiveAgent('idle'), 1500);
      } else {
        setActiveAgent('idle');
      }
      previousLoading.current = false;
      return;
    }

    previousLoading.current = true;
    const lastMsg = messages[messages.length - 1];

    if (lastMsg?.role === 'user' || !lastMsg) {
      setActiveAgent('semantic-router');
    } else {
      const hasActiveTool = lastMsg?.parts?.some(
        (p: any) => p.type?.startsWith('tool-') && (p.state === 'input-streaming' || p.state === 'input-available')
      );
      if (hasActiveTool) {
        const toolPart = lastMsg.parts.find(
          (p: any) => p.type?.startsWith('tool-') && p.state !== 'output-available'
        );
        if (toolPart?.toolName === 'investigate_database') setActiveAgent('investigator');
        else setActiveAgent('redactor');
      } else {
        setActiveAgent('redactor');
      }
    }
  }, [messages, isLoading, setActiveAgent]);

  /**
   * Extrae el texto de un mensaje (SDK v6: m.parts con type 'text').
   * En multi-step, concatena los textos de todos los steps.
   */
  function getTextContent(m: any): string {
    if (m.parts?.length) {
      return m.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text ?? '')
        .join('');
    }
    return typeof m.content === 'string' ? m.content : '';
  }

  /**
   * Extrae las partes de tool calls de un mensaje.
   * SDK v6: type 'tool-invocation', estado 'input-available' | 'output-available'
   */
  function getToolParts(m: any): any[] {
    if (m.parts?.length) {
      return m.parts.filter((p: any) => p.type?.startsWith('tool-'));
    }
    return m.toolInvocations ?? [];
  }

  return (
    <div className="flex flex-col w-full h-full bg-zinc-950/80 text-white rounded-2xl shadow-2xl border border-white/5 overflow-hidden relative">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-teal-500/20 blur-2xl scale-150" />
              <div className="relative w-16 h-16 bg-gradient-to-br from-teal-500/20 to-emerald-500/10 rounded-2xl flex items-center justify-center border border-teal-500/30 shadow-[0_0_40px_rgba(20,184,166,0.2)]">
                <Bot size={30} className="text-teal-400" />
              </div>
            </div>
            <div suppressHydrationWarning>
              <h2 className="text-xl font-bold text-white tracking-tight mb-1">Listo para analizar</h2>
              <p className="text-zinc-500 max-w-xs text-sm leading-relaxed">
                Sube un documento en el panel izquierdo y luego haz preguntas sobre su contenido.
              </p>
            </div>
          </div>
        )}

        {messages.map((m: any) => {
          const textContent = getTextContent(m);
          const toolParts = getToolParts(m);

          return (
            <div key={m.id} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role !== 'user' && (
                <div className="w-10 h-10 shrink-0 rounded-full bg-teal-500/20 flex items-center justify-center border border-teal-500/50 mt-1">
                  <Bot size={20} className="text-teal-400" />
                </div>
              )}
              <div className={`flex flex-col gap-3 min-w-[50%] max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>

                {/* Texto del mensaje */}
                {textContent && (
                  <div className={`p-4 rounded-2xl text-[15px] ${m.role === 'user' ? 'bg-zinc-800 text-zinc-100 rounded-tr-sm' : 'bg-transparent text-zinc-300'}`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{textContent}</p>
                  </div>
                )}

                {/* Tool Parts: animaciones de proceso y UI generativa */}
                <AnimatePresence>
                  {toolParts.map((toolPart: any) => {
                    const toolName = toolPart.toolName;
                    const toolCallId = toolPart.toolCallId;
                    const isInProgress = toolPart.state === 'call' || toolPart.state === 'input-streaming' || toolPart.state === 'input-available';
                    const hasResult = toolPart.state === 'result' || toolPart.state === 'output-available';
                    const result = toolPart.output ?? toolPart.result;

                    if (isInProgress) {
                      let label = "Analizando sistema...";
                      if (toolName === 'investigate_database') label = "🔍 Investigador consultando la base vectorial corporativa...";
                      if (toolName === 'list_documents') label = "📂 Consultando archivo de documentos corporativos...";
                      if (toolName === 'generate_chart') label = "📊 Generando UI Analítica interactiva...";

                      return (
                        <motion.div
                          key={toolCallId}
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

                    if (hasResult && toolName === 'generate_chart' && result) {
                      return (
                        <motion.div key={toolCallId} initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full mt-2">
                           <GenerativeChart data={result.data} title={result.title} />
                        </motion.div>
                      );
                    }

                    return null;
                  })}
                </AnimatePresence>

              </div>
            </div>
          );
        })}

        {/* Estado de error */}
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

        {/* Loader inicial mientras el LLM procesa */}
        {(status === "submitted" || status === "streaming") && messages.length > 0 && messages[messages.length-1].role === 'user' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
             <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0 border border-teal-500/50">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-2.5 h-2.5 bg-teal-400 rounded-full"/>
             </div>
          </motion.div>
        )}

        {/* Anchor para auto-scroll */}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-3 border-t border-white/5 bg-zinc-950/80 backdrop-blur-xl relative z-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!input || input.trim().length === 0) return;
            sendMessage({ text: input });
            setInput('');
          }}
          className="flex gap-2 items-center bg-zinc-900/80 border border-white/8 rounded-2xl px-4 py-2 focus-within:border-teal-500/40 focus-within:shadow-[0_0_20px_rgba(20,184,166,0.08)] transition-all"
        >
          <input
            name="chat-input"
            className="flex-1 bg-transparent text-white py-2 focus:outline-none font-sans placeholder:text-zinc-600 text-sm"
            value={input}
            placeholder="Consulta normas, límites de velocidad, regulaciones..."
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
            className="shrink-0 px-5 py-2 bg-teal-500 text-black text-sm font-bold rounded-xl hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_16px_rgba(20,184,166,0.25)] hover:shadow-[0_0_24px_rgba(20,184,166,0.4)]"
          >
            {isLoading ? "..." : "Enviar"}
          </button>
        </form>
        <p className="text-center text-[10px] text-zinc-700 mt-1.5 font-mono">Enter para enviar · Respuestas basadas exclusivamente en tus documentos</p>
      </div>
    </div>
  );
}
