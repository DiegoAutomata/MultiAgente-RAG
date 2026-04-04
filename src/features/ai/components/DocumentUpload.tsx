"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, CheckCircle, Loader2, Trash2, FileMinus } from "lucide-react";
import { useRagStore } from "../store/rag-store";
import { useAuth } from "@/features/auth/hooks/useAuth";

export function DocumentUpload() {
  const setDocumentUploaded = useRagStore(s => s.setDocumentUploaded);
  const setIsUploadingDocument = useRagStore(s => s.setIsUploadingDocument);
  const setActiveAgent = useRagStore(s => s.setActiveAgent);
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isDeletingLast, setIsDeletingLast] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const showMessage = (text: string, isError = false) => {
    setActionMessage({ text, isError });
    setTimeout(() => setActionMessage(null), 3500);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === "application/pdf") {
      setFile(droppedFile);
      setUploadSuccess(false);
    } else {
      showMessage("Por favor sube solo archivos PDF.", true);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setIsUploadingDocument(true);

    // Animate the agent flow: user → investigator → indexing → auditor → idle
    setActiveAgent('user');
    const agentTimer1 = setTimeout(() => setActiveAgent('investigator'), 800);
    const agentTimer2 = setTimeout(() => setActiveAgent('indexing'), 2500);

    const formData = new FormData();
    formData.append("file", file);
    if (user?.id) formData.append("userId", user.id);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        clearTimeout(agentTimer1);
        clearTimeout(agentTimer2);
        setIsUploading(false);

        // Poll until document status = 'completed' or 'failed'
        const uploadedTitle = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const pollStart = Date.now();
        const MAX_WAIT = 10 * 60 * 1000; // 10 min for large files

        const poll = async () => {
          try {
            const r = await fetch("/api/documents");
            if (r.ok) {
              const d = await r.json();
              const doc = (d.documents ?? []).find((doc: { title: string; status: string }) => doc.title === uploadedTitle);
              if (doc?.status === 'completed') {
                setActiveAgent('auditor');
                setTimeout(() => setActiveAgent('idle'), 1500);
                setUploadSuccess(true);
                setDocumentUploaded(true);
                setIsUploadingDocument(false);
                return;
              }
              if (doc?.status === 'failed') {
                setActiveAgent('idle');
                setIsUploadingDocument(false);
                showMessage("Error al procesar el documento. Intenta nuevamente.", true);
                return;
              }
            }
          } catch { /* retry */ }
          if (Date.now() - pollStart < MAX_WAIT) {
            setTimeout(poll, 5000);
          } else {
            // Timeout — assume completed (very large file)
            setActiveAgent('idle');
            setUploadSuccess(true);
            setDocumentUploaded(true);
            setIsUploadingDocument(false);
          }
        };
        setTimeout(poll, 5000); // first check after 5s
      } else {
        clearTimeout(agentTimer1);
        clearTimeout(agentTimer2);
        setActiveAgent('idle');
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          showMessage("Sesión expirada. Redirigiendo al login...", true);
          setTimeout(() => { window.location.href = '/login'; }, 1500);
        } else {
          showMessage(data.error ?? "Error en la subida y procesamiento.", true);
        }
        setIsUploading(false);
        setIsUploadingDocument(false);
      }
    } catch {
      clearTimeout(agentTimer1);
      clearTimeout(agentTimer2);
      setActiveAgent('idle');
      showMessage("Error de red. Verifica tu conexión.", true);
      setIsUploading(false);
      setIsUploadingDocument(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("¿Seguro que quieres vaciar TODA tu base de datos? Esta acción no se puede deshacer.")) return;
    setIsClearing(true);
    try {
      const res = await fetch("/api/documents", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setUploadSuccess(false);
        setDocumentUploaded(false);
        setFile(null);
        showMessage("Base de datos vaciada correctamente.");
      } else {
        showMessage(data.error ?? "Error al vaciar la base de datos.", true);
      }
    } catch {
      showMessage("Error de red al vaciar la base de datos.", true);
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteLast = async () => {
    if (!confirm("¿Eliminar el último archivo subido?")) return;
    setIsDeletingLast(true);
    try {
      const res = await fetch("/api/documents/last", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        showMessage(`"${data.deleted}" eliminado correctamente.`);
        setUploadSuccess(false);
        setDocumentUploaded(false);
        setFile(null);
      } else {
        showMessage(data.error ?? "Error al eliminar el documento.", true);
      }
    } catch {
      showMessage("Error de red.", true);
    } finally {
      setIsDeletingLast(false);
    }
  };

  return (
    <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 relative overflow-hidden flex flex-col">
      <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/5 rounded-full blur-[60px] -z-10" />

      <h3 className="text-xs font-bold text-white mb-1 tracking-tight uppercase font-mono">Base de Conocimiento</h3>
      <p className="text-[11px] text-zinc-500 mb-4 leading-relaxed">
        Sube un PDF para indexarlo y consultarlo con IA.
      </p>

      {uploadSuccess ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center p-8 border border-teal-500/30 bg-teal-500/10 rounded-2xl text-teal-400 gap-4 flex-1"
        >
          <CheckCircle size={48} />
          <p className="font-semibold text-center">¡Documento procesado e indexado!</p>
          <button
            onClick={() => { setFile(null); setUploadSuccess(false); setDocumentUploaded(false); }}
            className="mt-2 text-sm underline text-teal-400/80 hover:text-teal-300"
          >
            Subir otro documento
          </button>
        </motion.div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center p-8 cursor-pointer relative ${
            isDragging ? "border-teal-500 bg-teal-500/5 scale-[1.02]" : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/30"
          }`}
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <input
            id="file-upload"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
          />
          <AnimatePresence mode="popLayout">
            {!file ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center">
                  <UploadCloud className="text-zinc-500" size={32} />
                </div>
                <div>
                  <p className="text-zinc-300 font-medium">Arrastra tu PDF aquí o haz clic</p>
                  <p className="text-zinc-500 text-sm mt-1">Soporte para documentos extensos</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="file" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col items-center gap-4 w-full">
                <div className="w-16 h-16 rounded-2xl bg-teal-500/20 flex items-center justify-center border border-teal-500/30">
                  <FileText className="text-teal-400" size={32} />
                </div>
                <div className="text-center truncate px-4 w-full">
                  <p className="text-white font-medium truncate">{file.name}</p>
                  <p className="text-zinc-500 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                  disabled={isUploading}
                  className="mt-4 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-full justify-center"
                >
                  {isUploading ? (
                    <><Loader2 size={18} className="animate-spin" />Procesando con IA...</>
                  ) : "Ingestar Documento"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Feedback message */}
      <AnimatePresence>
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-3 px-4 py-2 rounded-xl text-sm font-medium text-center ${
              actionMessage.isError
                ? "bg-red-500/10 border border-red-500/20 text-red-400"
                : "bg-teal-500/10 border border-teal-500/20 text-teal-400"
            }`}
          >
            {actionMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* DB Management Buttons */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleDeleteLast}
          disabled={isDeletingLast || isClearing}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-zinc-900 border border-zinc-700 hover:border-amber-500/50 hover:bg-amber-500/5 text-zinc-400 hover:text-amber-400 rounded-xl text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isDeletingLast ? <Loader2 size={14} className="animate-spin" /> : <FileMinus size={14} />}
          Eliminar último archivo
        </button>
        <button
          onClick={handleClearAll}
          disabled={isClearing || isDeletingLast}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-zinc-900 border border-zinc-700 hover:border-red-500/50 hover:bg-red-500/5 text-zinc-400 hover:text-red-400 rounded-xl text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isClearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          Vaciar base de datos
        </button>
      </div>
    </div>
  );
}
