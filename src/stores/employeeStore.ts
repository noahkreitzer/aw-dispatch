import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Employee } from '@/types';
import { seedEmployees } from '@/lib/seedData';

interface EmployeeState {
  employees: Employee[];
  addEmployee: (emp: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  bulkImportEmployees: (employees: Omit<Employee, 'id'>[]) => void;
  getEmployee: (id: string) => Employee | undefined;
  getActiveEmployees: () => Employee[];
  getDrivers: () => Employee[];
  getSlingers: () => Employee[];
}

function generateId(): string {
  return `emp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useEmployeeStore = create<EmployeeState>()(
  persist(
    (set, get) => ({
      employees: seedEmployees,
      addEmployee: (emp) =>
        set((state) => ({
          employees: [...state.employees, { ...emp, id: generateId() }],
        })),
      updateEmployee: (id, updates) =>
        set((state) => ({
          employees: state.employees.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        })),
      deleteEmployee: (id) =>
        set((state) => ({
          employees: state.employees.filter((e) => e.id !== id),
        })),
      bulkImportEmployees: (newEmployees) =>
        set((state) => {
          const existing = new Map(state.employees.map((e) => [e.name.toLowerCase(), e]));
          const result = [...state.employees];
          for (const emp of newEmployees) {
            const key = emp.name.toLowerCase();
            const match = existing.get(key);
            if (match) {
              // Update existing employee with new data (only non-empty fields)
              const idx = result.findIndex((e) => e.id === match.id);
              if (idx !== -1) {
                result[idx] = {
                  ...result[idx],
                  ...(emp.phone ? { phone: emp.phone } : {}),
                  ...(emp.role ? { role: emp.role } : {}),
                  active: emp.active,
                };
              }
            } else {
              result.push({ ...emp, id: generateId() });
            }
          }
          return { employees: result };
        }),
      getEmployee: (id) => get().employees.find((e) => e.id === id),
      getActiveEmployees: () => get().employees.filter((e) => e.active),
      getDrivers: () => get().employees.filter((e) => e.active && e.role === 'driver'),
      getSlingers: () => get().employees.filter((e) => e.active && e.role === 'slinger'),
    }),
    { name: 'aw-employees' }
  )
);
