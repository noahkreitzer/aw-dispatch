import type { DayOfWeek } from '@/types';

export function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getWeekDays(weekKey: string): Date[] {
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);

  const days: Date[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    days.push(d);
  }
  return days;
}

export function getWeekDateRange(weekKey: string): string {
  const days = getWeekDays(weekKey);
  const first = days[0];
  const last = days[days.length - 1];
  const fmt = (d: Date) =>
    `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
  return `${fmt(first)} – ${fmt(last)}`;
}

export function getDayName(date: Date): DayOfWeek {
  const names: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as unknown as DayOfWeek[];
  return names[date.getUTCDay()];
}

export function navigateWeek(weekKey: string, direction: number): string {
  const days = getWeekDays(weekKey);
  const monday = days[0];
  // Use local Date constructor to avoid UTC/local mismatch in getISOWeekKey
  const target = new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + direction * 7);
  return getISOWeekKey(target);
}

export function formatDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** Returns 'even' or 'odd' based on the ISO week number */
export function getWeekPhase(weekKey: string): 'even' | 'odd' {
  const weekNum = parseInt(weekKey.split('-W')[1]);
  return weekNum % 2 === 0 ? 'even' : 'odd';
}
