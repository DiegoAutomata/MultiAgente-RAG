import { Chat } from "@/features/ai/components/Chat";
import { DocumentUpload } from "@/features/ai/components/DocumentUpload";
import { VectorDBInspector } from "@/features/ai/components/VectorDBInspector";
import { AgentFlowVisualizer } from "@/features/ai/components/AgentFlowVisualizer";
import { CableConnector } from "@/features/ai/components/CableConnector";
import { UserMenu } from "@/features/auth/components/UserMenu";

export default function Home() {
  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#080a0f]">

      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 left-[28%] w-[500px] h-[250px] bg-teal-950/40 rounded-[100%] blur-[130px]" />
        <div className="absolute bottom-0 right-[10%] w-[350px] h-[250px] bg-indigo-950/25 rounded-[100%] blur-[100px]" />
      </div>

      {/* ── TOPBAR ── */}
      <header className="h-12 shrink-0 border-b border-white/[0.06] bg-black/70 backdrop-blur-2xl flex items-center px-4 gap-4 z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-[0_0_12px_rgba(20,184,166,0.5)]">
            <span className="text-black font-black text-[9px]">RAG</span>
          </div>
          <span className="text-white font-bold text-sm tracking-tight">
            Enterprise <span className="text-teal-400">RAG Auditor</span>
          </span>
        </div>

        <div className="w-px h-4 bg-white/10" />

        <div className="hidden md:flex items-center gap-3 text-[11px] font-mono text-zinc-600">
          <span>Engine: <span className="text-zinc-400">Multi-Agent RAG</span></span>
          <span className="text-zinc-800">·</span>
          <span>Model: <span className="text-zinc-400">Claude 3 Haiku</span></span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
          <span className="text-teal-400 text-[10px] font-mono font-bold tracking-widest uppercase">Online</span>
        </div>

        <UserMenu />
      </header>

      {/* ── BODY ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── SIDEBAR ── */}
        <aside className="w-[420px] shrink-0 flex flex-col border-r border-white/[0.05] bg-black/30 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          <div className="p-3 flex flex-col gap-3">
            <AgentFlowVisualizer />
            <DocumentUpload />
            <CableConnector />
            <VectorDBInspector />
          </div>
        </aside>

        {/* ── CHAT ── */}
        <main className="flex-1 overflow-hidden flex flex-col p-3">
          <Chat />
        </main>

      </div>
    </div>
  );
}
