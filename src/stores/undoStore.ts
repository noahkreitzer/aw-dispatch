import { create } from 'zustand';
import type { Assignment, SpareSlot, VacationSlot } from '@/types';

export interface Snapshot {
  weekKey: string;
  assignments: Assignment[];
  spareSlots: SpareSlot[];
  vacationSlots: VacationSlot[];
  label: string; // human-readable description
  timestamp: number;
}

interface UndoState {
  past: Snapshot[];
  future: Snapshot[];
  maxHistory: number;
  pushSnapshot: (snapshot: Snapshot) => void;
  undo: () => Snapshot | null;
  redo: () => Snapshot | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

export const useUndoStore = create<UndoState>()((set, get) => ({
  past: [],
  future: [],
  maxHistory: 50,

  pushSnapshot: (snapshot) => {
    set((state) => {
      const past = [...state.past, snapshot];
      // Trim history if exceeding max
      if (past.length > state.maxHistory) past.shift();
      return { past, future: [] }; // clear future on new action
    });
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return null;
    const past = [...state.past];
    const snapshot = past.pop()!;
    set({ past, future: [snapshot, ...state.future] });
    return snapshot;
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return null;
    const future = [...state.future];
    const snapshot = future.shift()!;
    set({ past: [...state.past, snapshot], future });
    return snapshot;
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  clear: () => set({ past: [], future: [] }),
}));
