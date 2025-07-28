import { create } from "zustand";

type Store = {
  communicationRef: React.RefObject<any> | null;
  setCommunicationRef: (ref: React.RefObject<any>) => void;
};

export const connStore = create<Store>((set) => ({
  communicationRef: null,
  setCommunicationRef: (ref) => set({ communicationRef: ref }),
}));
