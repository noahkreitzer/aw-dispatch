import { memo } from 'react';
import { useUndoStore } from '@/stores/undoStore';
import { Clock } from 'lucide-react';

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default memo(function ActivityLog() {
  const past = useUndoStore((s) => s.past);

  // Show last 8 actions, newest first
  const recent = [...past].reverse().slice(0, 8);

  if (recent.length === 0) {
    return (
      <div className="p-3 text-center text-[10px] text-gray-400">
        No changes this session
      </div>
    );
  }

  return (
    <div className="max-h-[200px] overflow-y-auto">
      {recent.map((snapshot, i) => (
        <div key={`${snapshot.timestamp}-${i}`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-[10px]">
          <Clock size={9} className="text-gray-300 shrink-0" />
          <span className="text-gray-600 truncate">{snapshot.label}</span>
          <span className="text-gray-300 shrink-0 ml-auto font-mono">{timeAgo(snapshot.timestamp)}</span>
        </div>
      ))}
    </div>
  );
});
