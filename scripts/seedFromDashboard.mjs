// Seed aw-dispatch Supabase with real crew assignments from anthracite dashboard data
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://sjhwwkguvjeyrnnwhojl.supabase.co',
  'sb_publishable_yV7pucsQwHKk8f02zBi00A_cHouedtw'
);

// Employee name → id mapping
const EMP = {
  'Akeem Campbell': 'e1', 'Bob Earls': 'e2', 'Bryant Umholtz': 'e3',
  'Collin Roberts': 'e4', 'Garrett Boyle': 'e5', 'Jesse Kreitzer': 'e6',
  'Joseph Langlois': 'e7', 'Justin Eisenhart': 'e8', 'Keith Eisenhart': 'e9',
  'Matt Conelin': 'e10', 'Rich Kreitzer': 'e11', 'Ryan Andruchek': 'e12',
  'Thomas Franklin': 'e13', 'Tom Pusavage': 'e14',
  'Adam Cragen': 's1', "Anthony D'Agostino": 's2', 'Cash': 's3',
  'Dave Brode': 's4', 'Evan': 's5', 'George': 's6',
  'Jack Weinrich': 's7', 'Jhonny Diaz': 's8', 'Joey Stanchek': 's9',
  'Jon Yuskoski': 's10', 'Magnum Kline': 's11', 'Marshall': 's12',
  'Noah R': 's13', 'Patrick Weins': 's14', "Thomas O'Donnell": 's15',
  'Tommy Leedum': 's16', 'Wilkin Duran': 's17',
};

// Truck number → id mapping
const TRUCK = {
  '101': 't1', '102': 't2', '103': 't3', '105': 't4', '106': 't5',
  '107': 't6', '109': 't7', '110': 't8', '111': 't9', '112': 't10',
  '113': 't11', '114': 't12', '150': 't13', '402': 't14',
};

// Route assignments based on real dashboard data (most recent 2 weeks: W9+W10)
// Each person assigned to ONE route per day only (no duplicates)
// Format: { routeId, driverId, truckId, slingerIds[] }

const CREW_MAP = {
  // === MONDAY ===
  'r1':  { driver: 'Akeem Campbell',   truck: '114', slingers: ['Wilkin Duran'] },
  'r2':  { driver: 'Joseph Langlois',  truck: '109', slingers: ['Magnum Kline', 'Jon Yuskoski'] }, // even only
  'r3':  { driver: 'Keith Eisenhart',  truck: '103', slingers: ['Adam Cragen', 'Marshall'] },
  'r4':  { driver: 'Tom Pusavage',     truck: '105', slingers: ['Jack Weinrich'] },
  'r5':  { driver: 'Bob Earls',        truck: '112', slingers: ["Anthony D'Agostino", 'George'] },
  'r6':  { driver: 'Garrett Boyle',    truck: '107', slingers: ["Thomas O'Donnell"] },
  'r7':  { driver: 'Rich Kreitzer',    truck: '113', slingers: ['Jhonny Diaz'] },
  'r8':  { driver: 'Collin Roberts',   truck: '102', slingers: ['Dave Brode'] },
  'r9':  { driver: 'Ryan Andruchek',   truck: '110', slingers: ['Noah R'] },
  'r10': { driver: 'Matt Conelin',     truck: '106', slingers: ['Joey Stanchek'] },
  'r11': { driver: 'Bryant Umholtz',   truck: '150', slingers: [] },

  // === TUESDAY ===
  'r12': { driver: 'Rich Kreitzer',    truck: '113', slingers: ['Jhonny Diaz', 'Dave Brode'] },
  'r13': { driver: 'Bob Earls',        truck: '112', slingers: ["Anthony D'Agostino", 'George'] },
  'r14': { driver: 'Bob Earls',        truck: '107', slingers: ['Jhonny Diaz'] }, // different crew on recycling days
  'r15': { driver: 'Ryan Andruchek',   truck: '110', slingers: ['Jack Weinrich', 'Noah R'] },
  'r16': { driver: 'Jesse Kreitzer',   truck: '111', slingers: ['Patrick Weins'] },
  'r16b':{ driver: 'Jesse Kreitzer',   truck: '111', slingers: ['Patrick Weins'] }, // odd only - Orwigsburg Recycling
  'r17': { driver: 'Joseph Langlois',  truck: '109', slingers: ['Magnum Kline', 'Jon Yuskoski'] }, // even only
  'r18': { driver: 'Akeem Campbell',   truck: '114', slingers: ['Wilkin Duran'] },
  'r19': { driver: 'Keith Eisenhart',  truck: '103', slingers: ['Joey Stanchek'] },
  'r20': { driver: 'Garrett Boyle',    truck: '402', slingers: [] },
  'r21': { driver: 'Bryant Umholtz',   truck: '150', slingers: [] },

  // === WEDNESDAY ===
  'r22': { driver: 'Jesse Kreitzer',   truck: '111', slingers: ['Patrick Weins'] },
  'r23': { driver: 'Keith Eisenhart',  truck: '103', slingers: ['Joey Stanchek'] },
  'r24': { driver: 'Bob Earls',        truck: '112', slingers: ["Anthony D'Agostino", 'George'] },
  'r25': { driver: 'Bob Earls',        truck: '107', slingers: ['Dave Brode'] },
  'r26': { driver: 'Joseph Langlois',  truck: '109', slingers: ['Magnum Kline', 'Jon Yuskoski'] }, // even only
  'r27': { driver: 'Akeem Campbell',   truck: '114', slingers: ['Wilkin Duran'] },
  'r28': { driver: 'Keith Eisenhart',  truck: '103', slingers: ['Joey Stanchek'] },
  'r29': { driver: 'Collin Roberts',   truck: '102', slingers: ['Noah R'] },
  'r30': { driver: 'Ryan Andruchek',   truck: '110', slingers: ['Jack Weinrich'] },
  'r31': { driver: 'Bryant Umholtz',   truck: '150', slingers: [] },

  // === THURSDAY ===
  'r32': { driver: 'Garrett Boyle',    truck: '402', slingers: [] },
  'r33': { driver: 'Rich Kreitzer',    truck: '113', slingers: ['Jhonny Diaz', "Thomas O'Donnell"] },
  'r34': { driver: 'Bob Earls',        truck: '112', slingers: ["Anthony D'Agostino", 'George'] },
  'r35': { driver: 'Ryan Andruchek',   truck: '110', slingers: ['Jon Yuskoski', 'Noah R'] },
  'r36': { driver: 'Tom Pusavage',     truck: '105', slingers: ['Cash'] },
  'r37': { driver: 'Joseph Langlois',  truck: '109', slingers: ['Magnum Kline'] }, // even only
  'r38': { driver: 'Akeem Campbell',   truck: '114', slingers: ['Wilkin Duran'] },
  'r39': { driver: 'Jesse Kreitzer',   truck: '111', slingers: ['Adam Cragen', 'Joey Stanchek'] },
  'r40': { driver: 'Bryant Umholtz',   truck: '150', slingers: [] },

  // === FRIDAY ===
  'r41': { driver: 'Keith Eisenhart',  truck: '110', slingers: ['Joey Stanchek'] },
  'r42': { driver: 'Garrett Boyle',    truck: '402', slingers: [] },
  'r43': { driver: 'Bob Earls',        truck: '107', slingers: ['Dave Brode'] },
  'r44': { driver: 'Bob Earls',        truck: '112', slingers: ["Anthony D'Agostino", 'George'] },
  'r45': { driver: 'Tom Pusavage',     truck: '105', slingers: ["Thomas O'Donnell", 'Cash'] },
  'r46': { driver: 'Jesse Kreitzer',   truck: '111', slingers: ['Patrick Weins'] },
  'r46b':{ driver: 'Jesse Kreitzer',   truck: '111', slingers: ['Patrick Weins'] }, // odd only - Orwigsburg Recycling
  'r47': { driver: 'Joseph Langlois',  truck: '109', slingers: ['Magnum Kline', 'Jon Yuskoski'] }, // even only
  'r48': { driver: 'Akeem Campbell',   truck: '114', slingers: ['Wilkin Duran'] },
  'r49': { driver: 'Collin Roberts',   truck: '102', slingers: ['Adam Cragen'] },
  'r50': { driver: 'Matt Conelin',     truck: '106', slingers: ['Jack Weinrich'] },
  'r51': { driver: 'Bryant Umholtz',   truck: '150', slingers: [] },
};

// Biweekly route phases
const BIWEEKLY = {
  'r2': 'even', 'r17': 'even', 'r26': 'even', 'r37': 'even', 'r47': 'even',     // Pottsville Recycling
  'r16b': 'odd', 'r46b': 'odd',                                                     // Orwigsburg Recycling
};

// Saturday route
const SATURDAY_ROUTE = 'r52';

function getWeekPhase(weekKey) {
  const weekNum = parseInt(weekKey.split('-W')[1]);
  return weekNum % 2 === 0 ? 'even' : 'odd';
}

function generateId() {
  return `asgn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function seedWeek(weekKey) {
  const phase = getWeekPhase(weekKey);
  console.log(`\nSeeding ${weekKey} (${phase === 'even' ? 'A/Pottsville' : 'B/Orwigsburg'} week)...`);

  // Delete existing assignments for this week
  await sb.from('dispatch_assignments').delete().eq('week_key', weekKey);
  await sb.from('dispatch_spare_slots').delete().eq('week_key', weekKey);

  const assignments = [];

  for (const [routeId, crew] of Object.entries(CREW_MAP)) {
    if (routeId === SATURDAY_ROUTE) continue;

    // Skip biweekly routes not active this phase
    if (BIWEEKLY[routeId] && BIWEEKLY[routeId] !== phase) continue;

    const driverId = EMP[crew.driver] || null;
    const truckId = TRUCK[crew.truck] || null;
    const slingerIds = crew.slingers
      .map(name => EMP[name])
      .filter(Boolean);

    const status = (driverId && truckId) ? 'ready' : 'incomplete';

    assignments.push({
      id: generateId(),
      week_key: weekKey,
      route_id: routeId,
      driver_id: driverId,
      truck_id: truckId,
      slinger_ids: slingerIds,
      status,
      notes: '',
      updated_at: new Date().toISOString(),
    });

    // Small delay to ensure unique IDs
    await new Promise(r => setTimeout(r, 2));
  }

  console.log(`  Created ${assignments.length} assignments`);

  // Insert in batches of 50
  for (let i = 0; i < assignments.length; i += 50) {
    const batch = assignments.slice(i, i + 50);
    const { error } = await sb.from('dispatch_assignments').upsert(batch);
    if (error) {
      console.error(`  Error inserting batch ${i}:`, error);
    }
  }

  const ready = assignments.filter(a => a.status === 'ready').length;
  console.log(`  ${ready} ready, ${assignments.length - ready} incomplete`);
}

async function main() {
  console.log('Seeding aw-dispatch with real crew data from anthracite dashboard...\n');

  // Seed several weeks so auto-copy has data to work with
  // W10 (3/2, even/A) through W13 (3/23, odd/B)
  const weeks = ['2026-W10', '2026-W11', '2026-W12', '2026-W13'];

  for (const week of weeks) {
    await seedWeek(week);
  }

  console.log('\nDone! All weeks seeded with real crew assignments.');
  console.log('Future weeks will auto-copy from these.');
}

main().catch(console.error);
