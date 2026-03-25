import { useState, useRef, useCallback } from 'react';
import { parseWeeklyExcel, type ParsedWeekData } from '@/lib/parseWeekUpload';
import { useEmployeeStore } from '@/stores/employeeStore';
import { useTruckStore } from '@/stores/truckStore';
import { useScheduleStore } from '@/stores/scheduleStore';
import { X, Upload, FileSpreadsheet, Check, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface WeekUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSynced?: (weekKey: string) => void;
}

export default function WeekUploadModal({ open, onClose, onSynced }: WeekUploadModalProps) {
  const [parsed, setParsed] = useState<ParsedWeekData | null>(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const employees = useEmployeeStore((s) => s.employees);
  const trucks = useTruckStore((s) => s.trucks);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const result = parseWeeklyExcel(buffer, file.name);
      if (!result) {
        toast.error('Could not parse spreadsheet. Make sure it has day tabs (Monday, Tuesday, etc.)');
        return;
      }
      setParsed(result);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);

    try {
      // Build employee and truck lookup maps
      const empByName = new Map<string, string>();
      for (const e of employees) {
        empByName.set(e.name.toLowerCase(), e.id);
      }
      const truckByNum = new Map<string, string>();
      for (const t of trucks) {
        truckByNum.set(t.number, t.id);
      }

      function findEmployee(name: string | null): string | null {
        if (!name?.trim()) return null;
        const n = name.trim().toLowerCase();
        if (empByName.has(n)) return empByName.get(n)!;
        for (const [key, id] of empByName) {
          if (key.includes(n) || n.includes(key)) return id;
        }
        return null;
      }

      // Build assignments
      const assignments: Array<{
        id: string;
        week_key: string;
        route_id: string;
        driver_id: string | null;
        truck_id: string | null;
        slinger_ids: string[];
        status: string;
        notes: string;
      }> = [];

      const matched = new Set<string>();

      for (const row of parsed.rows) {
        if (!row.routeId) continue;
        const key = `${parsed.weekKey}-${row.routeId}`;
        if (matched.has(key)) continue;
        matched.add(key);

        const driverId = findEmployee(row.driver);
        const truckId = row.truck ? truckByNum.get(row.truck) ?? null : null;
        const slingerIds: string[] = [];
        for (const s of [row.slinger1, row.slinger2, row.slinger3]) {
          const sid = findEmployee(s);
          if (sid) slingerIds.push(sid);
        }

        assignments.push({
          id: `asgn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          week_key: parsed.weekKey,
          route_id: row.routeId,
          driver_id: driverId,
          truck_id: truckId,
          slinger_ids: slingerIds,
          status: driverId && truckId ? 'ready' : 'incomplete',
          notes: '',
        });
      }

      // Import via the schedule store
      const store = useScheduleStore.getState();
      await store.importWeekAssignments(parsed.weekKey, assignments);

      const ready = assignments.filter((a) => a.status === 'ready').length;
      toast.success(`Imported ${assignments.length} routes (${ready} ready) for ${parsed.weekKey}`);
      onSynced?.(parsed.weekKey);
      onClose();
      setParsed(null);
    } catch (err) {
      toast.error('Import failed: ' + String(err));
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  // Preview stats
  const unmatchedRoutes = parsed?.rows.filter((r) => !r.routeId) ?? [];
  const matchedRoutes = parsed?.rows.filter((r) => r.routeId) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-green-600" />
            <span className="font-bold text-sm">Upload Weekly Spreadsheet</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {!parsed ? (
            <>
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                  ${dragOver ? 'border-[#F5C400] bg-yellow-50 scale-[1.01]' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
              >
                <Upload size={32} className="mx-auto mb-3 text-gray-400" />
                <p className="text-sm font-medium">Drop your weekly Excel file here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse — same format as the dashboard</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
              <p className="text-[10px] text-gray-400 text-center">
                Expects sheets named Monday, Tuesday, Wednesday, Thursday, Friday with Route, Driver, Slinger 1/2/3, Truck columns
              </p>
            </>
          ) : (
            <>
              {/* Preview */}
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-sm">{parsed.weekKey}</span>
                  <span className="text-xs text-gray-400 font-mono">{parsed.weekLabel}</span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-lg font-bold text-green-600">{matchedRoutes.length}</p>
                    <p className="text-[10px] text-gray-400">Routes Matched</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-lg font-bold">{new Set(parsed.rows.map((r) => r.driver).filter(Boolean)).size}</p>
                    <p className="text-[10px] text-gray-400">Drivers</p>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-lg font-bold">{new Set(parsed.rows.map((r) => r.truck).filter(Boolean)).size}</p>
                    <p className="text-[10px] text-gray-400">Trucks</p>
                  </div>
                </div>

                {unmatchedRoutes.length > 0 && (
                  <div className="mt-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-1 text-amber-600 mb-1">
                      <AlertTriangle size={12} />
                      <span className="text-[10px] font-bold">{unmatchedRoutes.length} unmatched routes (will be skipped)</span>
                    </div>
                    <div className="text-[10px] text-amber-500 space-y-0.5 max-h-20 overflow-auto">
                      {unmatchedRoutes.map((r, i) => (
                        <div key={i}>{r.day}: {r.routeName}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Day breakdown */}
                <div className="mt-3 flex gap-2 text-[10px] font-mono text-gray-500">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((d) => {
                    const count = matchedRoutes.filter((r) => r.day === d).length;
                    return count > 0 ? (
                      <span key={d} className="bg-white px-2 py-1 rounded">
                        {d.slice(0, 3)}: {count}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setParsed(null)}
                  className="flex-1 text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Choose Different File
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || matchedRoutes.length === 0}
                  className="flex-1 text-xs font-bold px-3 py-2 rounded-lg bg-[#F5C400] text-[#1A1A1A] hover:bg-[#e0b300] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {importing ? (
                    'Importing...'
                  ) : (
                    <>
                      <Check size={14} />
                      Import {matchedRoutes.length} Routes → {parsed.weekKey}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
