"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRagStore } from "../store/rag-store";
import { DatabaseZap, FileText } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

interface DocumentMeta {
  id: string;
  title: string;
  created_at: string;
}

// Deterministic chunk positions seeded by index
function seededChunks(count: number) {
  return Array.from({ length: count }).map((_, i) => {
    const seed = (i * 2654435761) >>> 0;
    return {
      id: i,
      x: ((seed % 8500) / 100) + 5,
      y: (((seed >> 8) % 7500) / 100) + 10,
    };
  });
}

export function VectorDBInspector() {
  const documentUploaded = useRagStore(s => s.documentUploaded);
  const isUploadingDocument = useRagStore(s => s.isUploadingDocument);
  const [hoveredChunk, setHoveredChunk] = useState<number | null>(null);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [docCount, setDocCount] = useState(0);

  const hasData = documentUploaded || isUploadingDocument;

  useEffect(() => {
    if (!hasData) return;
    fetch("/api/documents")
      .then(r => r.ok ? r.json() : { documents: [] })
      .then(data => {
        const docs: DocumentMeta[] = data.documents ?? [];
        setDocuments(docs);
        setDocCount(docs.length);
      })
      .catch(() => setDocCount(0));
  }, [hasData]);

  // Idle ghost chunks — always shown, dimmed
  const idleChunks = useMemo(() => seededChunks(10), []);

  // Active chunks — shown when data exists
  const activeChunks = useMemo(() => {
    if (!hasData) return [];
    const count = Math.min(40, Math.max(12, docCount * 8));
    return seededChunks(count);
  }, [hasData, docCount]);

  const chunks = hasData ? activeChunks : idleChunks;

  const connections = useMemo(() => {
    const lines: { id: string; x1: number; y1: number; x2: number; y2: number; thickness: number; opacity: number }[] = [];
    if (!hasData) return lines;
    for (let i = 0; i < chunks.length; i++) {
      for (let j = i + 1; j < chunks.length; j++) {
        const dx = chunks[i].x - chunks[j].x;
        const dy = chunks[i].y - chunks[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 35) {
          const similarity = 1 - (dist / 35);
          lines.push({
            id: `${i}-${j}`,
            x1: chunks[i].x, y1: chunks[i].y,
            x2: chunks[j].x, y2: chunks[j].y,
            thickness: Math.max(0.2, similarity * 1.5),
            opacity: Math.max(0.04, similarity * 0.3),
          });
        }
      }
    }
    return lines;
  }, [chunks, hasData]);

  return (
    <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg transition-colors ${hasData ? "bg-teal-500/20" : "bg-zinc-800"}`}>
            <DatabaseZap size={14} className={hasData ? "text-teal-400" : "text-zinc-600"} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase font-mono tracking-tight">Base de Datos Vectorial</h4>
            <p className="text-[9px] text-zinc-600 font-mono">Indexación Multidimensional</p>
          </div>
        </div>

        {docCount > 0 ? (
          <div className="flex items-center gap-1 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full">
            <FileText size={9} className="text-teal-400" />
            <span className="text-teal-400 text-[9px] font-mono font-bold">
              {docCount} doc{docCount !== 1 ? "s" : ""}
            </span>
          </div>
        ) : (
          <span className="text-[9px] font-mono text-zinc-700 uppercase tracking-wide">Vacía</span>
        )}
      </div>

      {/* Scatter plot — always visible */}
      <div className={`relative w-full h-[180px] rounded-xl overflow-hidden transition-all duration-500 ${
        hasData
          ? "bg-black/70 border border-teal-500/20 shadow-[0_0_20px_rgba(20,184,166,0.08)]"
          : "bg-black/40 border border-zinc-800/60"
      }`}>

        {/* Gridlines */}
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${hasData ? "opacity-[0.04]" : "opacity-[0.015]"}`}
          style={{ backgroundImage: "linear-gradient(#14b8a6 1px, transparent 1px), linear-gradient(90deg, #14b8a6 1px, transparent 1px)", backgroundSize: "15px 15px" }}
        />

        {/* Axis lines */}
        <div className={`absolute left-1/2 top-0 bottom-0 w-px transition-opacity ${hasData ? "bg-teal-500/10" : "bg-zinc-800/30"}`} />
        <div className={`absolute top-1/2 left-0 right-0 h-px transition-opacity ${hasData ? "bg-teal-500/10" : "bg-zinc-800/30"}`} />

        {/* Idle overlay label */}
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[10px] text-zinc-700 font-mono text-center">
              Sube un documento<br />para indexar vectores
            </p>
          </div>
        )}

        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <AnimatePresence>
            {connections.map(c => (
              <motion.line
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: c.opacity }}
                exit={{ opacity: 0 }}
                x1={`${c.x1}%`} y1={`${c.y1}%`}
                x2={`${c.x2}%`} y2={`${c.y2}%`}
                stroke="#14b8a6"
                strokeWidth={c.thickness}
              />
            ))}
          </AnimatePresence>
        </svg>

        {/* Chunk dots */}
        {chunks.map((chunk) => (
          <motion.div
            key={chunk.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={
              hoveredChunk === chunk.id
                ? { scale: 2, opacity: 1 }
                : hasData
                ? { scale: 1, opacity: 0.6, y: [0, -2, 0] }
                : { scale: 1, opacity: 0.15 }
            }
            transition={
              hoveredChunk === chunk.id
                ? { duration: 0.2 }
                : hasData
                ? { delay: chunk.id * 0.02, y: { repeat: Infinity, duration: 2 + (chunk.id % 3), ease: "easeInOut" } }
                : { delay: chunk.id * 0.05 }
            }
            onMouseEnter={() => hasData && setHoveredChunk(chunk.id)}
            onMouseLeave={() => setHoveredChunk(null)}
            className={`absolute w-2 h-2 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-colors ${
              hoveredChunk === chunk.id
                ? "bg-white shadow-[0_0_10px_#fff] cursor-crosshair"
                : hasData
                ? "bg-teal-500 shadow-[0_0_6px_#14b8a6] cursor-crosshair"
                : "bg-zinc-700"
            }`}
            style={{ left: `${chunk.x}%`, top: `${chunk.y}%` }}
          />
        ))}

        {/* Hover tooltip */}
        <AnimatePresence>
          {hoveredChunk !== null && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-1.5 left-1.5 right-1.5 bg-zinc-950/95 border border-teal-500/30 px-2.5 py-1.5 rounded-lg pointer-events-none z-20 flex items-center gap-2"
            >
              <DatabaseZap size={10} className="text-teal-400 shrink-0" />
              <p className="text-[10px] text-zinc-300 font-mono truncate">
                Chunk #{hoveredChunk} · {documents[0]?.title ?? "documento indexado"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer status */}
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-wide">
          {hasData ? `Motor híbrido · ${chunks.length} fragmentos` : "Motor híbrido · en espera"}
        </p>
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${hasData ? "bg-teal-500 animate-pulse" : "bg-zinc-800"}`} />
      </div>
    </div>
  );
}
