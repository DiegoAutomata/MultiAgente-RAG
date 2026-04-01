import { Chat } from "@/features/ai/components/Chat";
import { DocumentUpload } from "@/features/ai/components/DocumentUpload";
import { VectorDBInspector } from "@/features/ai/components/VectorDBInspector";
import { AgentFlowVisualizer } from "@/features/ai/components/AgentFlowVisualizer";
import { UserMenu } from "@/features/auth/components/UserMenu";

export default function Home() {
  return (
    <main className="min-h-screen bg-black flex flex-col items-center py-12 px-4 md:px-8 lg:px-12 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]">

      {/* Background Glows for Premium Vibe */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-teal-900/40 rounded-[100%] blur-[120px] -z-10 pointer-events-none" />

      {/* Top Navigation Bar */}
      <div className="w-full max-w-7xl flex items-center justify-between mb-10">
         <div className="flex items-center gap-4">
           <div className="flex items-center gap-3 bg-zinc-900/50 px-4 py-2 rounded-full border border-zinc-800">
             <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
             <p className="text-teal-400 text-xs font-mono tracking-widest uppercase font-bold">Systems Online</p>
           </div>
           <div className="hidden md:flex gap-4 text-xs font-mono text-zinc-500">
              <p>Engine: <span className="text-white">Multi-Agent RAG</span></p>
              <p>Model: <span className="text-white">Claude 3 Haiku</span></p>
           </div>
         </div>

         {/* User Menu (client component) */}
         <UserMenu />
      </div>

      {/* Main Grid Layout */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">

        {/* Left Column: Context & Ingestion */}
        <div className="col-span-1 lg:col-span-5 flex flex-col gap-8">
          <div className="flex flex-col items-start pt-4">
             <h1 className="text-4xl md:text-5xl lg:text-5xl font-black text-white tracking-[-0.03em] leading-tight mb-4">
               Enterprise <br/>
               <span className="bg-gradient-to-r from-teal-400 to-emerald-300 bg-clip-text text-transparent">RAG Auditor</span>
             </h1>
             <p className="text-zinc-400 text-base lg:text-lg font-medium leading-relaxed max-w-md">
               Detecta anomalías, consolida reportes financieros y audita normativas con Inteligencia Artificial autónoma (Multi-Agentes).
             </p>
          </div>

          {/* Agent Flow Visualizer */}
          <AgentFlowVisualizer />

          {/* Document Upload & Vector DB Inspector */}
          <div className="flex flex-col gap-4 mt-2">
            <DocumentUpload />
            <VectorDBInspector />
          </div>

          </div>

        {/* Right Column: Multi-Agent Interface */}
        <div className="col-span-1 lg:col-span-7 h-full flex items-end">
           <Chat />
        </div>
      </div>

    </main>
  );
}
