"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRagStore } from "../store/rag-store";
import { DatabaseZap, Loader2, FileText } from "lucide-react";
import { useState, useEffect, useMemo } from "react";

interface DocumentMeta {
  id: string;
  title: string;
  created_at: string;
}

export function VectorDBInspector() {
  const documentUploaded = useRagStore(s => s.documentUploaded);
  const isUploadingDocument = useRagStore(s => s.isUploadingDocument);
  const [hoveredChunk, setHoveredChunk] = useState<number | null>(null);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [docCount, setDocCount] = useState(0);

  // Fetch real document count from the API
  useEffect(() => {
    if (!documentUploaded && !isUploadingDocument) return;

    fetch("/api/documents")
      .then(r => r.ok ? r.json() : { documents: [] })
      .then(data => {
        const docs: DocumentMeta[] = data.documents ?? [];
        setDocuments(docs);
        setDocCount(docs.length);
      })
      .catch(() => setDocCount(0));
  }, [documentUploaded, isUploadingDocument]);

  // Generate chunk scatter plot — seeded from document count so it's reproducible
  const chunks = useMemo(() => {
    if (!documentUploaded && !isUploadingDocument) return [];
    const count = Math.min(45, Math.max(12, docCount * 8));
    return Array.from({ length: count }).map((_, i) => {
      // Deterministic pseudo-random positions based on index
      const seed = (i * 2654435761) >>> 0;
      return {
        id: i,
        x: ((seed % 8500) / 100) + 5,
        y: (((seed >> 8) % 8000) / 100) + 10,
      };
    });
  }, [documentUploaded, isUploadingDocument, docCount]);

  const connections = useMemo(() => {
    const lines: { id: string; x1: number; y1: number; x2: number; y2: number; thickness: number; opacity: number }[] = [];
    if (isUploadingDocument) return lines;
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
            thickness: Math.max(0.2, similarity * 2),
            opacity: Math.max(0.05, similarity * 0.4),
          });
        }
      }
    }
    return lines;
  }, [chunks, isUploadingDocument]);

  if (!documentUploaded && !isUploadingDocument) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0, y: -20 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
      className="bg-zinc-900/50 backdrop-blur-md border border-teal-900/30 rounded-2xl p-5 shadow-inner mt-4 overflow-hidden relative"
    >
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-500/20 rounded-lg">
            <DatabaseZap size={20} className="text-teal-400" />
          </div>
          <div>
            <h4 className="text-white font-bold text-sm">Base de Datos Vectorial</h4>
            <p className="text-[11px] text-zinc-400 font-mono">Indexación Matemática Multidimensional</p>
          </div>
        </div>

        {/* Real document count badge */}
        {docCount > 0 && (
          <div className="flex items-center gap-1.5 bg-teal-500/10 border border-teal-500/20 px-3 py-1 rounded-full">
            <FileText size={11} className="text-teal-400" />
            <span className="text-teal-400 text-xs font-mono font-semibold">
              {docCount} {docCount === 1 ? "documento" : "documentos"}
            </span>
          </div>
        )}
      </div>

      {isUploadingDocument && (
        <div className="flex items-center gap-3 bg-teal-500/10 border border-teal-500/20 px-3 py-2 rounded-xl text-teal-400 text-xs font-mono font-medium mb-4 relative z-10 w-max">
          <Loader2 size={14} className="animate-spin" />
          <p>Indexando documento y estructurando topología multidimensional...</p>
        </div>
      )}

      {/* 2D scatter plot of vector chunks */}
      <div className="relative w-full min-h-[400px] bg-black/60 border border-teal-500/30 rounded-2xl overflow-hidden group shadow-[0_0_40px_rgba(20,184,166,0.1)] flex-1">

        {/* Grid gridlines */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(#14b8a6 1px, transparent 1px), linear-gradient(90deg, #14b8a6 1px, transparent 1px)", backgroundSize: "15px 15px" }} />

        {/* Axis Lines */}
        <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-teal-500/10" />
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-teal-500/10" />

        {/* SVG connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <AnimatePresence>
            {connections.map(c => (
              <motion.line
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: c.opacity }}
                x1={`${c.x1}%`} y1={`${c.y1}%`}
                x2={`${c.x2}%`} y2={`${c.y2}%`}
                stroke="#14b8a6"
                strokeWidth={c.thickness}
              />
            ))}
          </AnimatePresence>
        </svg>

        {/* Chunk nodes */}
        {chunks.map((chunk) => (
          <motion.div
            key={chunk.id}
            initial={isUploadingDocument ? { scale: 0, opacity: 0 } : { scale: 1, opacity: 1 }}
            animate={
              hoveredChunk === chunk.id
                ? { scale: 1.5, opacity: 1, zIndex: 10 }
                : { scale: 1, opacity: 0.6, y: [0, -3, 0] }
            }
            transition={
              hoveredChunk === chunk.id
                ? { duration: 0.2 }
                : { delay: isUploadingDocument ? chunk.id * 0.04 : 0, y: { repeat: Infinity, duration: 2 + (chunk.id % 3), ease: "easeInOut" } }
            }
            onMouseEnter={() => setHoveredChunk(chunk.id)}
            onMouseLeave={() => setHoveredChunk(null)}
            className={`absolute w-3 h-3 rounded-full cursor-crosshair transform -translate-x-1/2 -translate-y-1/2 ${hoveredChunk === chunk.id ? "bg-white shadow-[0_0_15px_#fff]" : "bg-teal-500 shadow-[0_0_8px_#14b8a6]"}`}
            style={{ left: `${chunk.x}%`, top: `${chunk.y}%` }}
          >
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-teal-300/60 pointer-events-none whitespace-nowrap font-mono">#{chunk.id}</span>
          </motion.div>
        ))}

        {/* Hover tooltip */}
        <AnimatePresence>
          {hoveredChunk !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-2 left-2 right-2 bg-zinc-950/90 border border-teal-500/30 p-3 rounded-lg flex items-start gap-3 shadow-lg pointer-events-none z-20"
            >
              <DatabaseZap size={14} className="text-teal-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-white font-medium">Fragmento #{hoveredChunk} — Chunk vectorial indexado</p>
                <p className="text-[10px] text-teal-400/70 font-mono mt-1">
                  {documents[0]?.title ? `Doc: ${documents[0].title}` : "Fragmento de documento procesado"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!isUploadingDocument && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-4 flex items-center justify-center p-2 bg-teal-500/10 rounded-lg border border-teal-500/20">
          <p className="text-xs text-teal-400 font-medium">
            Motor de Búsqueda Híbrida: <span className="text-white">Activo · {chunks.length} fragmentos visualizados</span>
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
