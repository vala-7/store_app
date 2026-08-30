import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Trash2, Wallet, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { formatJalaliDate, todayJalali, toPersianDigits, parseJalaliInput, toGregorian } from '@/lib/jalali';
import type { Payment, Contact, PaymentDirection, PaymentMethod } from '@/lib/types';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'نقدی',
  card: 'کارت / پوز',
  transfer: 'انتقال بانکی',
};

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dirFilter, setDirFilter] = useState<'all' | PaymentDirection>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('payments').select('*, contact:contacts(id, full_name, role)').order('created_at', { ascending: false });
    if (dirFilter !== 'all') query = query.eq('direction', dirFilter);
    if (search.trim()) query = query.or(`number.ilike.%${search}%`);
    const { data } = await query;
    setPayments((data as Payment[]) || []);
    setLoading(false);
  }, [search, dirFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteId) return;
    const pay = payments.find((p) => p.id === deleteId);
    if (pay) await revertPaymentEffect(pay);
    await supabase.from('payments').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="جستجو بر اساس شماره..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          </div>
          <Select value={dirFilter} onValueChange={(v) => setDirFilter(v as 'all' | PaymentDirection)}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="receipt">دریافت</SelectItem>
              <SelectItem value="payment">پرداخت</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="ml-2 h-4 w-4" /> ثبت دریافت/پرداخت
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />)}
            </div>
          ) : payments.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">دریافت یا پرداختی ثبت نشده است</p>
          ) : (
            <div className="divide-y divide-border">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4 transition-colors hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-full ${p.direction === 'receipt' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                      {p.direction === 'receipt' ? <ArrowDownCircle className="h-5 w-5" /> : <ArrowUpCircle className="h-5 w-5" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{p.contact?.full_name || '-'}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{p.direction === 'receipt' ? 'دریافت' : 'پرداخت'}</span>
                        <span>•</span>
                        <span>{METHOD_LABELS[p.method]}</span>
                        <span>•</span>
                        <span className="font-num">{formatJalaliDate(p.date)}</span>
                        <span>•</span>
                        <span className="font-num">{toPersianDigits(p.number)}</span>
                      </div>
                      {p.notes && <span className="mt-0.5 text-xs text-muted-foreground">{p.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold font-num ${p.direction === 'receipt' ? 'text-success' : 'text-primary'}`}>
                      {p.direction === 'receipt' ? '+' : '-'}{formatCurrency(p.amount)}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={load} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف تراکنش</AlertDialogTitle>
            <AlertDialogDescription>آیا از حذف این تراکنش مطمئن هستید؟ مانده حساب شخص اصلاح می‌شود.</AlertDialogDescription>
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

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}

function PaymentDialog({ open, onOpenChange, onSaved }: PaymentDialogProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState({
    contact_id: '',
    direction: 'receipt' as PaymentDirection,
    method: 'cash' as PaymentMethod,
    amount: 0,
    notes: '',
    date: '',
  });

  useEffect(() => {
    if (!open) return;
    supabase.from('contacts').select('*').order('full_name').then(({ data }) => setContacts((data as Contact[]) || []));
    const today = todayJalali();
    setForm({ contact_id: '', direction: 'receipt', method: 'cash', amount: 0, notes: '', date: `${today.jy}/${String(today.jm).padStart(2, '0')}/${String(today.jd).padStart(2, '0')}` });
  }, [open]);

  const handleSave = async () => {
    if (!form.contact_id || form.amount <= 0) return;

    const parsed = parseJalaliInput(form.date);
    let gregorianDate = new Date().toISOString().split('T')[0];
    if (parsed) {
      gregorianDate = toGregorian(parsed.jy, parsed.jm, parsed.jd).toISOString().split('T')[0];
    }

    const countRes = await supabase.from('payments').select('id', { count: 'exact', head: true });
    const number = `PAY-${String((countRes.count || 0) + 1).padStart(5, '0')}`;

    const { data: newPay } = await supabase.from('payments').insert({
      number,
      date: gregorianDate,
      contact_id: form.contact_id,
      direction: form.direction,
      method: form.method,
      amount: form.amount,
      notes: form.notes || null,
    }).select().single();

    if (newPay) {
      await applyPaymentEffect(newPay as Payment);
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>ثبت دریافت / پرداخت</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>طرف حساب *</Label>
            <Select value={form.contact_id} onValueChange={(v) => setForm({ ...form, contact_id: v })}>
              <SelectTrigger><SelectValue placeholder="انتخاب..." /></SelectTrigger>
              <SelectContent>
                {contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>نوع</Label>
            <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v as PaymentDirection })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="receipt">دریافت (وصول طلب)</SelectItem>
                <SelectItem value="payment">پرداخت (تسویه بدهی)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>روش پرداخت</Label>
            <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v as PaymentMethod })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">نقدی</SelectItem>
                <SelectItem value="card">کارت / پوز</SelectItem>
                <SelectItem value="transfer">انتقال بانکی</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>مبلغ (ریال) *</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>تاریخ (شمسی)</Label>
            <Input value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} placeholder="۱۴۰۳/۰۱/۰۱" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>توضیحات</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
          <Button onClick={handleSave} disabled={!form.contact_id || form.amount <= 0}>ذخیره</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function applyPaymentEffect(payment: Payment) {
  const { data: c } = await supabase.from('contacts').select('balance').eq('id', payment.contact_id).maybeSingle();
  if (!c) return;
  // receipt: customer pays us -> reduce their debit balance
  // payment: we pay supplier -> reduce their credit (increase balance)
  const delta = payment.direction === 'receipt' ? -Number(payment.amount) : Number(payment.amount);
  await supabase.from('contacts').update({ balance: Number(c.balance) + delta }).eq('id', payment.contact_id);
}

async function revertPaymentEffect(payment: Payment) {
  const { data: c } = await supabase.from('contacts').select('balance').eq('id', payment.contact_id).maybeSingle();
  if (!c) return;
  const delta = payment.direction === 'receipt' ? Number(payment.amount) : -Number(payment.amount);
  await supabase.from('contacts').update({ balance: Number(c.balance) + delta }).eq('id', payment.contact_id);
}
