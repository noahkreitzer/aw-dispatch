import { useState } from 'react';
import { useRouteStore } from '@/stores/routeStore';
import type { Route, DayOfWeek } from '@/types';
import { DAYS, ROUTE_TYPES } from '@/types';
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

const emptyRoute: Omit<Route, 'id'> = {
  name: '',
  municipality: '',
  day: 'Monday',
  type: 'residential',
  stops: 0,
  active: true,
};

const typeColors: Record<Route['type'], string> = {
  'residential': 'bg-blue-600 text-white',
  'commercial': 'bg-purple-600 text-white',
  'recycling': 'bg-green-600 text-white',
  'roll-off': 'bg-orange-600 text-white',
};

const dayAbbr: Record<DayOfWeek, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
  Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat',
};

export default function RouteManager() {
  const { routes, addRoute, updateRoute, deleteRoute } = useRouteStore();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Route, 'id'>>(emptyRoute);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<DayOfWeek | 'all'>('all');

  const filtered = routes.filter((r) => dayFilter === 'all' || r.day === dayFilter);

  const openNew = () => { setForm(emptyRoute); setEditingId(null); setEditOpen(true); };
  const openEdit = (r: Route) => {
    setForm({ name: r.name, municipality: r.municipality, day: r.day, type: r.type, stops: r.stops, active: r.active, biweekly: r.biweekly, biweeklyPhase: r.biweeklyPhase });
    setEditingId(r.id);
    setEditOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) { toast.error('Route name required'); return; }
    if (editingId) {
      updateRoute(editingId, form);
      toast.success(`Updated ${form.name}`);
    } else {
      addRoute(form);
      toast.success(`Added ${form.name}`);
    }
    setEditOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) {
      const r = routes.find((rt) => rt.id === deleteId);
      deleteRoute(deleteId);
      toast.success(`Deleted ${r?.name}`);
      setDeleteId(null);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Routes</h1>
          <p className="text-sm text-gray-500">
            {routes.filter((r) => r.active).length} active · {routes.length} total
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus size={16} className="mr-1" /> Add Route
        </Button>
      </div>

      <div className="flex gap-1 mb-4 flex-wrap">
        <Button
          variant={dayFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setDayFilter('all')}
          className="text-xs"
        >
          All
        </Button>
        {DAYS.map((d) => (
          <Button
            key={d}
            variant={dayFilter === d ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDayFilter(d)}
            className="text-xs"
          >
            {dayAbbr[d]}
          </Button>
        ))}
      </div>

      <Card className="rounded-xl shadow-sm ring-1 ring-gray-200/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Route</TableHead>
              <TableHead>Municipality</TableHead>
              <TableHead>Day</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Stops</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No routes</TableCell>
              </TableRow>
            )}
            {filtered.map((r) => (
              <TableRow key={r.id} className={!r.active ? 'opacity-50' : ''}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.municipality}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">{dayAbbr[r.day]}</Badge>
                    {r.biweekly && <Badge className="text-[9px] bg-amber-500 text-white">Bi-weekly</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={`font-mono text-xs ${typeColors[r.type]}`}>{r.type}</Badge>
                </TableCell>
                <TableCell className="">{r.stops}</TableCell>
                <TableCell>
                  <Badge
                    variant={r.active ? 'default' : 'secondary'}
                    className={`text-xs ${r.active ? 'bg-green-600 text-white' : ''}`}
                  >
                    {r.active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(r.id)}>
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
            <DialogTitle>{editingId ? 'Edit Route' : 'Add Route'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label className="text-xs">Route Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pottsville Trash" />
            </div>
            <div>
              <Label className="text-xs">Municipality</Label>
              <Input value={form.municipality} onChange={(e) => setForm({ ...form, municipality: e.target.value })} placeholder="Pottsville" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Day</Label>
                <Select value={form.day} onValueChange={(v) => setForm({ ...form, day: v as DayOfWeek })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Route['type'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROUTE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Estimated Stops</Label>
                <Input type="number" value={form.stops} onChange={(e) => setForm({ ...form, stops: Number(e.target.value) })} />
              </div>
              <div className="flex flex-col gap-2 pb-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    className="rounded"
                    id="route-active"
                  />
                  <Label htmlFor="route-active" className="text-xs">Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.biweekly ?? false}
                    onChange={(e) => setForm({ ...form, biweekly: e.target.checked, biweeklyPhase: e.target.checked ? (form.biweeklyPhase ?? 'even') : undefined })}
                    className="rounded"
                    id="route-biweekly"
                  />
                  <Label htmlFor="route-biweekly" className="text-xs">Bi-weekly</Label>
                </div>
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
            <AlertDialogTitle>Delete Route?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {routes.find((r) => r.id === deleteId)?.name} from the route list.
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
