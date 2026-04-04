"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRagStore } from "../store/rag-store";

export function CableConnector() {
  const isIndexing = useRagStore(s => s.isUploadingDocument || s.activeAgent === "indexing");

  return (
    <AnimatePresence>
      {isIndexing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="relative h-14 flex items-center justify-center overflow-visible -my-1 pointer-events-none"
        >
          <svg
            width="100%"
            height="56"
            viewBox="0 0 280 56"
            preserveAspectRatio="none"
            className="overflow-visible"
          >
            <defs>
              {/* Neon green glow filter */}
              <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur1" />
                <feGaussianBlur stdDeviation="6" result="blur2" />
                <feMerge>
                  <feMergeNode in="blur2" />
                  <feMergeNode in="blur1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="particle-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* The cable path ID for animateMotion */}
              <path
                id="cable-path"
                d="M 140 0 C 140 10, 110 20, 120 28 C 130 36, 150 36, 140 56"
              />
            </defs>

            {/* Cable outer glow (thick, very transparent) */}
            <use
              href="#cable-path"
              stroke="#00ff88"
              strokeWidth="8"
              fill="none"
              opacity="0.08"
            />

            {/* Cable mid glow */}
            <use
              href="#cable-path"
              stroke="#00ff88"
              strokeWidth="4"
              fill="none"
              opacity="0.15"
            />

            {/* Main cable — animated draw */}
            <motion.path
              d="M 140 0 C 140 10, 110 20, 120 28 C 130 36, 150 36, 140 56"
              stroke="#00ff88"
              strokeWidth="1.5"
              fill="none"
              filter="url(#neon-glow)"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />

            {/* Traveling energy particle */}
            <circle r="4" fill="#ffffff" filter="url(#particle-glow)" opacity="0.9">
              <animateMotion dur="0.9s" repeatCount="indefinite" rotate="auto">
                <mpath href="#cable-path" />
              </animateMotion>
            </circle>

            {/* Smaller trailing particle */}
            <circle r="2.5" fill="#00ff88" filter="url(#neon-glow)" opacity="0.7">
              <animateMotion dur="0.9s" begin="0.15s" repeatCount="indefinite" rotate="auto">
                <mpath href="#cable-path" />
              </animateMotion>
            </circle>

            {/* Origin plug dot (upload end) */}
            <motion.circle
              cx="140"
              cy="0"
              r="4"
              fill="#00ff88"
              filter="url(#neon-glow)"
              animate={{ scale: [1, 1.4, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Destination plug dot (VectorDB end) */}
            <motion.circle
              cx="140"
              cy="56"
              r="4"
              fill="#00ff88"
              filter="url(#neon-glow)"
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            />
          </svg>

          {/* Label */}
          <motion.span
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono font-bold text-green-400 tracking-widest uppercase"
          >
            Conectando...
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
