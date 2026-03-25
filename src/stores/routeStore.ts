import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Route, DayOfWeek } from '@/types';
import { seedRoutes } from '@/lib/seedData';

interface RouteState {
  routes: Route[];
  addRoute: (route: Omit<Route, 'id'>) => void;
  updateRoute: (id: string, updates: Partial<Route>) => void;
  deleteRoute: (id: string) => void;
  getRoute: (id: string) => Route | undefined;
  getRoutesByDay: (day: DayOfWeek) => Route[];
  getActiveRoutes: () => Route[];
}

function generateId(): string {
  return `rte_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useRouteStore = create<RouteState>()(
  persist(
    (set, get) => ({
      routes: seedRoutes,
      addRoute: (route) =>
        set((state) => ({
          routes: [...state.routes, { ...route, id: generateId() }],
        })),
      updateRoute: (id, updates) =>
        set((state) => ({
          routes: state.routes.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),
      deleteRoute: (id) =>
        set((state) => ({
          routes: state.routes.filter((r) => r.id !== id),
        })),
      getRoute: (id) => get().routes.find((r) => r.id === id),
      getRoutesByDay: (day) => get().routes.filter((r) => r.active && r.day === day),
      getActiveRoutes: () => get().routes.filter((r) => r.active),
    }),
    { name: 'aw-routes' }
  )
);
