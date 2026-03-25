export interface Employee {
  id: string;
  name: string;
  role: 'driver' | 'slinger';
  phone: string;
  active: boolean;
}

export interface Truck {
  id: string;
  number: string;
  type: 'rear-load' | 'side-load' | 'roll-off' | 'recycling';
  status: 'active' | 'out-of-service' | 'maintenance';
}

export interface Route {
  id: string;
  name: string;
  municipality: string;
  day: DayOfWeek;
  type: 'residential' | 'commercial' | 'recycling' | 'roll-off';
  stops: number;
  active: boolean;
  biweekly?: boolean; // if true, alternates weeks (even/odd)
  biweeklyPhase?: 'even' | 'odd'; // which weeks it runs on
}

export interface Assignment {
  id: string;
  weekKey: string;
  routeId: string;
  truckId: string | null;
  driverId: string | null;
  slingerIds: string[];
  status: 'ready' | 'incomplete' | 'off';
  notes: string;
}

// Spare slot is a special assignment with no route — just holds extra crew for the day
export interface SpareSlot {
  id: string;
  weekKey: string;
  day: DayOfWeek;
  employeeIds: string[];
}

// Vacation slot — employees off for the day
export interface VacationSlot {
  id: string;
  weekKey: string;
  day: DayOfWeek;
  employeeIds: string[];
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

export const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const TRUCK_TYPES = ['rear-load', 'side-load', 'roll-off', 'recycling'] as const;
export const TRUCK_STATUSES = ['active', 'out-of-service', 'maintenance'] as const;
export const ROUTE_TYPES = ['residential', 'commercial', 'recycling', 'roll-off'] as const;
