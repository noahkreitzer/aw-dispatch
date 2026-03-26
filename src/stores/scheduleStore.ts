import { create } from 'zustand';
import type { Assignment, SpareSlot, VacationSlot, DayOfWeek } from '@/types';
import { DAYS } from '@/types';
import { supabase } from '@/lib/supabase';


interface ScheduleState {
  assignments: Record<string, Assignment[]>;
  spareSlots: Record<string, SpareSlot[]>;
  vacationSlots: Record<string, VacationSlot[]>;
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
  getWeekVacations: (weekKey: string) => VacationSlot[];
  addToVacation: (weekKey: string, day: DayOfWeek, employeeId: string) => void;
  removeFromVacation: (weekKey: string, day: DayOfWeek, employeeId: string) => void;
  fetchWeek: (weekKey: string) => Promise<void>;
  importWeekAssignments: (weekKey: string, assignments: Array<{
    id: string; week_key: string; route_id: string;
    driver_id: string | null; truck_id: string | null;
    slinger_ids: string[]; status: string; notes: string;
  }>) => Promise<void>;
}

const initInProgress = new Set<string>();

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

function ensureVacationSlots(weekKey: string, existing: VacationSlot[]): VacationSlot[] {
  if (existing.length === DAYS.length) return existing;
  const daySet = new Set(existing.map((s) => s.day));
  const result = [...existing];
  for (const day of DAYS) {
    if (!daySet.has(day)) {
      result.push({ id: `vac_${weekKey}_${day}`, weekKey, day, employeeIds: [] });
    }
  }
  return result;
}

function vacationFromDb(row: Record<string, unknown>): VacationSlot {
  return {
    id: row.id as string,
    weekKey: row.week_key as string,
    day: row.day as DayOfWeek,
    employeeIds: (row.employee_ids as string[]) || [],
  };
}

function vacationToDb(s: VacationSlot): Record<string, unknown> {
  return {
    id: s.id,
    week_key: s.weekKey,
    day: s.day,
    employee_ids: s.employeeIds,
    updated_at: new Date().toISOString(),
  };
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
  vacationSlots: {},

  fetchWeek: async (weekKey: string) => {
    const [{ data: aData }, { data: sData }, { data: vData }] = await Promise.all([
      supabase.from('dispatch_assignments').select('*').eq('week_key', weekKey),
      supabase.from('dispatch_spare_slots').select('*').eq('week_key', weekKey),
      supabase.from('dispatch_vacation_slots').select('*').eq('week_key', weekKey),
    ]);
    if (aData) {
      const assignments = aData.map((r) => assignmentFromDb(r as Record<string, unknown>));
      set((state) => ({ assignments: { ...state.assignments, [weekKey]: assignments } }));
    }
    if (sData) {
      const spares = ensureSpareSlots(weekKey, sData.map((r) => spareFromDb(r as Record<string, unknown>)));
      set((state) => ({ spareSlots: { ...state.spareSlots, [weekKey]: spares } }));
    }
    if (vData) {
      const vacations = ensureVacationSlots(weekKey, vData.map((r) => vacationFromDb(r as Record<string, unknown>)));
      set((state) => ({ vacationSlots: { ...state.vacationSlots, [weekKey]: vacations } }));
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
    if (initInProgress.has(weekKey)) return;
    initInProgress.add(weekKey);
    try {
    // Double-check after acquiring the lock (StrictMode may have populated it)
    const state = get();
    if (state.assignments[weekKey]?.length) return;

    // Check DB first — if week already exists, just fetch it
    const { data: existingDb } = await supabase
      .from('dispatch_assignments').select('id').eq('week_key', weekKey).limit(1);
    if (existingDb && existingDb.length > 0) {
      await get().fetchWeek(weekKey);
      return;
    }

    // Find the TWO most recent previous weeks with assignments
    // (covers both biweekly phases so crew copies correctly for alternating routes)
    let prevAssignments: Assignment[] = [];
    let prevSpares: SpareSlot[] = [];
    const { data: recentWeeks } = await supabase
      .from('dispatch_assignments')
      .select('week_key')
      .lt('week_key', weekKey)
      .order('week_key', { ascending: false });
    // Get unique week keys (up to 2)
    const uniqueWeekKeys: string[] = [];
    if (recentWeeks) {
      for (const row of recentWeeks) {
        const wk = row.week_key as string;
        if (!uniqueWeekKeys.includes(wk)) uniqueWeekKeys.push(wk);
        if (uniqueWeekKeys.length >= 2) break;
      }
    }
    if (uniqueWeekKeys.length > 0) {
      // Fetch assignments from both weeks, prefer the more recent one per routeId
      const [{ data: allPrev }, { data: allPrevSpares }] = await Promise.all([
        supabase.from('dispatch_assignments').select('*').in('week_key', uniqueWeekKeys),
        supabase.from('dispatch_spare_slots').select('*').eq('week_key', uniqueWeekKeys[0]),
      ]);
      if (allPrev) {
        const allMapped = allPrev.map((r) => assignmentFromDb(r as Record<string, unknown>));
        // For each routeId, prefer the assignment from the most recent week
        const byRoute = new Map<string, Assignment>();
        // Process older week first, then newer week overwrites
        for (const wk of [...uniqueWeekKeys].reverse()) {
          for (const a of allMapped.filter((m) => m.weekKey === wk)) {
            byRoute.set(a.routeId, a);
          }
        }
        prevAssignments = Array.from(byRoute.values());
      }
      if (allPrevSpares) prevSpares = allPrevSpares.map((r) => spareFromDb(r as Record<string, unknown>));
    }

    // Also fetch routes so we can de-conflict by day
    const { data: routeData } = await supabase.from('dispatch_routes').select('id,day');
    const routeDayMap = new Map<string, string>();
    if (routeData) {
      for (const r of routeData) routeDayMap.set(r.id as string, r.day as string);
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

    // De-conflict: if a driver/truck/slinger is on multiple routes the same day,
    // keep the one from the MOST RECENT week and clear the duplicates.
    // This happens when a driver switched routes between weeks.
    const prevWeekLookup = new Map<string, string>(); // routeId → weekKey it came from
    for (const pa of prevAssignments) {
      prevWeekLookup.set(pa.routeId, pa.weekKey);
    }
    const mostRecentWeek = uniqueWeekKeys[0] ?? '';

    // Group by day
    const byDay = new Map<string, Assignment[]>();
    for (const a of assignments) {
      const day = routeDayMap.get(a.routeId) ?? '';
      if (!day) continue;
      const list = byDay.get(day) ?? [];
      list.push(a);
      byDay.set(day, list);
    }

    for (const [, dayAssignments] of byDay) {
      // De-conflict drivers
      const driverSeen = new Map<string, Assignment[]>();
      for (const a of dayAssignments) {
        if (!a.driverId) continue;
        const list = driverSeen.get(a.driverId) ?? [];
        list.push(a);
        driverSeen.set(a.driverId, list);
      }
      for (const [, dups] of driverSeen) {
        if (dups.length <= 1) continue;
        // Keep the one from the most recent week, clear the rest
        for (const a of dups) {
          const srcWeek = prevWeekLookup.get(a.routeId) ?? '';
          if (srcWeek !== mostRecentWeek) {
            a.driverId = null;
            a.status = computeStatus(a);
          }
        }
      }

      // De-conflict trucks
      const truckSeen = new Map<string, Assignment[]>();
      for (const a of dayAssignments) {
        if (!a.truckId) continue;
        const list = truckSeen.get(a.truckId) ?? [];
        list.push(a);
        truckSeen.set(a.truckId, list);
      }
      for (const [, dups] of truckSeen) {
        if (dups.length <= 1) continue;
        for (const a of dups) {
          const srcWeek = prevWeekLookup.get(a.routeId) ?? '';
          if (srcWeek !== mostRecentWeek) {
            a.truckId = null;
            a.status = computeStatus(a);
          }
        }
      }

      // De-conflict slingers
      const slingerSeen = new Map<string, Assignment[]>();
      for (const a of dayAssignments) {
        for (const sid of a.slingerIds) {
          const list = slingerSeen.get(sid) ?? [];
          list.push(a);
          slingerSeen.set(sid, list);
        }
      }
      for (const [sid, dups] of slingerSeen) {
        if (dups.length <= 1) continue;
        for (const a of dups) {
          const srcWeek = prevWeekLookup.get(a.routeId) ?? '';
          if (srcWeek !== mostRecentWeek) {
            a.slingerIds = a.slingerIds.filter((id) => id !== sid);
          }
        }
      }
    }

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
    } finally {
      initInProgress.delete(weekKey);
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

    // Delete old data first, then insert new
    await supabase.from('dispatch_assignments').delete().eq('week_key', toWeek);
    await supabase.from('dispatch_spare_slots').delete().eq('week_key', toWeek);
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

  getWeekVacations: (weekKey) => {
    const existing = get().vacationSlots[weekKey] ?? [];
    return ensureVacationSlots(weekKey, existing);
  },

  addToVacation: async (weekKey, day, employeeId) => {
    let updatedSlot: VacationSlot | undefined;
    set((state) => {
      const existing = ensureVacationSlots(weekKey, state.vacationSlots[weekKey] ?? []);
      const updated = existing.map((s) => {
        if (s.day !== day) return s;
        if (s.employeeIds.includes(employeeId)) return s;
        const u = { ...s, employeeIds: [...s.employeeIds, employeeId] };
        updatedSlot = u;
        return u;
      });
      return { vacationSlots: { ...state.vacationSlots, [weekKey]: updated } };
    });
    if (updatedSlot) {
      await supabase.from('dispatch_vacation_slots').upsert(vacationToDb(updatedSlot));
    }
  },

  importWeekAssignments: async (weekKey, assignments) => {
    // Delete existing assignments for this week
    await supabase.from('dispatch_assignments').delete().eq('week_key', weekKey);

    // Insert new assignments in batches
    for (let i = 0; i < assignments.length; i += 50) {
      const batch = assignments.slice(i, i + 50).map((a) => ({
        id: a.id,
        week_key: a.week_key,
        route_id: a.route_id,
        driver_id: a.driver_id,
        truck_id: a.truck_id,
        slinger_ids: a.slinger_ids,
        status: a.status,
        notes: a.notes,
        updated_at: new Date().toISOString(),
      }));
      await supabase.from('dispatch_assignments').upsert(batch);
    }

    // Re-fetch to update local state
    await get().fetchWeek(weekKey);
  },

  removeFromVacation: async (weekKey, day, employeeId) => {
    let updatedSlot: VacationSlot | undefined;
    set((state) => {
      const existing = ensureVacationSlots(weekKey, state.vacationSlots[weekKey] ?? []);
      const updated = existing.map((s) => {
        if (s.day !== day) return s;
        const u = { ...s, employeeIds: s.employeeIds.filter((id) => id !== employeeId) };
        updatedSlot = u;
        return u;
      });
      return { vacationSlots: { ...state.vacationSlots, [weekKey]: updated } };
    });
    if (updatedSlot) {
      await supabase.from('dispatch_vacation_slots').upsert(vacationToDb(updatedSlot));
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
  .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_vacation_slots' }, (payload) => {
    const weekKey = (payload.new as Record<string, unknown>)?.week_key as string
      || (payload.old as Record<string, unknown>)?.week_key as string;
    if (weekKey) {
      useScheduleStore.getState().fetchWeek(weekKey);
    }
  })
  .subscribe();
