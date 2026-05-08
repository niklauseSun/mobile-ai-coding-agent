import { create } from 'zustand';

type SessionState = {
  gitProviderLabel: string;
  setGitProviderLabel: (gitProviderLabel: string) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  gitProviderLabel: 'GitHub planned',
  setGitProviderLabel: (gitProviderLabel) => set({ gitProviderLabel }),
}));

