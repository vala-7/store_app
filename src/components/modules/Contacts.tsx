import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Phone, MapPin, User, Hash } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber } from '@/lib/format';
import { toPersianDigits } from '@/lib/jalali';
import type { Contact, ContactRole } from '@/lib/types';

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | ContactRole>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('contacts').select('*').order('created_at', { ascending: false });
    if (roleFilter !== 'all') query = query.eq('role', roleFilter);
    if (search.trim()) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,company.ilike.%${search}%`);
    const { data } = await query;
    setContacts((data as Contact[]) || []);
    setLoading(false);
  }, [search, roleFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (formData: Partial<Contact>) => {
    if (editing) {
      const { initial_balance, ...rest } = formData;
      await supabase.from('contacts').update({ ...rest }).eq('id', editing.id);
    } else {
      const balance = Number(formData.initial_balance) || 0;
      await supabase.from('contacts').insert({ ...formData, balance });
    }
    setDialogOpen(false);
    setEditing(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('contacts').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="جستجو بر اساس نام، تلفن، شرکت، کد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as 'all' | ContactRole)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="نوع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="customer">مشتری</SelectItem>
              <SelectItem value="supplier">تامین‌کننده</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="ml-2 h-4 w-4" /> شخص جدید
        </Button>
      </div>

      <Card className="bg-white shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">شخصی ثبت نشده است</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-right">
                    <th className="p-3 font-medium">کد شخص</th>
                    <th className="p-3 font-medium">نام</th>
                    <th className="p-3 font-medium">نوع</th>
                    <th className="p-3 font-medium">شرکت</th>
                    <th className="p-3 font-medium">تلفن</th>
                    <th className="p-3 font-medium">مانده حساب</th>
                    <th className="p-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contacts.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-slate-50">
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-num text-primary">
                          <Hash className="h-3 w-3" />
                          {c.code ? toPersianDigits(c.code) : '-'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${c.role === 'customer' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                            <User className="h-4 w-4" />
                          </div>
                          <span className="font-medium">{c.full_name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${c.role === 'customer' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                          {c.role === 'customer' ? 'مشتری' : 'تامین‌کننده'}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{c.company || '-'}</td>
                      <td className="p-3 text-muted-foreground">{c.phone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span> : '-'}</td>
                      <td className="p-3">
                        <span className={`font-bold font-num ${c.balance > 0 ? 'text-destructive' : c.balance < 0 ? 'text-success' : 'text-muted-foreground'}`}>
                          {formatCurrency(c.balance)}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ContactDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSave={handleSave} contacts={contacts} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف شخص</AlertDialogTitle>
            <AlertDialogDescription>آیا از حذف این شخص مطمئن هستید؟ این عمل قابل بازگشت نیست.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Contact | null;
  onSave: (data: Partial<Contact>) => void;
  contacts: Contact[];
}

function ContactDialog({ open, onOpenChange, editing, onSave, contacts }: ContactDialogProps) {
  const [form, setForm] = useState({
    code: '' as string,
    full_name: '', company: '', phone: '', address: '', national_id: '', role: 'customer' as ContactRole, initial_balance: 0,
  });

  useEffect(() => {
    if (editing) {
      setForm({
        code: editing.code ? String(editing.code) : '',
        full_name: editing.full_name,
        company: editing.company || '',
        phone: editing.phone || '',
        address: editing.address || '',
        national_id: editing.national_id || '',
        role: editing.role,
        initial_balance: editing.initial_balance,
      });
    } else {
      // Suggest next code
      const maxCode = contacts.reduce((max, c) => Math.max(max, c.code || 0), 0);
      setForm({ code: String(maxCode + 1), full_name: '', company: '', phone: '', address: '', national_id: '', role: 'customer', initial_balance: 0 });
    }
  }, [editing, open, contacts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'ویرایش شخص' : 'افزودن شخص جدید'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>کد شخص (کد مشتری)</Label>
            <Input
              type="number"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="۱۰۱"
            />
            <p className="text-xs text-muted-foreground">فقط عدد - قابل ویرایش</p>
          </div>
          <div className="space-y-1.5">
            <Label>نام و نام خانوادگی *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="مثال: علی محمدی" />
          </div>
          <div className="space-y-1.5">
            <Label>شرکت</Label>
            <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>تلفن</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="۰۹۱۲۳۴۵۶۷۸۹" />
          </div>
          <div className="space-y-1.5">
            <Label>کد ملی / شناسه اقتصادی</Label>
            <Input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>نوع طرف حساب</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as ContactRole })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">مشتری</SelectItem>
                <SelectItem value="supplier">تامین‌کننده</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>آدرس</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          {!editing && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>مانده اول دوره (ریال)</Label>
              <Input type="number" value={form.initial_balance} onChange={(e) => setForm({ ...form, initial_balance: Number(e.target.value) })} />
              <p className="text-xs text-muted-foreground">مثبت = بدهکار (طلبکار ما)، منفی = بستانکار (بدهکار ما)</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
          <Button onClick={() => onSave({ ...form, code: form.code ? Number(form.code) : null })} disabled={!form.full_name.trim()}>ذخیره</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
