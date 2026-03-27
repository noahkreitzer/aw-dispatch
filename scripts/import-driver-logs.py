#!/usr/bin/env python3
"""
Import actual driver log Excel files into Supabase dispatch_assignments.
Maps driver names → employee IDs, route names → route IDs, truck numbers → truck IDs.
Also adds missing duplicate routes (e.g., 2nd Mcadoo Trash crew on Monday).
"""
import json, sys, os
import pandas as pd
import requests

SUPABASE_URL = "https://sjhwwkguvjeyrnnwhojl.supabase.co"
SUPABASE_KEY = "sb_publishable_yV7pucsQwHKk8f02zBi00A_cHouedtw"
HEADERS = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}

def sb_get(table, params=""):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{table}?{params}", headers={**HEADERS, "Prefer": "return=representation"})
    r.raise_for_status()
    return r.json()

def sb_upsert(table, rows):
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{table}", headers={**HEADERS, "Prefer": "resolution=merge-duplicates,return=minimal"}, json=rows)
    if r.status_code >= 400:
        print(f"ERROR upserting to {table}: {r.status_code} {r.text}")
    return r

def sb_delete(table, col, val):
    r = requests.delete(f"{SUPABASE_URL}/rest/v1/{table}?{col}=eq.{val}", headers=HEADERS)
    return r

# Fetch existing data
print("Fetching routes, employees, trucks from Supabase...")
routes = sb_get("dispatch_routes", "select=*&order=day,name")
employees = sb_get("dispatch_employees", "select=*&order=name")
trucks = sb_get("dispatch_trucks", "select=*&order=number")

# Build lookup maps
emp_by_name = {}
for e in employees:
    emp_by_name[e["name"].strip().lower()] = e["id"]
    # Also map last-name-only for slingers like "George", "Cash", "Evan", "Marshall", "Noah R"

truck_by_num = {t["number"]: t["id"] for t in trucks}

route_by_day_name = {}
for r in routes:
    key = (r["day"], r["name"].strip().lower())
    if key not in route_by_day_name:
        route_by_day_name[key] = []
    route_by_day_name[key].append(r["id"])

print(f"  {len(routes)} routes, {len(employees)} employees, {len(trucks)} trucks")
print(f"  Employee names: {list(emp_by_name.keys())[:10]}...")

def find_employee(name):
    if not name or str(name).strip() == "" or str(name) == "nan":
        return None
    name = str(name).strip()
    key = name.lower()
    if key in emp_by_name:
        return emp_by_name[key]
    # Try partial match
    for ename, eid in emp_by_name.items():
        if key in ename or ename in key:
            return eid
    print(f"  WARNING: Employee not found: '{name}'")
    return None

def find_truck(num):
    if not num or str(num).strip() == "" or str(num) == "nan":
        return None
    num = str(int(float(num))) if isinstance(num, (int, float)) else str(num).strip()
    if num in truck_by_num:
        return truck_by_num[num]
    print(f"  WARNING: Truck not found: '{num}'")
    return None

DAY_MAP = {"Monday": "Monday", "Tuesday": "Tuesday", "Wednesday": "Wednesday", "Thursday": "Thursday", "Friday": "Friday"}

def parse_excel_to_assignments(filepath, week_key):
    """Parse a driver log Excel file into assignment records."""
    print(f"\nParsing {filepath} for {week_key}...")
    sheets = pd.read_excel(filepath, sheet_name=None, header=None)

    assignments = []
    route_usage = {}  # track (day, routename) → count for duplicate routes

    for day_name in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]:
        if day_name not in sheets:
            print(f"  Skipping {day_name} (no sheet)")
            continue

        df = sheets[day_name]
        # Find header row (contains "Route", "Driver")
        header_row = None
        for i in range(min(5, len(df))):
            row_vals = [str(v).strip().lower() for v in df.iloc[i] if pd.notna(v)]
            if "route" in row_vals and "driver" in row_vals:
                header_row = i
                break

        if header_row is None:
            print(f"  WARNING: No header row found in {day_name}")
            continue

        # Find column indices
        headers = [str(v).strip().lower() if pd.notna(v) else "" for v in df.iloc[header_row]]
        route_col = headers.index("route") if "route" in headers else 0
        driver_col = headers.index("driver") if "driver" in headers else 1
        slinger1_col = headers.index("slinger 1") if "slinger 1" in headers else 2
        slinger2_col = headers.index("slinger 2") if "slinger 2" in headers else 3
        truck_col = headers.index("truck") if "truck" in headers else None

        day_assignments = []
        for i in range(header_row + 1, len(df)):
            route_name = df.iloc[i, route_col]
            if pd.isna(route_name) or str(route_name).strip() == "":
                continue
            route_name = str(route_name).strip()

            driver_name = df.iloc[i, driver_col] if pd.notna(df.iloc[i, driver_col]) else None
            slinger1 = df.iloc[i, slinger1_col] if slinger1_col < len(df.columns) and pd.notna(df.iloc[i, slinger1_col]) else None
            slinger2 = df.iloc[i, slinger2_col] if slinger2_col < len(df.columns) and pd.notna(df.iloc[i, slinger2_col]) else None
            truck_num = df.iloc[i, truck_col] if truck_col is not None and truck_col < len(df.columns) and pd.notna(df.iloc[i, truck_col]) else None

            # Skip rows with no driver assigned (blank rows in the log)
            if not driver_name or str(driver_name).strip() == "" or str(driver_name) == "nan":
                continue

            driver_name = str(driver_name).strip()

            # Find route ID
            rkey = (day_name, route_name.lower())
            route_ids = route_by_day_name.get(rkey, [])

            # Track usage for duplicate routes
            usage_key = (day_name, route_name.lower())
            usage_count = route_usage.get(usage_key, 0)
            route_usage[usage_key] = usage_count + 1

            if usage_count < len(route_ids):
                route_id = route_ids[usage_count]
            elif len(route_ids) > 0:
                route_id = route_ids[0]  # reuse first if not enough IDs
                print(f"  WARNING: Need additional route for {day_name}/{route_name} (crew #{usage_count+1}), reusing {route_id}")
            else:
                # Try fuzzy match
                found = False
                for (d, n), rids in route_by_day_name.items():
                    if d == day_name and (route_name.lower() in n or n in route_name.lower()):
                        route_id = rids[0]
                        found = True
                        break
                if not found:
                    print(f"  WARNING: Route not found: {day_name}/{route_name}")
                    continue

            driver_id = find_employee(driver_name)
            slinger_ids = []
            if slinger1:
                sid = find_employee(str(slinger1).strip())
                if sid:
                    slinger_ids.append(sid)
            if slinger2:
                sid = find_employee(str(slinger2).strip())
                if sid:
                    slinger_ids.append(sid)

            truck_id = find_truck(truck_num)

            status = "ready" if driver_id and truck_id else "incomplete"

            asgn_id = f"imp_{week_key}_{route_id}_{usage_count}"

            day_assignments.append({
                "id": asgn_id,
                "week_key": week_key,
                "route_id": route_id,
                "driver_id": driver_id,
                "truck_id": truck_id,
                "slinger_ids": slinger_ids,
                "status": status,
                "notes": "",
                "updated_at": "2026-03-26T00:00:00Z"
            })

        print(f"  {day_name}: {len(day_assignments)} assignments parsed")
        assignments.extend(day_assignments)

    return assignments

# Check which routes need duplicates
print("\n--- Checking for missing duplicate routes ---")
needed_dupes = []
for filepath, label in [
    ("/Volumes/Noah SD/Driver Log/030226-030826.xlsx", "W10"),
    ("/Volumes/Noah SD/Driver Log/022326-030126.xlsx", "W9"),
]:
    sheets = pd.read_excel(filepath, sheet_name=None, header=None)
    for day_name in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]:
        if day_name not in sheets:
            continue
        df = sheets[day_name]
        header_row = None
        for i in range(min(5, len(df))):
            row_vals = [str(v).strip().lower() for v in df.iloc[i] if pd.notna(v)]
            if "route" in row_vals and "driver" in row_vals:
                header_row = i
                break
        if header_row is None:
            continue

        route_counts = {}
        for i in range(header_row + 1, len(df)):
            route_name = df.iloc[i, 0]
            driver = df.iloc[i, 1] if len(df.columns) > 1 else None
            if pd.isna(route_name) or str(route_name).strip() == "":
                continue
            if pd.isna(driver) or str(driver).strip() == "" or str(driver) == "nan":
                continue
            rn = str(route_name).strip().lower()
            route_counts[rn] = route_counts.get(rn, 0) + 1

        for rn, count in route_counts.items():
            rkey = (day_name, rn)
            existing = len(route_by_day_name.get(rkey, []))
            if count > existing:
                for extra in range(existing, count):
                    needed_dupes.append((day_name, rn, extra + 1))

# Deduplicate
seen = set()
unique_dupes = []
for d, rn, num in needed_dupes:
    key = (d, rn, num)
    if key not in seen:
        seen.add(key)
        unique_dupes.append((d, rn, num))

if unique_dupes:
    print(f"\nNeed to add {len(unique_dupes)} duplicate route entries:")
    new_routes = []
    for day, rn, num in unique_dupes:
        # Find the original route to copy its properties
        orig_key = (day, rn)
        orig_ids = route_by_day_name.get(orig_key, [])
        if not orig_ids:
            # fuzzy
            for (d, n), rids in route_by_day_name.items():
                if d == day and (rn in n or n in rn):
                    orig_ids = rids
                    break
        if not orig_ids:
            print(f"  SKIP: No original route found for {day}/{rn}")
            continue

        orig = next((r for r in routes if r["id"] == orig_ids[0]), None)
        if not orig:
            continue

        new_id = f"{orig['id']}_{num}"
        print(f"  Adding: {day} / {orig['name']} (crew #{num}) → {new_id}")

        new_route = {
            "id": new_id,
            "name": orig["name"],
            "municipality": orig["municipality"],
            "day": day,
            "type": orig["type"],
            "stops": orig.get("stops", 0),
            "active": True,
        }
        if orig.get("biweekly"):
            new_route["biweekly"] = True
            new_route["biweekly_phase"] = orig.get("biweekly_phase")

        new_routes.append(new_route)

        # Update local lookup
        if orig_key not in route_by_day_name:
            route_by_day_name[orig_key] = []
        route_by_day_name[orig_key].append(new_id)

    if new_routes:
        print(f"\nUpserting {len(new_routes)} new route entries...")
        sb_upsert("dispatch_routes", new_routes)
        routes.extend(new_routes)  # update local list
else:
    print("No duplicate routes needed.")

# Now import the actual driver logs
WEEK_MAP = {
    "/Volumes/Noah SD/Driver Log/030226-030826.xlsx": "2026-W10",  # Mar 2-8
    "/Volumes/Noah SD/Driver Log/022326-030126.xlsx": "2026-W09",  # Feb 23-Mar 1
}

for filepath, week_key in WEEK_MAP.items():
    assignments = parse_excel_to_assignments(filepath, week_key)

    if not assignments:
        print(f"  No assignments parsed for {week_key}")
        continue

    # Delete existing assignments for this week
    print(f"  Deleting existing assignments for {week_key}...")
    sb_delete("dispatch_assignments", "week_key", week_key)

    # Upsert in batches of 50
    print(f"  Upserting {len(assignments)} assignments for {week_key}...")
    for i in range(0, len(assignments), 50):
        batch = assignments[i:i+50]
        sb_upsert("dispatch_assignments", batch)

    # Count ready vs incomplete
    ready = sum(1 for a in assignments if a["status"] == "ready")
    print(f"  Done: {ready}/{len(assignments)} ready")

# Clear stale weeks that were built from bad data
print("\n--- Clearing stale weeks (W11-W16) ---")
for wn in range(11, 17):
    wk = f"2026-W{wn:02d}"
    print(f"  Deleting {wk}...")
    sb_delete("dispatch_assignments", "week_key", wk)
    sb_delete("dispatch_spare_slots", "week_key", wk)
    sb_delete("dispatch_vacation_slots", "week_key", wk)

print("\n=== DONE ===")
print("Reload the dispatch app and navigate to W10 (Mar 2-8) to verify.")
print("W13 (current week) will auto-rebuild from the correct driver logs.")
