import { memo } from 'react';
import type { Conflict } from '@/lib/conflicts';
import { AlertTriangle } from 'lucide-react';

interface ConflictBannerProps {
  conflicts: Conflict[];
}

export default memo(function ConflictBanner({ conflicts }: ConflictBannerProps) {
  if (conflicts.length === 0) return null;

  const driverConflicts = conflicts.filter((c) => c.type === 'driver-double-booked');
  const truckConflicts = conflicts.filter((c) => c.type === 'truck-double-booked');
  const slingerConflicts = conflicts.filter((c) => c.type === 'slinger-double-booked');

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mx-3 mt-2 space-y-1">
      <div className="flex items-center gap-1.5">
        <AlertTriangle size={13} className="text-red-500 shrink-0" />
        <span className="text-[11px] font-bold text-red-700">
          {conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''} Detected
        </span>
      </div>
      <div className="space-y-0.5">
        {driverConflicts.map((c, i) => (
          <p key={`d-${i}`} className="text-[10px] text-red-600">
            <span className="font-bold">{c.employeeName}</span> drives {c.routeNames.join(' & ')} on {c.day}
          </p>
        ))}
        {truckConflicts.map((c, i) => (
          <p key={`t-${i}`} className="text-[10px] text-red-600">
            Truck <span className="font-bold">#{c.truckNumber}</span> on {c.routeNames.join(' & ')} on {c.day}
          </p>
        ))}
        {slingerConflicts.map((c, i) => (
          <p key={`s-${i}`} className="text-[10px] text-red-600">
            <span className="font-bold">{c.employeeName}</span> slings {c.routeNames.join(' & ')} on {c.day}
          </p>
        ))}
      </div>
    </div>
  );
});
