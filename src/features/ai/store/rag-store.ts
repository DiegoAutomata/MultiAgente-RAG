import { create } from 'zustand';

interface RagState {
  activeAgent: 'idle' | 'user' | 'semantic-router' | 'investigator' | 'redactor' | 'auditor' | 'indexing';
  setActiveAgent: (agent: RagState['activeAgent']) => void;

  documentUploaded: boolean;
  setDocumentUploaded: (status: boolean) => void;

  isUploadingDocument: boolean;
  setIsUploadingDocument: (status: boolean) => void;

  // Triggers a re-fetch in VectorDBInspector when updated
  lastRefreshAt: number;
  triggerRefresh: () => void;
}

export const useRagStore = create<RagState>((set) => ({
  activeAgent: 'idle',
  setActiveAgent: (agent) => set({ activeAgent: agent }),

  documentUploaded: false,
  setDocumentUploaded: (status) => set({ documentUploaded: status }),

  isUploadingDocument: false,
  setIsUploadingDocument: (status) => set({ isUploadingDocument: status }),

  lastRefreshAt: 0,
  triggerRefresh: () => set({ lastRefreshAt: Date.now() }),
}));
