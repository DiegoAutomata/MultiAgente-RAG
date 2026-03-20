import { create } from 'zustand';

interface RagState {
  activeAgent: 'idle' | 'user' | 'semantic-router' | 'investigator' | 'redactor' | 'auditor';
  setActiveAgent: (agent: RagState['activeAgent']) => void;
  
  documentUploaded: boolean;
  setDocumentUploaded: (status: boolean) => void;

  isUploadingDocument: boolean;
  setIsUploadingDocument: (status: boolean) => void;
}

export const useRagStore = create<RagState>((set) => ({
  activeAgent: 'idle',
  setActiveAgent: (agent) => set({ activeAgent: agent }),
  
  documentUploaded: false,
  setDocumentUploaded: (status) => set({ documentUploaded: status }),

  isUploadingDocument: false,
  setIsUploadingDocument: (status) => set({ isUploadingDocument: status }),
}));
