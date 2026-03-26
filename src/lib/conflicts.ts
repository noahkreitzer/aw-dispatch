import type { Assignment, Route, DayOfWeek } from '@/types';

export interface Conflict {
  type: 'driver-double-booked' | 'truck-double-booked' | 'slinger-double-booked';
  day: DayOfWeek;
  employeeId?: string;
  employeeName?: string;
  truckId?: string;
  truckNumber?: string;
  assignmentIds: string[];
  routeNames: string[];
}

/**
 * Detect all scheduling conflicts for a week's assignments.
 * Returns a flat array of conflict objects.
 */
export function detectConflicts(
  assignments: Assignment[],
  routes: Route[],
  employees: { id: string; name: string }[],
  trucks: { id: string; number: string }[]
): Conflict[] {
  const conflicts: Conflict[] = [];
  const empMap = new Map(employees.map((e) => [e.id, e.name]));
  const truckMap = new Map(trucks.map((t) => [t.id, t.number]));

  // Group assignments by day
  const byDay = new Map<DayOfWeek, Assignment[]>();
  for (const a of assignments) {
    if (a.status === 'off') continue;
    const route = routes.find((r) => r.id === a.routeId);
    if (!route) continue;
    const list = byDay.get(route.day) ?? [];
    list.push(a);
    byDay.set(route.day, list);
  }

  for (const [day, dayAssignments] of byDay) {
    // Check driver double-booking (same driver on 2+ routes same day)
    const driverSlots = new Map<string, Assignment[]>();
    for (const a of dayAssignments) {
      if (!a.driverId) continue;
      const list = driverSlots.get(a.driverId) ?? [];
      list.push(a);
      driverSlots.set(a.driverId, list);
    }
    for (const [driverId, driverAssignments] of driverSlots) {
      if (driverAssignments.length > 1) {
        conflicts.push({
          type: 'driver-double-booked',
          day,
          employeeId: driverId,
          employeeName: empMap.get(driverId) ?? driverId,
          assignmentIds: driverAssignments.map((a) => a.id),
          routeNames: driverAssignments.map((a) => {
            const r = routes.find((rt) => rt.id === a.routeId);
            return r?.name ?? a.routeId;
          }),
        });
      }
    }

    // Check truck double-booking (same truck on 2+ routes same day)
    const truckSlots = new Map<string, Assignment[]>();
    for (const a of dayAssignments) {
      if (!a.truckId) continue;
      const list = truckSlots.get(a.truckId) ?? [];
      list.push(a);
      truckSlots.set(a.truckId, list);
    }
    for (const [truckId, truckAssignments] of truckSlots) {
      if (truckAssignments.length > 1) {
        conflicts.push({
          type: 'truck-double-booked',
          day,
          truckId,
          truckNumber: truckMap.get(truckId) ?? truckId,
          assignmentIds: truckAssignments.map((a) => a.id),
          routeNames: truckAssignments.map((a) => {
            const r = routes.find((rt) => rt.id === a.routeId);
            return r?.name ?? a.routeId;
          }),
        });
      }
    }

    // Check slinger double-booking (same slinger on 2+ routes same day)
    const slingerSlots = new Map<string, Assignment[]>();
    for (const a of dayAssignments) {
      for (const sid of a.slingerIds) {
        const list = slingerSlots.get(sid) ?? [];
        list.push(a);
        slingerSlots.set(sid, list);
      }
    }
    for (const [slingerId, slingerAssignments] of slingerSlots) {
      if (slingerAssignments.length > 1) {
        conflicts.push({
          type: 'slinger-double-booked',
          day,
          employeeId: slingerId,
          employeeName: empMap.get(slingerId) ?? slingerId,
          assignmentIds: slingerAssignments.map((a) => a.id),
          routeNames: slingerAssignments.map((a) => {
            const r = routes.find((rt) => rt.id === a.routeId);
            return r?.name ?? a.routeId;
          }),
        });
      }
    }
  }

  return conflicts;
}

/**
 * Get conflict IDs for a specific assignment (for badge display)
 */
export function getAssignmentConflicts(assignmentId: string, conflicts: Conflict[]): Conflict[] {
  return conflicts.filter((c) => c.assignmentIds.includes(assignmentId));
}
