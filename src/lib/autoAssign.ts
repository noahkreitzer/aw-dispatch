import type { Assignment, Route, Employee, Truck, DayOfWeek, VacationSlot, SpareSlot } from '@/types';

interface AutoAssignInput {
  weekKey: string;
  assignments: Assignment[];
  routes: Route[];
  employees: Employee[];
  trucks: Truck[];
  vacationSlots: VacationSlot[];
  spareSlots: SpareSlot[];
  prevAssignments?: Assignment[]; // previous week for pattern matching
}

export interface AutoAssignResult {
  assignments: Assignment[];
  changes: string[]; // human-readable log of what changed
}

/**
 * Smart auto-assign: fills in missing drivers, trucks, and slingers.
 *
 * Algorithm:
 * 1. Build vacation set per day — skip assigning anyone who is off
 * 2. Build spare set per day — skip assigning anyone in spare pool
 * 3. For each day, sort assignments by route type priority (residential > commercial > recycling > roll-off)
 * 4. Assign drivers: prefer previous-week driver for same route, else least-assigned driver for the day
 * 5. Assign trucks: prefer previous-week truck for same route, else best-fit by type
 * 6. Assign slingers: prefer previous-week slingers, else least-assigned for the day
 * 7. Track per-day usage to prevent double-booking within a day
 */
export function autoAssign(input: AutoAssignInput): AutoAssignResult {
  const { assignments, routes, employees, trucks, vacationSlots, spareSlots, prevAssignments = [] } = input;
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

  // Build previous-week lookup: routeId -> assignment
  const prevByRoute = new Map<string, Assignment>();
  for (const pa of prevAssignments) {
    if (pa.status !== 'off') prevByRoute.set(pa.routeId, pa);
  }

  // Truck type preferences for route types
  const truckTypePreference: Record<string, string[]> = {
    residential: ['rear-load', 'side-load'],
    commercial: ['rear-load', 'side-load'],
    recycling: ['recycling', 'side-load', 'rear-load'],
    'roll-off': ['roll-off'],
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

    // Assign drivers
    for (const idx of sortedIndices) {
      const a = result[idx];
      if (a.driverId) continue; // already assigned

      const route = routes.find((r) => r.id === a.routeId);
      if (!route) continue;

      // Prefer previous week's driver for this route
      const prev = prevByRoute.get(a.routeId);
      if (prev?.driverId && !usedDrivers.has(prev.driverId) && !unavailable.has(prev.driverId)) {
        const emp = activeDrivers.find((e) => e.id === prev.driverId);
        if (emp) {
          a.driverId = prev.driverId;
          usedDrivers.add(prev.driverId);
          changes.push(`${day}: ${route.name} driver = ${emp.name} (prev week)`);
          continue;
        }
      }

      // Find least-busy available driver
      const available = activeDrivers.filter(
        (e) => !usedDrivers.has(e.id) && !unavailable.has(e.id)
      );
      if (available.length > 0) {
        // Count how many routes each driver has across ALL days this week (workload balance)
        const driverLoad = new Map<string, number>();
        for (const ra of result) {
          if (ra.driverId) driverLoad.set(ra.driverId, (driverLoad.get(ra.driverId) ?? 0) + 1);
        }
        available.sort((a, b) => (driverLoad.get(a.id) ?? 0) - (driverLoad.get(b.id) ?? 0));
        const chosen = available[0];
        a.driverId = chosen.id;
        usedDrivers.add(chosen.id);
        changes.push(`${day}: ${route.name} driver = ${chosen.name}`);
      }
    }

    // Assign trucks
    for (const idx of sortedIndices) {
      const a = result[idx];
      if (a.truckId) continue; // already assigned

      const route = routes.find((r) => r.id === a.routeId);
      if (!route) continue;

      // Prefer previous week's truck for this route
      const prev = prevByRoute.get(a.routeId);
      if (prev?.truckId && !usedTrucks.has(prev.truckId)) {
        const truck = activeTrucks.find((t) => t.id === prev.truckId);
        if (truck) {
          a.truckId = prev.truckId;
          usedTrucks.add(prev.truckId);
          changes.push(`${day}: ${route.name} truck = #${truck.number} (prev week)`);
          continue;
        }
      }

      // Find best-fit truck by type preference
      const prefs = truckTypePreference[route.type] ?? [];
      let chosen: typeof activeTrucks[0] | undefined;
      for (const pref of prefs) {
        chosen = activeTrucks.find((t) => t.type === pref && !usedTrucks.has(t.id));
        if (chosen) break;
      }
      // Fallback: any available truck
      if (!chosen) {
        chosen = activeTrucks.find((t) => !usedTrucks.has(t.id));
      }
      if (chosen) {
        a.truckId = chosen.id;
        usedTrucks.add(chosen.id);
        changes.push(`${day}: ${route.name} truck = #${chosen.number}`);
      }
    }

    // Assign slingers (skip roll-off routes — they typically don't need slingers)
    for (const idx of sortedIndices) {
      const a = result[idx];
      const route = routes.find((r) => r.id === a.routeId);
      if (!route) continue;
      if (route.type === 'roll-off') continue; // roll-off doesn't need slingers
      if (a.slingerIds.length >= 1) continue; // already has at least 1

      // Prefer previous week's slinger
      const prev = prevByRoute.get(a.routeId);
      if (prev && prev.slingerIds.length > 0) {
        for (const sid of prev.slingerIds) {
          if (!usedSlingers.has(sid) && !unavailable.has(sid)) {
            const emp = activeSlingers.find((e) => e.id === sid);
            if (emp) {
              a.slingerIds = [...a.slingerIds, sid];
              usedSlingers.add(sid);
              changes.push(`${day}: ${route.name} slinger = ${emp.name} (prev week)`);
              break; // one slinger is usually enough
            }
          }
        }
      }

      // If still no slinger, find least-busy available
      if (a.slingerIds.length === 0) {
        const available = activeSlingers.filter(
          (e) => !usedSlingers.has(e.id) && !unavailable.has(e.id)
          // Don't assign someone who is already driving this day
          && !usedDrivers.has(e.id)
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
          changes.push(`${day}: ${route.name} slinger = ${chosen.name}`);
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
