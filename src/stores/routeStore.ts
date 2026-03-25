import { create } from 'zustand';
import type { Route } from '@/types';
import { supabase } from '@/lib/supabase';
import { seedRoutes } from '@/lib/seedData';

interface RouteState {
  routes: Route[];
  loaded: boolean;
  addRoute: (route: Omit<Route, 'id'>) => void;
  updateRoute: (id: string, updates: Partial<Route>) => void;
  deleteRoute: (id: string) => void;
  getRoute: (id: string) => Route | undefined;
  fetchRoutes: () => Promise<void>;
}

function generateId(): string {
  return `rt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function fromDb(row: Record<string, unknown>): Route {
  return {
    id: row.id as string,
    name: row.name as string,
    municipality: row.municipality as string,
    day: row.day as Route['day'],
    type: row.type as Route['type'],
    stops: row.stops as number,
    active: row.active as boolean,
    biweekly: row.biweekly as boolean | undefined,
    biweeklyPhase: row.biweekly_phase as Route['biweeklyPhase'],
  };
}

function toDb(route: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...route };
  if ('biweeklyPhase' in result) {
    result.biweekly_phase = result.biweeklyPhase;
    delete result.biweeklyPhase;
  }
  return result;
}

export const useRouteStore = create<RouteState>()((set, get) => ({
  routes: [],
  loaded: false,
  fetchRoutes: async () => {
    const { data, error } = await supabase.from('dispatch_routes').select('*').order('day').order('name');
    if (error) { console.error('Failed to fetch routes:', error); return; }
    if (data.length === 0) {
      const dbRows = seedRoutes.map((r) => toDb(r as unknown as Record<string, unknown>));
      await supabase.from('dispatch_routes').upsert(dbRows);
      set({ routes: seedRoutes, loaded: true });
    } else {
      set({ routes: data.map((d) => fromDb(d as Record<string, unknown>)), loaded: true });
    }
  },
  addRoute: async (route) => {
    const newRoute = { ...route, id: generateId() } as Route;
    set((state) => ({ routes: [...state.routes, newRoute] }));
    await supabase.from('dispatch_routes').insert(toDb(newRoute as unknown as Record<string, unknown>));
  },
  updateRoute: async (id, updates) => {
    set((state) => ({ routes: state.routes.map((r) => (r.id === id ? { ...r, ...updates } : r)) }));
    await supabase.from('dispatch_routes').update(toDb(updates as unknown as Record<string, unknown>)).eq('id', id);
  },
  deleteRoute: async (id) => {
    set((state) => ({ routes: state.routes.filter((r) => r.id !== id) }));
    await supabase.from('dispatch_routes').delete().eq('id', id);
  },
  getRoute: (id) => get().routes.find((r) => r.id === id),
}));

supabase
  .channel('dispatch_routes_changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_routes' }, () => {
    useRouteStore.getState().fetchRoutes();
  })
  .subscribe();
