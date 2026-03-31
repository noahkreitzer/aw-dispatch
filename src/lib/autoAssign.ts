import type { Assignment, Route, Employee, Truck, DayOfWeek, VacationSlot, SpareSlot } from '@/types';

interface AutoAssignInput {
  weekKey: string;
  weekPhase: 'even' | 'odd';
  assignments: Assignment[];
  routes: Route[];
  employees: Employee[];
  trucks: Truck[];
  vacationSlots: VacationSlot[];
  spareSlots: SpareSlot[];
  /** Assignments from the previous same-phase week (2 weeks ago) — primary source for driver logs */
  prevSamePhaseAssignments: Assignment[];
  /** Assignments from the immediately previous week — fallback for non-biweekly routes */
  prevWeekAssignments: Assignment[];
}

export interface AutoAssignResult {
  assignments: Assignment[];
  changes: string[]; // human-readable log of what changed
}

/** Tag an assignment's notes with an [auto] marker for balanced/fallback fills */
function addAutoTag(notes: string, tag: string): string {
  const existing = notes ? notes.replace(/\[auto:.*?\]/g, '').trim() : '';
  const tags = notes.match(/\[auto:(.*?)\]/g)?.map((t) => t.slice(6, -1)) ?? [];
  tags.push(tag);
  const autoStr = tags.map((t) => `[auto:${t}]`).join('');
  return existing ? `${existing} ${autoStr}` : autoStr;
}

/** Check if an employee was auto-filled (balanced fallback, not from driver logs) */
export function isAutoFilled(notes: string, employeeId: string): boolean {
  return notes?.includes(`[auto:driver:${employeeId}]`) || notes?.includes(`[auto:slinger:${employeeId}]`) || false;
}

/**
 * Smart auto-assign: fills in missing drivers, trucks, and slingers
 * based on the DRIVER LOGS from the previous same-phase week.
 *
 * Algorithm:
 * 1. For biweekly routes (recycling): use same-phase previous week's driver logs
 *    - If W14 is even (Pottsville), pull from W12 (also even/Pottsville)
 *    - If W15 is odd (Orwigsburg), pull from W13 (also odd/Orwigsburg)
 * 2. For regular (non-biweekly) routes: prefer immediately previous week, fallback to same-phase
 * 3. Build vacation/spare exclusion sets per day
 * 4. Track per-day usage to prevent double-booking
 * 5. Assign drivers → trucks → slingers in priority order
 * 6. Balance workload for any remaining unmatched slots
 */
export function autoAssign(input: AutoAssignInput): AutoAssignResult {
  const {
    assignments, routes, employees, trucks,
    vacationSlots, spareSlots,
    prevSamePhaseAssignments, prevWeekAssignments,
  } = input;
  const changes: string[] = [];
  const result = assignments.map((a) => ({ ...a })); // clone

  const activeDrivers = employees.filter((e) => e.active && (e.role === 'driver' || e.canDrive));
  const activeSlingers = employees.filter((e) => e.active && e.role === 'slinger');
  const activeTrucks = trucks.filter((t) => t.status === 'active');

  // Build vacation/spare lookup per day
  const vacationByDay = new Map<DayOfWeek, Set<string>>();
  for (const v of vacationSlots) {
    vacationByDay.set(v.day, new Set(v.employeeIds));
  }
  const spareByDay = new Map<DayOfWeek, Set<string>>();
  for (const s of spareSlots) {
    spareByDay.set(s.day, new Set(s.employeeIds));
  }

  // Build previous-week lookups: routeId -> assignment
  // Same-phase is the primary source (matches biweekly recycling rotation)
  const prevSamePhaseByRoute = new Map<string, Assignment>();
  for (const pa of prevSamePhaseAssignments) {
    if (pa.status !== 'off') prevSamePhaseByRoute.set(pa.routeId, pa);
  }
  // Immediately previous week as fallback
  const prevWeekByRoute = new Map<string, Assignment>();
  for (const pa of prevWeekAssignments) {
    if (pa.status !== 'off') prevWeekByRoute.set(pa.routeId, pa);
  }

  /**
   * Get the best previous assignment for a route based on its type:
   * - Biweekly routes → same-phase week (because that's when this route last ran)
   * - Regular routes → immediately previous week first, then same-phase fallback
   */
  function getPrevAssignment(routeId: string): Assignment | undefined {
    const route = routes.find((r) => r.id === routeId);
    if (route?.biweekly) {
      // Biweekly route: ONLY same-phase has this route's driver logs
      return prevSamePhaseByRoute.get(routeId);
    }
    // Regular route: prefer most recent (prev week), fallback to same-phase
    return prevWeekByRoute.get(routeId) ?? prevSamePhaseByRoute.get(routeId);
  }

  // Truck type preferences for route types
  const truckTypePreference: Record<string, string[]> = {
    residential: ['rear-load', 'side-load'],
    commercial: ['rear-load', 'side-load'],
    recycling: ['rear-load', 'side-load'],
  };

  // Group result assignments by day
  const dayGroups = new Map<DayOfWeek, number[]>(); // day -> indices into result[]
  for (let i = 0; i < result.length; i++) {
    const a = result[i];
    if (a.status === 'off') continue;
    const route = routes.find((r) => r.id === a.routeId);
    if (!route) continue;
    const indices = dayGroups.get(route.day) ?? [];
    indices.push(i);
    dayGroups.set(route.day, indices);
  }

  // Process each day independently
  for (const [day, indices] of dayGroups) {
    const vacSet = vacationByDay.get(day) ?? new Set();
    const spareSet = spareByDay.get(day) ?? new Set();
    const unavailable = new Set([...vacSet, ...spareSet]);

    // Track who is used THIS day to avoid double-booking
    const usedDrivers = new Set<string>();
    const usedSlingers = new Set<string>();
    const usedTrucks = new Set<string>();

    // First pass: collect already-assigned resources
    for (const idx of indices) {
      const a = result[idx];
      if (a.driverId) usedDrivers.add(a.driverId);
      for (const sid of a.slingerIds) usedSlingers.add(sid);
      if (a.truckId) usedTrucks.add(a.truckId);
    }

    // Sort indices by route type priority (residential first, roll-off last)
    const typePriority: Record<string, number> = { residential: 0, commercial: 1, recycling: 2, 'roll-off': 3 };
    const sortedIndices = [...indices].sort((a, b) => {
      const ra = routes.find((r) => r.id === result[a].routeId);
      const rb = routes.find((r) => r.id === result[b].routeId);
      return (typePriority[ra?.type ?? ''] ?? 9) - (typePriority[rb?.type ?? ''] ?? 9);
    });

    // === ASSIGN DRIVERS ===
    for (const idx of sortedIndices) {
      const a = result[idx];
      if (a.driverId) continue; // already assigned

      const route = routes.find((r) => r.id === a.routeId);
      if (!route) continue;

      // Use driver logs: get the previous assignment for this route (phase-aware)
      const prev = getPrevAssignment(a.routeId);
      if (prev?.driverId && !usedDrivers.has(prev.driverId) && !unavailable.has(prev.driverId)) {
        const emp = activeDrivers.find((e) => e.id === prev.driverId);
        if (emp) {
          a.driverId = prev.driverId;
          usedDrivers.add(prev.driverId);
          const source = route.biweekly ? 'same-phase log' : 'driver log';
          changes.push(`${day}: ${route.name} driver = ${emp.name} (${source})`);
          continue;
        }
      }

      // Fallback: least-busy available driver — mark as auto-filled
      const available = activeDrivers.filter(
        (e) => !usedDrivers.has(e.id) && !unavailable.has(e.id)
      );
      if (available.length > 0) {
        const driverLoad = new Map<string, number>();
        for (const ra of result) {
          if (ra.driverId) driverLoad.set(ra.driverId, (driverLoad.get(ra.driverId) ?? 0) + 1);
        }
        available.sort((a, b) => (driverLoad.get(a.id) ?? 0) - (driverLoad.get(b.id) ?? 0));
        const chosen = available[0];
        a.driverId = chosen.id;
        usedDrivers.add(chosen.id);
        a.notes = addAutoTag(a.notes, `driver:${chosen.id}`);
        changes.push(`${day}: ${route.name} driver = ${chosen.name} (balanced*)`);
      }
    }

    // === ASSIGN TRUCKS ===
    for (const idx of sortedIndices) {
      const a = result[idx];
      if (a.truckId) continue;

      const route = routes.find((r) => r.id === a.routeId);
      if (!route) continue;

      const prev = getPrevAssignment(a.routeId);
      if (prev?.truckId && !usedTrucks.has(prev.truckId)) {
        const truck = activeTrucks.find((t) => t.id === prev.truckId);
        if (truck) {
          a.truckId = prev.truckId;
          usedTrucks.add(prev.truckId);
          const source = route.biweekly ? 'same-phase log' : 'driver log';
          changes.push(`${day}: ${route.name} truck = #${truck.number} (${source})`);
          continue;
        }
      }

      // Fallback: best-fit truck by type preference
      const prefs = truckTypePreference[route.type] ?? [];
      let chosen: typeof activeTrucks[0] | undefined;
      for (const pref of prefs) {
        chosen = activeTrucks.find((t) => t.type === pref && !usedTrucks.has(t.id));
        if (chosen) break;
      }
      if (!chosen) {
        chosen = activeTrucks.find((t) => !usedTrucks.has(t.id));
      }
      if (chosen) {
        a.truckId = chosen.id;
        usedTrucks.add(chosen.id);
        changes.push(`${day}: ${route.name} truck = #${chosen.number} (type match)`);
      }
    }

    // === ASSIGN SLINGERS (skip roll-off) ===
    for (const idx of sortedIndices) {
      const a = result[idx];
      const route = routes.find((r) => r.id === a.routeId);
      if (!route) continue;
      if (route.type === 'roll-off') continue;
      if (a.slingerIds.length >= 1) continue; // already has at least 1

      // Use slinger logs from phase-aware previous week
      const prev = getPrevAssignment(a.routeId);
      if (prev && prev.slingerIds.length > 0) {
        for (const sid of prev.slingerIds) {
          if (!usedSlingers.has(sid) && !unavailable.has(sid)) {
            const emp = activeSlingers.find((e) => e.id === sid);
            if (emp) {
              a.slingerIds = [...a.slingerIds, sid];
              usedSlingers.add(sid);
              const source = route.biweekly ? 'same-phase log' : 'driver log';
              changes.push(`${day}: ${route.name} slinger = ${emp.name} (${source})`);
              break;
            }
          }
        }
      }

      // Fallback: least-busy available slinger — mark as auto-filled
      if (a.slingerIds.length === 0) {
        const available = activeSlingers.filter(
          (e) => !usedSlingers.has(e.id) && !unavailable.has(e.id)
          && !usedDrivers.has(e.id) // don't assign someone already driving this day
        );
        if (available.length > 0) {
          const slingerLoad = new Map<string, number>();
          for (const ra of result) {
            for (const sid of ra.slingerIds) {
              slingerLoad.set(sid, (slingerLoad.get(sid) ?? 0) + 1);
            }
          }
          available.sort((a, b) => (slingerLoad.get(a.id) ?? 0) - (slingerLoad.get(b.id) ?? 0));
          const chosen = available[0];
          a.slingerIds = [chosen.id];
          usedSlingers.add(chosen.id);
          a.notes = addAutoTag(a.notes, `slinger:${chosen.id}`);
          changes.push(`${day}: ${route.name} slinger = ${chosen.name} (balanced*)`);
        }
      }
    }
  }

  // Recompute statuses
  for (const a of result) {
    if (a.status === 'off') continue;
    a.status = a.driverId && a.truckId ? 'ready' : 'incomplete';
  }

  return { assignments: result, changes };
}
