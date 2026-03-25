import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Assignment, SpareSlot, DayOfWeek } from '@/types';
import { DAYS } from '@/types';

interface ScheduleState {
  assignments: Record<string, Assignment[]>;
  spareSlots: Record<string, SpareSlot[]>; // keyed by weekKey
  getWeekAssignments: (weekKey: string) => Assignment[];
  getAssignment: (weekKey: string, assignmentId: string) => Assignment | undefined;
  setWeekAssignments: (weekKey: string, assignments: Assignment[]) => void;
  upsertAssignment: (weekKey: string, assignment: Assignment) => void;
  updateAssignment: (weekKey: string, assignmentId: string, updates: Partial<Assignment>) => void;
  initWeekFromRoutes: (weekKey: string, routeIds: string[], copyFromWeek?: string) => void;
  copyWeek: (fromWeek: string, toWeek: string) => void;
  // Spare slots
  getWeekSpares: (weekKey: string) => SpareSlot[];
  addToSpare: (weekKey: string, day: DayOfWeek, employeeId: string) => void;
  removeFromSpare: (weekKey: string, day: DayOfWeek, employeeId: string) => void;
}

function generateId(): string {
  return `asgn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function computeStatus(a: Assignment): Assignment['status'] {
  if (a.status === 'off') return 'off';
  if (a.driverId && a.truckId) return 'ready';
  return 'incomplete';
}

function ensureSpareSlots(weekKey: string, existing: SpareSlot[]): SpareSlot[] {
  if (existing.length === DAYS.length) return existing;
  const daySet = new Set(existing.map((s) => s.day));
  const result = [...existing];
  for (const day of DAYS) {
    if (!daySet.has(day)) {
      result.push({ id: `spare_${weekKey}_${day}`, weekKey, day, employeeIds: [] });
    }
  }
  return result;
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      assignments: {},
      spareSlots: {},
      getWeekAssignments: (weekKey) => get().assignments[weekKey] ?? [],
      getAssignment: (weekKey, assignmentId) =>
        (get().assignments[weekKey] ?? []).find((a) => a.id === assignmentId),
      setWeekAssignments: (weekKey, assignments) =>
        set((state) => ({
          assignments: { ...state.assignments, [weekKey]: assignments },
        })),
      upsertAssignment: (weekKey, assignment) =>
        set((state) => {
          const existing = state.assignments[weekKey] ?? [];
          const idx = existing.findIndex((a) => a.id === assignment.id);
          const updated = idx >= 0
            ? existing.map((a, i) => (i === idx ? assignment : a))
            : [...existing, assignment];
          return { assignments: { ...state.assignments, [weekKey]: updated } };
        }),
      updateAssignment: (weekKey, assignmentId, updates) =>
        set((state) => {
          const existing = state.assignments[weekKey] ?? [];
          const updated = existing.map((a) => {
            if (a.id !== assignmentId) return a;
            const merged = { ...a, ...updates };
            return { ...merged, status: computeStatus(merged) };
          });
          return { assignments: { ...state.assignments, [weekKey]: updated } };
        }),
      initWeekFromRoutes: (weekKey, routeIds, copyFromWeek) =>
        set((state) => {
          if (state.assignments[weekKey]?.length) return state;
          const prevAssignments = copyFromWeek ? (state.assignments[copyFromWeek] ?? []) : [];
          const assignments: Assignment[] = routeIds.map((routeId) => {
            const prev = prevAssignments.find((p) => p.routeId === routeId && p.status !== 'off');
            const a: Assignment = {
              id: generateId(),
              weekKey,
              routeId,
              truckId: prev?.truckId ?? null,
              driverId: prev?.driverId ?? null,
              slingerIds: prev?.slingerIds ?? [],
              status: 'incomplete' as const,
              notes: '',
            };
            return { ...a, status: computeStatus(a) };
          });
          // Copy spare slots from source week
          const prevSpares = copyFromWeek ? (state.spareSlots[copyFromWeek] ?? []) : [];
          const spares = ensureSpareSlots(weekKey, prevSpares.map((s) => ({
            ...s, id: `spare_${weekKey}_${s.day}`, weekKey,
          })));
          return {
            assignments: { ...state.assignments, [weekKey]: assignments },
            spareSlots: { ...state.spareSlots, [weekKey]: spares },
          };
        }),
      copyWeek: (fromWeek, toWeek) =>
        set((state) => {
          const source = state.assignments[fromWeek] ?? [];
          const copied: Assignment[] = source.map((a) => ({
            ...a,
            id: generateId(),
            weekKey: toWeek,
          }));
          const sourceSpares = state.spareSlots[fromWeek] ?? [];
          const copiedSpares: SpareSlot[] = sourceSpares.map((s) => ({
            ...s,
            id: `spare_${toWeek}_${s.day}`,
            weekKey: toWeek,
          }));
          return {
            assignments: { ...state.assignments, [toWeek]: copied },
            spareSlots: { ...state.spareSlots, [toWeek]: ensureSpareSlots(toWeek, copiedSpares) },
          };
        }),
      getWeekSpares: (weekKey) => {
        const existing = get().spareSlots[weekKey] ?? [];
        return ensureSpareSlots(weekKey, existing);
      },
      addToSpare: (weekKey, day, employeeId) =>
        set((state) => {
          const existing = ensureSpareSlots(weekKey, state.spareSlots[weekKey] ?? []);
          const updated = existing.map((s) => {
            if (s.day !== day) return s;
            if (s.employeeIds.includes(employeeId)) return s;
            return { ...s, employeeIds: [...s.employeeIds, employeeId] };
          });
          return { spareSlots: { ...state.spareSlots, [weekKey]: updated } };
        }),
      removeFromSpare: (weekKey, day, employeeId) =>
        set((state) => {
          const existing = ensureSpareSlots(weekKey, state.spareSlots[weekKey] ?? []);
          const updated = existing.map((s) => {
            if (s.day !== day) return s;
            return { ...s, employeeIds: s.employeeIds.filter((id) => id !== employeeId) };
          });
          return { spareSlots: { ...state.spareSlots, [weekKey]: updated } };
        }),
    }),
    { name: 'aw-schedule' }
  )
);
