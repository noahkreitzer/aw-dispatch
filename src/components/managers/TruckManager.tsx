import { useState } from 'react';
import { useTruckStore } from '@/stores/truckStore';
import type { Truck } from '@/types';
import { TRUCK_TYPES, TRUCK_STATUSES } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const emptyTruck: Omit<Truck, 'id'> = {
  number: '',
  type: 'rear-load',
  status: 'active',
};

const statusColors: Record<Truck['status'], string> = {
  'active': 'bg-green-600 text-white',
  'out-of-service': 'bg-red-600 text-white',
  'maintenance': 'bg-yellow-600 text-white',
};

const typeLabels: Record<Truck['type'], string> = {
  'rear-load': 'Rear Load',
  'side-load': 'Side Load',
  'roll-off': 'Roll-Off',
  'recycling': 'Recycling',
};

export default function TruckManager() {
  const { trucks, addTruck, updateTruck, deleteTruck } = useTruckStore();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Truck, 'id'>>(emptyTruck);
  const [editingId, setEditingId] = useState<string | null>(null);

  const openNew = () => { setForm(emptyTruck); setEditingId(null); setEditOpen(true); };
  const openEdit = (t: Truck) => {
    setForm({ number: t.number, type: t.type, status: t.status });
    setEditingId(t.id);
    setEditOpen(true);
  };

  const save = () => {
    if (!form.number.trim()) { toast.error('Truck number required'); return; }
    if (editingId) {
      updateTruck(editingId, form);
      toast.success(`Updated Truck #${form.number}`);
    } else {
      addTruck(form);
      toast.success(`Added Truck #${form.number}`);
    }
    setEditOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) {
      const t = trucks.find((tr) => tr.id === deleteId);
      deleteTruck(deleteId);
      toast.success(`Deleted Truck #${t?.number}`);
      setDeleteId(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Truck Fleet</h1>
          <p className="text-sm text-muted-foreground font-mono">
            {trucks.filter((t) => t.status === 'active').length} active · {trucks.length} total
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus size={16} className="mr-1" /> Add Truck
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-mono">Truck #</TableHead>
              <TableHead className="font-mono">Type</TableHead>
              <TableHead className="font-mono">Status</TableHead>
              <TableHead className="font-mono w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trucks.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No trucks</TableCell>
              </TableRow>
            )}
            {trucks.map((t) => (
              <TableRow key={t.id} className={t.status !== 'active' ? 'opacity-60' : ''}>
                <TableCell className="font-mono font-bold text-lg">#{t.number}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-xs">{typeLabels[t.type]}</Badge>
                </TableCell>
                <TableCell>
                  <Badge className={`font-mono text-xs ${statusColors[t.status]}`}>
                    {t.status.replace('-', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(t.id)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">{editingId ? 'Edit Truck' : 'Add Truck'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label className="font-mono text-xs">Truck Number</Label>
              <Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="101" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-mono text-xs">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Truck['type'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRUCK_TYPES.map((t) => <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-mono text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Truck['status'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRUCK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace('-', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Truck?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes Truck #{trucks.find((t) => t.id === deleteId)?.number} from the fleet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
