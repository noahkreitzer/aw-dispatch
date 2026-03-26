import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Wand2, CheckCircle, Loader2 } from 'lucide-react';
import type { AutoAssignResult } from '@/lib/autoAssign';

interface AutoAssignModalProps {
  open: boolean;
  onClose: () => void;
  onPreview: () => AutoAssignResult | null;
  onConfirm: (result: AutoAssignResult) => void;
}

export default function AutoAssignModal({ open, onClose, onPreview, onConfirm }: AutoAssignModalProps) {
  const [preview, setPreview] = useState<AutoAssignResult | null>(null);
  const [applying, setApplying] = useState(false);

  const handlePreview = () => {
    const result = onPreview();
    setPreview(result);
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setApplying(true);
    onConfirm(preview);
    setTimeout(() => {
      setApplying(false);
      onClose();
    }, 500);
  };

  const handleClose = () => {
    setPreview(null);
    setApplying(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 size={18} className="text-blue-500" />
            Smart Auto-Assign
          </DialogTitle>
          <DialogDescription>
            Automatically fill missing drivers, trucks, and slingers using previous-week patterns and workload balancing.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-3 py-2">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
              <p className="font-bold">How it works:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Skips employees on vacation or in spare pool</li>
                <li>Prefers last week's driver/truck/slinger for each route</li>
                <li>Balances workload — assigns least-busy crew first</li>
                <li>Matches truck types to route types (recycling truck for recycling routes, etc.)</li>
                <li>Never double-books anyone on the same day</li>
                <li>Only fills empty slots — won't overwrite existing assignments</li>
              </ul>
            </div>
            <Button onClick={handlePreview} className="w-full" variant="default">
              <Wand2 size={14} className="mr-2" />
              Preview Changes
            </Button>
          </div>
        ) : (
          <div className="space-y-3 py-2 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-green-500" />
              <span className="text-sm font-bold">
                {preview.changes.length} change{preview.changes.length !== 1 ? 's' : ''} proposed
              </span>
            </div>

            {preview.changes.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-500">Everything is already assigned!</p>
                <p className="text-xs text-gray-400 mt-1">No empty slots to fill.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto border rounded-lg bg-gray-50 p-2 space-y-0.5 max-h-[40vh]">
                {preview.changes.map((change, i) => (
                  <div key={i} className="text-[11px] font-mono text-gray-700 px-2 py-1 rounded hover:bg-gray-100">
                    {change}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setPreview(null)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={preview.changes.length === 0 || applying}
                className="flex-1"
              >
                {applying ? (
                  <><Loader2 size={14} className="mr-2 animate-spin" />Applying...</>
                ) : (
                  <><Wand2 size={14} className="mr-2" />Apply {preview.changes.length} Changes</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
