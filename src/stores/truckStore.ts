import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Truck } from '@/types';
import { seedTrucks } from '@/lib/seedData';

interface TruckState {
  trucks: Truck[];
  addTruck: (truck: Omit<Truck, 'id'>) => void;
  updateTruck: (id: string, updates: Partial<Truck>) => void;
  deleteTruck: (id: string) => void;
  getTruck: (id: string) => Truck | undefined;
  getActiveTrucks: () => Truck[];
}

function generateId(): string {
  return `trk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useTruckStore = create<TruckState>()(
  persist(
    (set, get) => ({
      trucks: seedTrucks,
      addTruck: (truck) =>
        set((state) => ({
          trucks: [...state.trucks, { ...truck, id: generateId() }],
        })),
      updateTruck: (id, updates) =>
        set((state) => ({
          trucks: state.trucks.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),
      deleteTruck: (id) =>
        set((state) => ({
          trucks: state.trucks.filter((t) => t.id !== id),
        })),
      getTruck: (id) => get().trucks.find((t) => t.id === id),
      getActiveTrucks: () => get().trucks.filter((t) => t.status === 'active'),
    }),
    { name: 'aw-trucks' }
  )
);
