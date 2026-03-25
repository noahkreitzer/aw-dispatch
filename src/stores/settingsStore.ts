import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { defaultDispatchTemplate } from '@/lib/seedData';

interface SettingsState {
  companyName: string;
  dispatchTemplate: string;
  weekStartDay: 'Monday' | 'Sunday';
  setCompanyName: (name: string) => void;
  setDispatchTemplate: (template: string) => void;
  setWeekStartDay: (day: 'Monday' | 'Sunday') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      companyName: 'Anthracite Waste Services',
      dispatchTemplate: defaultDispatchTemplate,
      weekStartDay: 'Monday',
      setCompanyName: (name) => set({ companyName: name }),
      setDispatchTemplate: (template) => set({ dispatchTemplate: template }),
      setWeekStartDay: (day) => set({ weekStartDay: day }),
    }),
    { name: 'aw-settings' }
  )
);
