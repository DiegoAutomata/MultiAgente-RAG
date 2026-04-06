"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRagStore } from "../store/rag-store";
import { DatabaseZap, FileText, RefreshCw } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";

interface DocumentWithChunks {
  id: string;
  title: string;
  status: string;
  created_at: string;
  chunk_count: number;
}

interface ChunkPosition {
  id: string;
  document_id: string;
  x_2d: number;
  y_2d: number;
}

// Palette of colors per document slot
const DOC_COLORS = [
  { dot: "#2dd4bf", glow: "#14b8a6", label: "teal" },
  { dot: "#818cf8", glow: "#6366f1", label: "indigo" },
  { dot: "#fb923c", glow: "#f97316", label: "orange" },
  { dot: "#f472b6", glow: "#ec4899", label: "pink" },
  { dot: "#a3e635", glow: "#84cc16", label: "lime" },
];

// Pseudo-random positions as fallback when no 2D coords exist yet
function pseudoRandomPositions(docIndex: number, totalDocs: number, count: number) {
  const cols = Math.min(totalDocs, 3);
  const col = docIndex % cols;
  const row = Math.floor(docIndex / cols);
  const colWidth = 80 / cols;
  const rowHeight = totalDocs > 3 ? 40 : 80;
  const cx = 10 + col * colWidth + colWidth / 2;
  const cy = 15 + row * rowHeight + rowHeight / 2;
  const spread = Math.min(colWidth * 0.4, 22);

  return Array.from({ length: count }).map((_, i) => {
    const seed = (i * 2654435761 + docIndex * 999983) >>> 0;
    const angle = (seed % 6283) / 1000;
    const radius = ((seed >> 8) % 1000) / 1000;
    const r = Math.sqrt(radius) * spread;
    return {
      id: i,
      x: Math.min(95, Math.max(3, cx + r * Math.cos(angle))),
      y: Math.min(92, Math.max(5, cy + r * Math.sin(angle))),
    };
  });
}

// Ghost clusters for idle state
function idleChunks() {
  return Array.from({ length: 12 }).map((_, i) => {
    const seed = (i * 2654435761) >>> 0;
    return {
      id: i,
      x: ((seed % 8500) / 100) + 5,
      y: (((seed >> 8) % 7500) / 100) + 10,
    };
  });
}

export function VectorDBInspector() {
  const isUploadingDocument = useRagStore(s => s.isUploadingDocument);
  const lastRefreshAt = useRagStore(s => s.lastRefreshAt);
  const [documents, setDocuments] = useState<DocumentWithChunks[]>([]);
  const [positions, setPositions] = useState<ChunkPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredChunk, setHoveredChunk] = useState<{ docIdx: number; chunkIdx: number } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [docsRes, posRes] = await Promise.all([
        fetch("/api/documents"),
        fetch("/api/chunks/positions"),
      ]);
      if (docsRes.ok) {
        const data = await docsRes.json();
        setDocuments(data.documents ?? []);
      }
      if (posRes.ok) {
        const data = await posRes.json();
        setPositions(data.positions ?? []);
      }
    } catch {
      // silently fail — show last known state
    } finally {
      setLoading(false);
    }
  }, []);

  // Always fetch on mount and whenever lastRefreshAt changes
  useEffect(() => {
    fetchData();
  }, [fetchData, lastRefreshAt]);

  // Also re-fetch when upload completes (isUploadingDocument goes false→true→false)
  useEffect(() => {
    if (!isUploadingDocument) {
      fetchData();
    }
  }, [isUploadingDocument, fetchData]);

  const hasRealPositions = positions.length > 0;

  // Build clusters per document using real 2D coordinates when available
  const clusters = useMemo(() => {
    const completedDocs = documents.filter(d => d.chunk_count > 0);
    if (completedDocs.length === 0) return [];

    return completedDocs.map((doc, docIdx) => {
      const color = DOC_COLORS[docIdx % DOC_COLORS.length];

      // Try real positions first
      const realPos = positions.filter(p => p.document_id === doc.id);
      if (realPos.length > 0) {
        const displayPos = realPos.slice(0, 80);
        return {
          doc,
          color,
          usingReal: true,
          chunks: displayPos.map((p, i) => ({ id: i, x: p.x_2d, y: p.y_2d })),
        };
      }

      // Fallback: pseudo-random distribution
      const displayCount = Math.min(doc.chunk_count, 60);
      return {
        doc,
        color,
        usingReal: false,
        chunks: pseudoRandomPositions(docIdx, completedDocs.length, displayCount),
      };
    });
  }, [documents, positions]);

  // Connections within each cluster (nearby pairs)
  const connections = useMemo(() => {
    const lines: {
      id: string; x1: number; y1: number; x2: number; y2: number;
      stroke: string; thickness: number; opacity: number;
    }[] = [];
    clusters.forEach(({ chunks, color }, ci) => {
      for (let i = 0; i < chunks.length; i++) {
        for (let j = i + 1; j < chunks.length; j++) {
          const dx = chunks[i].x - chunks[j].x;
          const dy = chunks[i].y - chunks[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 18) {
            const sim = 1 - dist / 18;
            lines.push({
              id: `${ci}-${i}-${j}`,
              x1: chunks[i].x, y1: chunks[i].y,
              x2: chunks[j].x, y2: chunks[j].y,
              stroke: color.glow,
              thickness: Math.max(0.2, sim * 1.2),
              opacity: Math.max(0.04, sim * 0.28),
            });
          }
        }
      }
    });
    return lines;
  }, [clusters]);

  const ghost = useMemo(() => idleChunks(), []);
  const hasData = documents.length > 0;
  const totalChunks = clusters.reduce((s, c) => s + c.chunks.length, 0);
  const totalRealChunks = documents.reduce((s, d) => s + d.chunk_count, 0);
  const allUsingReal = clusters.length > 0 && clusters.every(c => c.usingReal);

  const tooltipInfo = useMemo(() => {
    if (!hoveredChunk) return null;
    const cluster = clusters[hoveredChunk.docIdx];
    if (!cluster) return null;
    return {
      title: cluster.doc.title,
      chunkIdx: hoveredChunk.chunkIdx,
      total: cluster.doc.chunk_count,
      color: cluster.color,
      usingReal: cluster.usingReal,
    };
  }, [hoveredChunk, clusters]);

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
            <p className="text-[9px] text-zinc-600 font-mono">
              {hasData && totalRealChunks > 0
                ? `${totalRealChunks.toLocaleString()} fragmentos · ${documents.length} doc${documents.length !== 1 ? "s" : ""}`
                : "Indexación Multidimensional"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {loading && <RefreshCw size={10} className="text-zinc-600 animate-spin" />}
          {documents.length > 0 ? (
            <div className="flex items-center gap-1 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-full">
              <FileText size={9} className="text-teal-400" />
              <span className="text-teal-400 text-[9px] font-mono font-bold">
                {documents.length} doc{documents.length !== 1 ? "s" : ""}
              </span>
            </div>
          ) : (
            <span className="text-[9px] font-mono text-zinc-700 uppercase tracking-wide">Vacía</span>
          )}
        </div>
      </div>

      {/* Scatter plot */}
      <div className={`relative w-full h-[180px] rounded-xl overflow-hidden transition-all duration-500 ${
        hasData
          ? "bg-black/70 border border-teal-500/20 shadow-[0_0_20px_rgba(20,184,166,0.08)]"
          : "bg-black/40 border border-zinc-800/60"
      }`}>

        {/* Grid */}
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${hasData ? "opacity-[0.04]" : "opacity-[0.015]"}`}
          style={{ backgroundImage: "linear-gradient(#14b8a6 1px, transparent 1px), linear-gradient(90deg, #14b8a6 1px, transparent 1px)", backgroundSize: "15px 15px" }}
        />
        <div className={`absolute left-1/2 top-0 bottom-0 w-px transition-opacity ${hasData ? "bg-teal-500/10" : "bg-zinc-800/30"}`} />
        <div className={`absolute top-1/2 left-0 right-0 h-px transition-opacity ${hasData ? "bg-teal-500/10" : "bg-zinc-800/30"}`} />

        {/* Axis labels (real mode only) */}
        {hasData && allUsingReal && (
          <>
            <span className="absolute bottom-1 right-1.5 text-[7px] font-mono text-zinc-700">dim-1 →</span>
            <span className="absolute top-1 left-1 text-[7px] font-mono text-zinc-700">dim-2 ↑</span>
          </>
        )}

        {/* Idle overlay */}
        {!hasData && !loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[10px] text-zinc-700 font-mono text-center">
              Sube un documento<br />para indexar vectores
            </p>
          </div>
        )}
        {loading && !hasData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <RefreshCw size={14} className="text-zinc-700 animate-spin" />
          </div>
        )}

        {/* Connection lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <AnimatePresence>
            {hasData && connections.map(c => (
              <motion.line
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: c.opacity }}
                exit={{ opacity: 0 }}
                x1={`${c.x1}%`} y1={`${c.y1}%`}
                x2={`${c.x2}%`} y2={`${c.y2}%`}
                stroke={c.stroke}
                strokeWidth={c.thickness}
              />
            ))}
          </AnimatePresence>
        </svg>

        {/* Idle ghost dots */}
        {!hasData && ghost.map(chunk => (
          <div
            key={chunk.id}
            className="absolute w-1.5 h-1.5 rounded-full bg-zinc-700 opacity-20 transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${chunk.x}%`, top: `${chunk.y}%` }}
          />
        ))}

        {/* Real cluster dots */}
        {hasData && clusters.map(({ chunks, color }, docIdx) =>
          chunks.map((chunk) => {
            const isHovered = hoveredChunk?.docIdx === docIdx && hoveredChunk?.chunkIdx === chunk.id;
            return (
              <motion.div
                key={`${docIdx}-${chunk.id}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={
                  isHovered
                    ? { scale: 2.5, opacity: 1 }
                    : { scale: 1, opacity: 0.65, y: [0, -1.5, 0] }
                }
                transition={
                  isHovered
                    ? { duration: 0.15 }
                    : { delay: (docIdx * 12 + chunk.id) * 0.008, y: { repeat: Infinity, duration: 2 + (chunk.id % 3), ease: "easeInOut" } }
                }
                onMouseEnter={() => setHoveredChunk({ docIdx, chunkIdx: chunk.id })}
                onMouseLeave={() => setHoveredChunk(null)}
                className="absolute w-2 h-2 rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-crosshair"
                style={{
                  left: `${chunk.x}%`,
                  top: `${chunk.y}%`,
                  backgroundColor: isHovered ? "#fff" : color.dot,
                  boxShadow: isHovered
                    ? "0 0 10px #fff"
                    : `0 0 5px ${color.glow}`,
                }}
              />
            );
          })
        )}

        {/* Hover tooltip */}
        <AnimatePresence>
          {tooltipInfo && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute bottom-1.5 left-1.5 right-1.5 bg-zinc-950/95 border border-white/10 px-2.5 py-1.5 rounded-lg pointer-events-none z-20 flex items-center gap-2"
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: tooltipInfo.color.dot, boxShadow: `0 0 5px ${tooltipInfo.color.glow}` }}
              />
              <p className="text-[10px] text-zinc-300 font-mono truncate">
                Chunk #{tooltipInfo.chunkIdx + 1}/{tooltipInfo.total} · {tooltipInfo.title.replace(/_/g, ' ')}
                {tooltipInfo.usingReal && <span className="text-teal-500/60 ml-1">· PCA</span>}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend per document */}
      {hasData && clusters.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {clusters.map(({ doc, color, usingReal }, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color.dot }} />
              <span className="text-[9px] font-mono text-zinc-500 truncate max-w-[90px]" title={doc.title.replace(/_/g, ' ')}>
                {doc.title.replace(/_/g, ' ')}
              </span>
              <span className="text-[9px] font-mono text-zinc-700">({doc.chunk_count})</span>
              {usingReal && <span className="text-[7px] font-mono text-teal-700">2D</span>}
            </div>
          ))}
        </div>
      )}

      {/* Footer status */}
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-wide">
          {hasData && totalChunks > 0
            ? `${allUsingReal ? "Proyección PCA real" : "Motor híbrido"} · ${totalChunks} pts visibles`
            : "Motor híbrido · en espera"}
        </p>
        <div className={`w-1.5 h-1.5 rounded-full transition-colors ${hasData ? "bg-teal-500 animate-pulse" : "bg-zinc-800"}`} />
      </div>
    </div>
  );
}
