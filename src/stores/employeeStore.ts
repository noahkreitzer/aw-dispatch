import { create } from 'zustand';
import type { Employee } from '@/types';
import { supabase } from '@/lib/supabase';
import { seedEmployees } from '@/lib/seedData';

interface EmployeeState {
  employees: Employee[];
  loaded: boolean;
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  bulkImportEmployees: (employees: Omit<Employee, 'id'>[]) => void;
  getEmployee: (id: string) => Employee | undefined;
  getActiveEmployees: () => Employee[];
  getDrivers: () => Employee[];
  getSlingers: () => Employee[];
  fetchEmployees: () => Promise<void>;
}

function generateId(): string {
  return `emp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useEmployeeStore = create<EmployeeState>()((set, get) => ({
  employees: [],
  loaded: false,
  fetchEmployees: async () => {
    const { data, error } = await supabase.from('dispatch_employees').select('*').order('name');
    if (error) { console.error('Failed to fetch employees:', error); return; }
    if (data.length === 0) {
      // Seed initial data
      const seedRows = seedEmployees.map((e) => ({
        id: e.id, name: e.name, role: e.role, phone: e.phone, active: e.active,
        can_drive: e.canDrive ?? false,
      }));
      const { error: seedError } = await supabase.from('dispatch_employees').upsert(seedRows);
      if (seedError) console.error('Failed to seed employees:', seedError);
      set({ employees: seedEmployees, loaded: true });
    } else {
      // Map snake_case DB columns to camelCase
      const mapped = data.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        name: row.name as string,
        role: row.role as 'driver' | 'slinger',
        phone: row.phone as string,
        active: row.active as boolean,
        canDrive: (row.can_drive as boolean) ?? false,
      }));
      set({ employees: mapped, loaded: true });
    }
  },
  addEmployee: async (emp) => {
    const newEmp = { ...emp, id: generateId() };
    set((state) => ({ employees: [...state.employees, newEmp] }));
    const dbRow = { id: newEmp.id, name: newEmp.name, role: newEmp.role, phone: newEmp.phone, active: newEmp.active, can_drive: newEmp.canDrive ?? false };
    await supabase.from('dispatch_employees').insert(dbRow);
  },
  updateEmployee: async (id, updates) => {
    set((state) => ({
      employees: state.employees.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    }));
    // Map canDrive -> can_drive for DB
    const dbUpdates: Record<string, unknown> = { ...updates };
    if ('canDrive' in dbUpdates) {
      dbUpdates.can_drive = dbUpdates.canDrive;
      delete dbUpdates.canDrive;
    }
    await supabase.from('dispatch_employees').update(dbUpdates).eq('id', id);
  },
  deleteEmployee: async (id) => {
    set((state) => ({ employees: state.employees.filter((e) => e.id !== id) }));
    await supabase.from('dispatch_employees').delete().eq('id', id);
  },
  bulkImportEmployees: async (newEmployees) => {
    const state = get();
    const existing = new Map(state.employees.map((e) => [e.name.toLowerCase(), e]));
    const result = [...state.employees];
    const toUpsert: Employee[] = [];
    for (const emp of newEmployees) {
      const key = emp.name.toLowerCase();
      const match = existing.get(key);
      if (match) {
        const idx = result.findIndex((e) => e.id === match.id);
        if (idx !== -1) {
          result[idx] = {
            ...result[idx],
            ...(emp.phone ? { phone: emp.phone } : {}),
            ...(emp.role ? { role: emp.role } : {}),
            active: emp.active,
          };
          toUpsert.push(result[idx]);
        }
      } else {
        const newEmp = { ...emp, id: generateId() };
        result.push(newEmp);
        toUpsert.push(newEmp);
      }
    }
    set({ employees: result });
    if (toUpsert.length > 0) {
      await supabase.from('dispatch_employees').upsert(toUpsert);
    }
  },
  getEmployee: (id) => get().employees.find((e) => e.id === id),
  getActiveEmployees: () => get().employees.filter((e) => e.active),
  getDrivers: () => get().employees.filter((e) => e.active && e.role === 'driver'),
  getSlingers: () => get().employees.filter((e) => e.active && e.role === 'slinger'),
}));

// Real-time subscription
supabase
  .channel('dispatch_employees_changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatch_employees' }, () => {
    useEmployeeStore.getState().fetchEmployees();
  })
  .subscribe();
