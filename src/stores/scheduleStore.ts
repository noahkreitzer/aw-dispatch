import { create } from 'zustand';
import type { Assignment, SpareSlot, DayOfWeek } from '@/types';
import { DAYS } from '@/types';
import { supabase } from '@/lib/supabase';
import { navigateWeek } from '@/lib/weekUtils';

interface ScheduleState {
  assignments: Record<string, Assignment[]>;
  spareSlots: Record<string, SpareSlot[]>;
  getWeekAssignments: (weekKey: string) => Assignment[];
  getAssignment: (weekKey: string, assignmentId: string) => Assignment | undefined;
  setWeekAssignments: (weekKey: string, assignments: Assignment[]) => void;
  upsertAssignment: (weekKey: string, assignment: Assignment) => void;
  updateAssignment: (weekKey: string, assignmentId: string, updates: Partial<Assignment>) => void;
  initWeekFromRoutes: (weekKey: string, routeIds: string[]) => void;
  copyWeek: (fromWeek: string, toWeek: string) => void;
  getWeekSpares: (weekKey: string) => SpareSlot[];
  addToSpare: (weekKey: string, day: DayOfWeek, employeeId: string) => void;
  removeFromSpare: (weekKey: string, day: DayOfWeek, employeeId: string) => void;
  fetchWeek: (weekKey: string) => Promise<void>;
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

// DB mapping helpers
function assignmentFromDb(row: Record<string, unknown>): Assignment {
  return {
    id: row.id as string,
    weekKey: row.week_key as string,
    routeId: row.route_id as string,
    truckId: (row.truck_id as string) || null,
    driverId: (row.driver_id as string) || null,
    slingerIds: (row.slinger_ids as string[]) || [],
    status: row.status as Assignment['status'],
    notes: (row.notes as string) || '',
  };
}

function assignmentToDb(a: Assignment): Record<string, unknown> {
  return {
    id: a.id,
    week_key: a.weekKey,
    route_id: a.routeId,
    truck_id: a.truckId,
    driver_id: a.driverId,
    slinger_ids: a.slingerIds,
    status: a.status,
    notes: a.notes,
    updated_at: new Date().toISOString(),
  };
}

function spareFromDb(row: Record<string, unknown>): SpareSlot {
  return {
    id: row.id as string,
    weekKey: row.week_key as string,
    day: row.day as DayOfWeek,
    employeeIds: (row.employee_ids as string[]) || [],
  };
}

function spareToDb(s: SpareSlot): Record<string, unknown> {
  return {
    id: s.id,
    week_key: s.weekKey,
    day: s.day,
    employee_ids: s.employeeIds,
    updated_at: new Date().toISOString(),
  };
}

export const useScheduleStore = create<ScheduleState>()((set, get) => ({
  assignments: {},
  spareSlots: {},

  fetchWeek: async (weekKey: string) => {
    const [{ data: aData }, { data: sData }] = await Promise.all([
      supabase.from('dispatch_assignments').select('*').eq('week_key', weekKey),
      supabase.from('dispatch_spare_slots').select('*').eq('week_key', weekKey),
    ]);
    if (aData) {
      const assignments = aData.map((r) => assignmentFromDb(r as Record<string, unknown>));
      set((state) => ({ assignments: { ...state.assignments, [weekKey]: assignments } }));
    }
    if (sData) {
      const spares = ensureSpareSlots(weekKey, sData.map((r) => spareFromDb(r as Record<string, unknown>)));
      set((state) => ({ spareSlots: { ...state.spareSlots, [weekKey]: spares } }));
    }
  },

  getWeekAssignments: (weekKey) => get().assignments[weekKey] ?? [],
  getAssignment: (weekKey, assignmentId) =>
    (get().assignments[weekKey] ?? []).find((a) => a.id === assignmentId),

  setWeekAssignments: (weekKey, assignments) =>
    set((state) => ({ assignments: { ...state.assignments, [weekKey]: assignments } })),

  upsertAssignment: (weekKey, assignment) =>
    set((state) => {
      const existing = state.assignments[weekKey] ?? [];
      const idx = existing.findIndex((a) => a.id === assignment.id);
      const updated = idx >= 0
        ? existing.map((a, i) => (i === idx ? assignment : a))
        : [...existing, assignment];
      return { assignments: { ...state.assignments, [weekKey]: updated } };
    }),

  updateAssignment: async (weekKey, assignmentId, updates) => {
    let updatedAssignment: Assignment | undefined;
    set((state) => {
      const existing = state.assignments[weekKey] ?? [];
      const updated = existing.map((a) => {
        if (a.id !== assignmentId) return a;
        const merged = { ...a, ...updates };
        const final = { ...merged, status: computeStatus(merged) };
        updatedAssignment = final;
        return final;
      });
      return { assignments: { ...state.assignments, [weekKey]: updated } };
    });
    if (updatedAssignment) {
      await supabase.from('dispatch_assignments').upsert(assignmentToDb(updatedAssignment));
    }
  },

  initWeekFromRoutes: async (weekKey, routeIds) => {
    const state = get();
    if (state.assignments[weekKey]?.length) return;

    // Check DB first — if week already exists, just fetch it
    const { data: existingDb } = await supabase
      .from('dispatch_assignments').select('id').eq('week_key', weekKey).limit(1);
    if (existingDb && existingDb.length > 0) {
      await get().fetchWeek(weekKey);
      return;
    }

    // Search DB for the most recent previous week with assignments
    let prevAssignments: Assignment[] = [];
    let prevSpares: SpareSlot[] = [];
    let searchWeek = weekKey;
    for (let i = 0; i < 52; i++) {
      searchWeek = navigateWeek(searchWeek, -1);
      const { data: prevData } = await supabase
        .from('dispatch_assignments').select('*').eq('week_key', searchWeek).limit(1);
      if (prevData && prevData.length > 0) {
        // Found a week with data — fetch all assignments from it
        const { data: allPrev } = await supabase
          .from('dispatch_assignments').select('*').eq('week_key', searchWeek);
        const { data: allPrevSpares } = await supabase
          .from('dispatch_spare_slots').select('*').eq('week_key', searchWeek);
        if (allPrev) prevAssignments = allPrev.map((r) => assignmentFromDb(r as Record<string, unknown>));
        if (allPrevSpares) prevSpares = allPrevSpares.map((r) => spareFromDb(r as Record<string, unknown>));
        break;
      }
    }

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

    const spares = ensureSpareSlots(weekKey, prevSpares.map((s) => ({
      ...s, id: `spare_${weekKey}_${s.day}`, weekKey,
    })));

    set((prev) => ({
      assignments: { ...prev.assignments, [weekKey]: assignments },
      spareSlots: { ...prev.spareSlots, [weekKey]: spares },
    }));

    // Save to DB
    const dbAssignments = assignments.map(assignmentToDb);
    const dbSpares = spares.filter((s) => s.employeeIds.length > 0).map(spareToDb);
    await supabase.from('dispatch_assignments').upsert(dbAssignments);
    if (dbSpares.length > 0) {
      await supabase.from('dispatch_spare_slots').upsert(dbSpares);
    }
  },

  copyWeek: async (fromWeek, toWeek) => {
    const state = get();
    const source = state.assignments[fromWeek] ?? [];
    const copied: Assignment[] = source.map((a) => ({
      ...a, id: generateId(), weekKey: toWeek,
    }));
    const sourceSpares = state.spareSlots[fromWeek] ?? [];
    const copiedSpares: SpareSlot[] = sourceSpares.map((s) => ({
      ...s, id: `spare_${toWeek}_${s.day}`, weekKey: toWeek,
    }));
    const spares = ensureSpareSlots(toWeek, copiedSpares);

    set((prev) => ({
      assignments: { ...prev.assignments, [toWeek]: copied },
      spareSlots: { ...prev.spareSlots, [toWeek]: spares },
    }));

    await supabase.from('dispatch_assignments').upsert(copied.map(assignmentToDb));
    const dbSpares = spares.filter((s) => s.employeeIds.length > 0).map(spareToDb);
    if (dbSpares.length > 0) {
      await supabase.from('dispatch_spare_slots').upsert(dbSpares);
    }
  },

  getWeekSpares: (weekKey) => {
    const existing = get().spareSlots[weekKey] ?? [];
    return ensureSpareSlots(weekKey, existing);
  },

  addToSpare: async (weekKey, day, employeeId) => {
    let updatedSlot: SpareSlot | undefined;
    set((state) => {
      const existing = ensureSpareSlots(weekKey, state.spareSlots[weekKey] ?? []);
      const updated = existing.map((s) => {
        if (s.day !== day) return s;
        if (s.employeeIds.includes(employeeId)) return s;
        const u = { ...s, employeeIds: [...s.employeeIds, employeeId] };
        updatedSlot = u;
        return u;
      });
      return { spareSlots: { ...state.spareSlots, [weekKey]: updated } };
    });
    if (updatedSlot) {
      await supabase.from('dispatch_spare_slots').upsert(spareToDb(updatedSlot));
    }
  },

  removeFromSpare: async (weekKey, day, employeeId) => {
    let updatedSlot: SpareSlot | undefined;
    set((state) => {
      const existing = ensureSpareSlots(weekKey, state.spareSlots[weekKey] ?? []);
      const updated = existing.map((s) => {
        if (s.day !== day) return s;
        const u = { ...s, employeeIds: s.employeeIds.filter((id) => id !== employeeId) };
        updatedSlot = u;
        return u;
      });
      return { spareSlots: { ...state.spareSlots, [weekKey]: updated } };
    });
    if (updatedSlot) {
      await supabase.from('dispatch_spare_slots').upsert(spareToDb(updatedSlot));
    }
  },
}));

// Real-time: re-fetch current week when assignments change
supabase
  .channel('dispatch_schedule_changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_assignments' }, (payload) => {
    const weekKey = (payload.new as Record<string, unknown>)?.week_key as string
      || (payload.old as Record<string, unknown>)?.week_key as string;
    if (weekKey) {
      useScheduleStore.getState().fetchWeek(weekKey);
    }
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_spare_slots' }, (payload) => {
    const weekKey = (payload.new as Record<string, unknown>)?.week_key as string
      || (payload.old as Record<string, unknown>)?.week_key as string;
    if (weekKey) {
      useScheduleStore.getState().fetchWeek(weekKey);
    }
  })
  .subscribe();
