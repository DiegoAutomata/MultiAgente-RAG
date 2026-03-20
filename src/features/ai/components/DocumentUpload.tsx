"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, CheckCircle, Loader2 } from "lucide-react";
import { useRagStore } from "../store/rag-store";

export function DocumentUpload() {
  const setDocumentUploaded = useRagStore(s => s.setDocumentUploaded);
  const setIsUploadingDocument = useRagStore(s => s.setIsUploadingDocument);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === "application/pdf") {
      setFile(droppedFile);
      setUploadSuccess(false);
    } else {
      alert("Por favor sube solo archivos PDF.");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setIsUploadingDocument(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setUploadSuccess(true);
        setDocumentUploaded(true);
      } else {
        alert("Error en la subida y procesamiento.");
      }
    } catch (error) {
      alert("Error de red");
    } finally {
      setIsUploading(false);
      setIsUploadingDocument(false);
    }
  };

  return (
    <div className="bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden h-full flex flex-col justify-center">
      {/* Decorative Blur */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-[80px] -z-10" />

      <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Cargar Base de Conocimiento</h3>
      <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
        Sube tus documentos y observa cómo nuestro enjambre Multi-Agente IA segmenta, evalúa riesgos y consolida insights financieros para darte respuestas con precisión milimétrica.
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
             Sumbir otro documento
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
             onChange={(e) => {
                if (e.target.files?.[0]) {
                   setFile(e.target.files[0]);
                }
             }}
          />
          <AnimatePresence mode="popLayout">
            {!file ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-zinc-800/50 flex items-center justify-center">
                  <UploadCloud className="text-zinc-500" size={32} />
                </div>
                <div>
                  <p className="text-zinc-300 font-medium">Arrastra tu PDF aquí o haz clic</p>
                  <p className="text-zinc-500 text-sm mt-1">Soporte para documentos extensos</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="file"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center gap-4 w-full"
              >
                <div className="w-16 h-16 rounded-2xl bg-teal-500/20 flex items-center justify-center border border-teal-500/30">
                  <FileText className="text-teal-400" size={32} />
                </div>
                <div className="text-center truncate px-4 w-full">
                  <p className="text-white font-medium truncate">{file.name}</p>
                  <p className="text-zinc-500 text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                
                <button
                  onClick={(e) => {
                     e.stopPropagation();
                     handleUpload();
                  }}
                  disabled={isUploading}
                  className="mt-4 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 w-full justify-center"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Procesando con IA...
                    </>
                  ) : (
                    "Ingestar Documento"
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
