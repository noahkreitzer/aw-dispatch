import { useState, useRef, useCallback } from 'react';
import { useEmployeeStore } from '@/stores/employeeStore';
import type { Employee } from '@/types';
import { formatPhone } from '@/lib/dispatch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Upload, Trash2, Pencil, Download, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const emptyEmployee: Omit<Employee, 'id'> = {
  name: '',
  role: 'slinger',
  phone: '',
  active: true,
};

export default function EmployeeManager() {
  const { employees, addEmployee, updateEmployee, deleteEmployee, bulkImportEmployees } =
    useEmployeeStore();
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Employee, 'id'>>(emptyEmployee);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [filter, setFilter] = useState<'all' | 'driver' | 'slinger'>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = employees.filter((e) => filter === 'all' || e.role === filter);
  const missingPhones = employees.filter((e) => e.active && !e.phone).length;

  const openNew = () => {
    setForm(emptyEmployee);
    setEditingId(null);
    setEditOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setForm({ name: emp.name, role: emp.role, phone: emp.phone, active: emp.active });
    setEditingId(emp.id);
    setEditOpen(true);
  };

  const saveEmployee = () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    const phone = form.phone.replace(/\D/g, '');
    const data = { ...form, phone };
    if (editingId) {
      updateEmployee(editingId, data);
      toast.success(`Updated ${form.name}`);
    } else {
      addEmployee(data);
      toast.success(`Added ${form.name}`);
    }
    setEditOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) {
      const emp = employees.find((e) => e.id === deleteId);
      deleteEmployee(deleteId);
      toast.success(`Deleted ${emp?.name}`);
      setDeleteId(null);
    }
  };

  const parseImportText = useCallback((text: string): Omit<Employee, 'id'>[] => {
    const lines = text.trim().split('\n').filter((l) => l.trim());
    if (lines.length === 0) return [];

    // Try to detect CSV/TSV with headers
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('name') || firstLine.includes('role') || firstLine.includes('phone');
    const separator = firstLine.includes('\t') ? '\t' : ',';

    const dataLines = hasHeader ? lines.slice(1) : lines;
    const results: Omit<Employee, 'id'>[] = [];

    if (hasHeader) {
      const headers = lines[0].split(separator).map((h) => h.trim().toLowerCase());
      const nameIdx = headers.findIndex((h) => h.includes('name'));
      const roleIdx = headers.findIndex((h) => h.includes('role'));
      const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('cell') || h.includes('mobile'));
      const activeIdx = headers.findIndex((h) => h.includes('active') || h.includes('status'));

      for (const line of dataLines) {
        const cols = line.split(separator).map((c) => c.trim());
        const name = nameIdx >= 0 ? cols[nameIdx] : '';
        if (!name) continue;

        const roleRaw = roleIdx >= 0 ? cols[roleIdx]?.toLowerCase() : '';
        const role: 'driver' | 'slinger' = roleRaw.includes('driver') ? 'driver' : 'slinger';
        const phone = phoneIdx >= 0 ? (cols[phoneIdx] ?? '').replace(/\D/g, '') : '';
        const activeRaw = activeIdx >= 0 ? cols[activeIdx]?.toLowerCase() : 'true';
        const active = activeRaw !== 'false' && activeRaw !== 'no' && activeRaw !== 'inactive';

        results.push({ name, role, phone, active });
      }
    } else {
      // Simple format: each line is "Name, Phone" or "Name, Role, Phone"
      for (const line of dataLines) {
        const parts = line.split(separator).map((p) => p.trim());
        if (parts.length === 0 || !parts[0]) continue;

        const name = parts[0];
        let role: 'driver' | 'slinger' = 'slinger';
        let phone = '';

        if (parts.length === 2) {
          // Name, Phone
          phone = parts[1].replace(/\D/g, '');
        } else if (parts.length >= 3) {
          // Name, Role, Phone
          role = parts[1].toLowerCase().includes('driver') ? 'driver' : 'slinger';
          phone = parts[2].replace(/\D/g, '');
        }
        results.push({ name, role, phone, active: true });
      }
    }
    return results;
  }, []);

  const handleImport = () => {
    const parsed = parseImportText(importText);
    if (parsed.length === 0) {
      toast.error('No valid employee data found');
      return;
    }
    bulkImportEmployees(parsed);
    toast.success(`Imported/updated ${parsed.length} employees`);
    setImportOpen(false);
    setImportText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          const emps: Omit<Employee, 'id'>[] = (Array.isArray(data) ? data : data.employees ?? []).map(
            (e: Record<string, unknown>) => ({
              name: String(e.name ?? ''),
              role: String(e.role ?? 'slinger') as 'driver' | 'slinger',
              phone: String(e.phone ?? '').replace(/\D/g, ''),
              active: e.active !== false,
            })
          );
          bulkImportEmployees(emps);
          toast.success(`Imported ${emps.length} employees from JSON`);
          setImportOpen(false);
        } catch {
          toast.error('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    } else {
      // CSV/TSV
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setImportText(text);
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const exportEmployees = () => {
    const data = JSON.stringify(employees, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aw-employees.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported employees');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold">Employee Roster</h1>
          <p className="text-sm text-muted-foreground font-mono">
            {employees.filter((e) => e.active).length} active · {employees.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportEmployees}>
            <Download size={16} className="mr-1" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload size={16} className="mr-1" /> Import
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus size={16} className="mr-1" /> Add Employee
          </Button>
        </div>
      </div>

      {missingPhones > 0 && (
        <Card className="mb-4 border-[#F5C400] bg-[#F5C400]/10">
          <CardContent className="py-3 flex items-center gap-2 text-sm">
            <AlertCircle size={16} className="text-[#F5C400]" />
            <span className="font-mono">
              {missingPhones} active employee{missingPhones > 1 ? 's' : ''} missing phone numbers.
              SMS dispatch won't work without them.
            </span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setImportOpen(true)}>
              Bulk Import Data
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['all', 'driver', 'slinger'] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className="font-mono text-xs"
          >
            {f === 'all' ? 'All' : f === 'driver' ? 'Drivers' : 'Slingers'}
          </Button>
        ))}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-mono">Name</TableHead>
              <TableHead className="font-mono">Role</TableHead>
              <TableHead className="font-mono">Phone</TableHead>
              <TableHead className="font-mono">Status</TableHead>
              <TableHead className="font-mono w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No employees found
                </TableCell>
              </TableRow>
            )}
            {filtered.map((emp) => (
              <TableRow key={emp.id} className={!emp.active ? 'opacity-50' : ''}>
                <TableCell className="font-medium">{emp.name}</TableCell>
                <TableCell>
                  <Badge variant={emp.role === 'driver' ? 'default' : 'secondary'} className="font-mono text-xs">
                    {emp.role}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {emp.phone ? formatPhone(emp.phone) : (
                    <span className="text-destructive text-xs">Missing</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={emp.active ? 'default' : 'secondary'}
                    className={`font-mono text-xs ${emp.active ? 'bg-green-600 text-white' : ''}`}
                  >
                    {emp.active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                      <Pencil size={14} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(emp.id)}>
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingId ? 'Edit Employee' : 'Add Employee'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label className="font-mono text-xs">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <Label className="font-mono text-xs">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as 'driver' | 'slinger' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="driver">Driver</SelectItem>
                  <SelectItem value="slinger">Slinger</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-mono text-xs">Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(570) 555-0101"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="rounded"
                id="active-check"
              />
              <Label htmlFor="active-check" className="font-mono text-xs">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEmployee}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Import Employee Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono">Upload a File</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Upload a CSV, TSV, or JSON file. Existing employees will be updated by name match.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.json,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload size={14} className="mr-1" /> Choose File
                </Button>
              </CardContent>
            </Card>

            <div className="text-center text-xs text-muted-foreground font-mono">— OR —</div>

            <div>
              <Label className="font-mono text-xs">Paste Data</Label>
              <Textarea
                rows={10}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={`Paste CSV/TSV data here. Accepted formats:\n\nWith headers:\nName, Role, Phone, License\nMike Barletta, Driver, 5705551234, CDL-A\nTony Ferris, Slinger, 5705555678\n\nSimple (name, phone):\nMike Barletta, 5705551234\nTony Ferris, 5705555678`}
                className="font-mono text-xs"
              />
            </div>

            {importText && (
              <Card className="bg-muted/50">
                <CardContent className="py-3">
                  <p className="text-xs font-mono text-muted-foreground">
                    Preview: {parseImportText(importText).length} employees detected
                  </p>
                  <ul className="mt-2 text-xs font-mono space-y-1 max-h-32 overflow-auto">
                    {parseImportText(importText).slice(0, 10).map((emp, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-medium">{emp.name}</span>
                        <Badge variant="outline" className="text-[10px]">{emp.role}</Badge>
                        {emp.phone && <span className="text-muted-foreground">{formatPhone(emp.phone)}</span>}
                      </li>
                    ))}
                    {parseImportText(importText).length > 10 && (
                      <li className="text-muted-foreground">...and {parseImportText(importText).length - 10} more</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportOpen(false); setImportText(''); }}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importText.trim()}>
              Import {parseImportText(importText).length > 0 && `(${parseImportText(importText).length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {employees.find((e) => e.id === deleteId)?.name} from the roster.
              Consider marking them inactive instead.
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
