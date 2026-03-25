-- AW Dispatch Schema
-- Run this in the Supabase SQL Editor

-- Employees
CREATE TABLE IF NOT EXISTS dispatch_employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('driver', 'slinger')),
  phone TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  can_drive BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trucks
CREATE TABLE IF NOT EXISTS dispatch_trucks (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rear-load', 'side-load', 'roll-off', 'recycling')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'out-of-service', 'maintenance')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Routes
CREATE TABLE IF NOT EXISTS dispatch_routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  municipality TEXT NOT NULL DEFAULT '',
  day TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('residential', 'commercial', 'recycling', 'roll-off')),
  stops INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  biweekly BOOLEAN DEFAULT false,
  biweekly_phase TEXT CHECK (biweekly_phase IN ('even', 'odd')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assignments (crew assigned to routes per week)
CREATE TABLE IF NOT EXISTS dispatch_assignments (
  id TEXT PRIMARY KEY,
  week_key TEXT NOT NULL,
  route_id TEXT NOT NULL REFERENCES dispatch_routes(id) ON DELETE CASCADE,
  truck_id TEXT REFERENCES dispatch_trucks(id) ON DELETE SET NULL,
  driver_id TEXT REFERENCES dispatch_employees(id) ON DELETE SET NULL,
  slinger_ids TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN ('ready', 'incomplete', 'off')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Spare slots (extra crew per day per week)
CREATE TABLE IF NOT EXISTS dispatch_spare_slots (
  id TEXT PRIMARY KEY,
  week_key TEXT NOT NULL,
  day TEXT NOT NULL,
  employee_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Vacation slots (crew on vacation per day per week)
CREATE TABLE IF NOT EXISTS dispatch_vacation_slots (
  id TEXT PRIMARY KEY,
  week_key TEXT NOT NULL,
  day TEXT NOT NULL,
  employee_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Settings
CREATE TABLE IF NOT EXISTS dispatch_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assignments_week ON dispatch_assignments(week_key);
CREATE INDEX IF NOT EXISTS idx_spare_slots_week ON dispatch_spare_slots(week_key);
CREATE INDEX IF NOT EXISTS idx_vacation_slots_week ON dispatch_vacation_slots(week_key);

-- Enable Row Level Security (allow all for now - internal tool)
ALTER TABLE dispatch_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_spare_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_vacation_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON dispatch_employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON dispatch_trucks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON dispatch_routes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON dispatch_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON dispatch_spare_slots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON dispatch_vacation_slots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON dispatch_settings FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_spare_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_employees;
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_trucks;
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_routes;
ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_vacation_slots;
