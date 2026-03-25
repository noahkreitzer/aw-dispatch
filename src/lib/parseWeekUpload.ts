// Parse a weekly Excel spreadsheet (same format as anthracite dashboard)
// and extract crew assignments (driver, slingers, truck per route per day)

import * as XLSX from 'xlsx';

const DAY_SHEETS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const COLUMN_MAP: Record<string, string> = {
  'Route': 'route',
  'Driver': 'driver',
  'Slinger 1': 'slinger_1',
  'Slinger 2': 'slinger_2',
  'Slinger 3': 'slinger_3',
  'Truck': 'truck',
};

const ROUTE_FIXES: Record<string, string> = {
  'Mcadoo Trash': 'McAdoo Trash',
  'Mcadoo Recycle': 'McAdoo Recycle',
  'Sheppton': 'Sheppton/Oneida',
  'Eagle Rock Recycle': 'Hazle/Eagle Rock Recycling',
  'Freeland Recycle': 'Hazle/Freeland Recycling',
  'Shenandoah Heights/Subsciption': 'Shenandoah Heights/Subscription',
};

// Route name → route ID mapping per day (must match seedData.ts)
const ROUTE_MAP: Record<string, Record<string, string>> = {
  Monday: {
    'Pottsville Trash': 'r1', 'Pottsville Recycling': 'r2',
    'McAdoo Trash': 'r3', 'McAdoo Recycle': 'r4',
    'Hazle Township Trash': 'r5', 'Hazle Township Recycling': 'r6',
    'Hazle/Eagle Rock Recycling': 'r6',
    'East Side/Eagle Rock': 'r7',
    'West Hazleton Trash': 'r8', 'West Hazleton Recycling': 'r9',
    'Sheppton/Oneida': 'r10', 'Little Truck': 'r11',
  },
  Tuesday: {
    'Freeland Trash': 'r12', 'Hazle Township Trash': 'r13',
    'Hazle Township Recycling': 'r14', 'Mahanoy City Recycle': 'r15',
    'Orwigsburg Trash': 'r16', 'Orwigsburg Recycling': 'r16b',
    'Pottsville Recycling': 'r17', 'Pottsville Trash': 'r18',
    'Schuylkill Haven Trash': 'r19',
    'Packer': 'r20', 'Packer Township': 'r20', 'Little Truck': 'r21',
  },
  Wednesday: {
    'Cressona Recycling': 'r22', 'Cressona Trash': 'r23',
    'Hazle Township Trash': 'r24', 'Hazle Township Recycling': 'r25',
    'Pottsville Recycling': 'r26', 'Pottsville Trash': 'r27',
    'Schuylkill Haven Trash': 'r28',
    'West Hazleton Trash': 'r29', 'West Hazleton Recycling': 'r30',
    'Little Truck': 'r31',
  },
  Thursday: {
    'Branch Township Trash': 'r32',
    'Freeland Recycle': 'r33', 'Hazle/Freeland Recycling': 'r33',
    'Hazle Township Trash': 'r34', 'Mahanoy City Trash': 'r35',
    'Newport Township Trash': 'r36',
    'Pottsville Recycling': 'r37', 'Pottsville Trash': 'r38',
    'Schuylkill Haven Recycling': 'r39', 'Little Truck': 'r40',
  },
  Friday: {
    'Frackville/Subscription': 'r41', 'Gordon Trash/Subscription': 'r42',
    'Hazle Township Recycling': 'r43', 'Hazle Township Trash': 'r44',
    'Newport Township Trash': 'r45',
    'Orwigsburg Trash': 'r46', 'Orwigsburg Recycling': 'r46b',
    'Pottsville Recycling': 'r47', 'Pottsville Trash': 'r48',
    'Shenandoah Heights/Subscription': 'r49',
    'Subscription': 'r50', 'Little Truck': 'r51',
  },
};

function normalizeRoute(route: string): string {
  const trimmed = route.trim();
  if (ROUTE_FIXES[trimmed]) return ROUTE_FIXES[trimmed];
  return trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseOneDate(str: string): Date | null {
  if (!str) return null;
  const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return null;
  let [, month, day, year] = m;
  if (!year) return null;
  if (year.length === 2) year = '20' + year;
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return isNaN(d.getTime()) ? null : d;
}

function inferStartDate(dateRange: string | null): string | null {
  if (!dateRange) return null;
  const cleaned = dateRange.replace(/^week\s+of:?\s*/i, '').trim();
  const parts = cleaned.split(/\s*(?:to|-)\s*/).filter((s) => s.length > 0);
  let startStr = (parts[0] || '').replace(/^\/+/, '');
  startStr = startStr.replace(/(\d{1,2})\/(\d{1,2})-(\d{2,4})$/, '$1/$2/$3');
  const d = parseOneDate(startStr);
  return d ? d.toISOString().split('T')[0] : null;
}

function dateToWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export interface ParsedCrewRow {
  day: string;
  routeName: string;
  routeId: string | null;
  driver: string | null;
  slinger1: string | null;
  slinger2: string | null;
  slinger3: string | null;
  truck: string | null;
}

export interface ParsedWeekData {
  weekKey: string;
  weekLabel: string;
  startDate: string;
  rows: ParsedCrewRow[];
}

export function parseWeeklyExcel(buffer: ArrayBuffer, fileName: string): ParsedWeekData | null {
  const wb = XLSX.read(buffer, { type: 'array' });

  let dateRange: string | null = null;
  let weekLabel: string | null = null;
  const rows: ParsedCrewRow[] = [];

  for (const dayName of DAY_SHEETS) {
    const sheet = wb.Sheets[dayName];
    if (!sheet) continue;

    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
    if (raw.length < 3) continue;

    // Row 0 = week label/date, Row 1 = headers, Row 2+ = data
    const rawLabel = raw[0]?.[0] as string | null;
    const rawDate = (raw[0]?.[13] as string | null) || rawLabel;
    if (!weekLabel && rawLabel) weekLabel = String(rawLabel);
    if (!dateRange && rawDate) dateRange = String(rawDate);

    const headers = (raw[1] || []) as string[];
    const colIndices: Record<string, number> = {};
    headers.forEach((h, i) => {
      const key = COLUMN_MAP[String(h).trim()];
      if (key) colIndices[key] = i;
    });

    for (let r = 2; r < raw.length; r++) {
      const row = raw[r] as unknown[];
      if (!row) continue;

      const driverVal = colIndices.driver !== undefined ? row[colIndices.driver] : null;
      if (!driverVal || String(driverVal).trim() === '') continue;

      const routeRaw = colIndices.route !== undefined ? row[colIndices.route] : null;
      if (!routeRaw) continue;

      let routeName = normalizeRoute(String(routeRaw));

      // Day-aware recycling bundling
      if (routeName === 'Hazle Township Recycling') {
        if (dayName === 'Monday') routeName = 'Hazle/Eagle Rock Recycling';
        else if (dayName === 'Thursday') routeName = 'Hazle/Freeland Recycling';
      }

      // Find route ID
      const dayRoutes = ROUTE_MAP[dayName] ?? {};
      let routeId = dayRoutes[routeName] ?? null;
      if (!routeId) {
        const lower = routeName.toLowerCase();
        for (const [name, id] of Object.entries(dayRoutes)) {
          if (name.toLowerCase().includes(lower) || lower.includes(name.toLowerCase())) {
            routeId = id;
            break;
          }
        }
      }

      const truckVal = colIndices.truck !== undefined ? row[colIndices.truck] : null;

      rows.push({
        day: dayName,
        routeName,
        routeId,
        driver: String(driverVal).trim(),
        slinger1: colIndices.slinger_1 !== undefined ? (row[colIndices.slinger_1] ? String(row[colIndices.slinger_1]).trim() : null) : null,
        slinger2: colIndices.slinger_2 !== undefined ? (row[colIndices.slinger_2] ? String(row[colIndices.slinger_2]).trim() : null) : null,
        slinger3: colIndices.slinger_3 !== undefined ? (row[colIndices.slinger_3] ? String(row[colIndices.slinger_3]).trim() : null) : null,
        truck: truckVal ? String(truckVal).trim() : null,
      });
    }
  }

  if (rows.length === 0) return null;

  const startDate = inferStartDate(dateRange) ?? new Date().toISOString().split('T')[0];
  const weekKey = dateToWeekKey(startDate);

  // Build a clean week label
  if (!weekLabel) weekLabel = `Upload ${fileName}`;

  return { weekKey, weekLabel, startDate, rows };
}
