import { create } from 'zustand';
import type { Truck } from '@/types';
import { supabase } from '@/lib/supabase';
import { seedTrucks } from '@/lib/seedData';

interface TruckState {
  trucks: Truck[];
  loaded: boolean;
  addTruck: (truck: Omit<Truck, 'id'>) => void;
  updateTruck: (id: string, updates: Partial<Truck>) => void;
  deleteTruck: (id: string) => void;
  getTruck: (id: string) => Truck | undefined;
  getActiveTrucks: () => Truck[];
  fetchTrucks: () => Promise<void>;
}

function generateId(): string {
  return `trk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useTruckStore = create<TruckState>()((set, get) => ({
  trucks: [],
  loaded: false,
  fetchTrucks: async () => {
    const { data, error } = await supabase.from('dispatch_trucks').select('*').order('number');
    if (error) { console.error('Failed to fetch trucks:', error); return; }
    if (data.length === 0) {
      await supabase.from('dispatch_trucks').upsert(seedTrucks);
      set({ trucks: seedTrucks, loaded: true });
    } else {
      set({ trucks: data as Truck[], loaded: true });
    }
  },
  addTruck: async (truck) => {
    const newTruck = { ...truck, id: generateId() };
    set((state) => ({ trucks: [...state.trucks, newTruck] }));
    await supabase.from('dispatch_trucks').insert(newTruck);
  },
  updateTruck: async (id, updates) => {
    set((state) => ({ trucks: state.trucks.map((t) => (t.id === id ? { ...t, ...updates } : t)) }));
    await supabase.from('dispatch_trucks').update(updates).eq('id', id);
  },
  deleteTruck: async (id) => {
    set((state) => ({ trucks: state.trucks.filter((t) => t.id !== id) }));
    await supabase.from('dispatch_trucks').delete().eq('id', id);
  },
  getTruck: (id) => get().trucks.find((t) => t.id === id),
  getActiveTrucks: () => get().trucks.filter((t) => t.status === 'active'),
}));

supabase
  .channel('dispatch_trucks_changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_trucks' }, () => {
    useTruckStore.getState().fetchTrucks();
  })
  .subscribe();
