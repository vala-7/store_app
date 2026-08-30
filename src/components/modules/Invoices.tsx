import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Eye, Trash2, FileText, ArrowRightLeft, Filter } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber } from '@/lib/format';
import { formatJalaliDate, toPersianDigits, todayJalali, parseJalaliInput, toGregorian } from '@/lib/jalali';
import { calculateLine, calculateInvoiceTotals, emptyLineItem, generateInvoiceNumber } from '@/lib/invoice-calc';
import ProductAutocomplete from '@/components/invoice/ProductAutocomplete';
import InvoiceDetailModal from '@/components/invoice/InvoiceDetailModal';
import type { Invoice, InvoiceItem, Contact, Product, InvoiceType, DiscountType, Settings, InvoiceLineItem, GlobalTotalsConfig } from '@/lib/types';

const TYPE_LABELS: Record<InvoiceType, string> = {
  sales: 'فاکتور فروش',
  purchase: 'فاکتور خرید',
  proforma: 'پیش‌فاکتور',
};
const TYPE_COLORS: Record<InvoiceType, string> = {
  sales: 'bg-success/10 text-success',
  purchase: 'bg-primary/10 text-primary',
  proforma: 'bg-warning/10 text-warning',
};

interface InvoicesProps {
  settings: Settings | null;
  onSettingsRefresh: () => void;
  pendingEditId?: string | null;
  onEditConsumed?: () => void;
}

export default function Invoices({ settings, pendingEditId, onEditConsumed }: InvoicesProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | InvoiceType>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Handle pending edit from Ledger cross-module navigation
  useEffect(() => {
    if (pendingEditId) {
      const inv = invoices.find((i) => i.id === pendingEditId);
      if (inv) {
        setEditingInvoice(inv);
        setFormOpen(true);
        onEditConsumed?.();
      } else {
        // Invoice not in current list (maybe filtered), fetch it
        supabase.from('invoices').select('*, contact:contacts(id, full_name, role, code)').eq('id', pendingEditId).maybeSingle().then(({ data }) => {
          if (data) {
            setEditingInvoice(data as Invoice);
            setFormOpen(true);
          }
          onEditConsumed?.();
        });
      }
    }
  }, [pendingEditId, invoices, onEditConsumed]);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('invoices').select('*, contact:contacts(id, full_name, role, code)').order('created_at', { ascending: false });
    if (typeFilter !== 'all') query = query.eq('type', typeFilter);
    if (search.trim()) query = query.or(`number.ilike.%${search}%`);
    const { data } = await query;
    setInvoices((data as Invoice[]) || []);
    setLoading(false);
  }, [search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteId) return;
    const inv = invoices.find((i) => i.id === deleteId);
    if (inv && (inv.type === 'sales' || inv.type === 'purchase')) {
      await revertInvoiceEffects(inv);
    }
    await supabase.from('invoice_items').delete().eq('invoice_id', deleteId);
    await supabase.from('invoices').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  };

  const handleConvertProforma = async (proforma: Invoice) => {
    const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', proforma.id);
    if (!items || items.length === 0) return;

    const countRes = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('type', 'sales');
    const newNumber = generateInvoiceNumber(countRes.count || 0);

    const { data: newInv } = await supabase.from('invoices').insert({
      number: newNumber,
      type: 'sales',
      date: new Date().toISOString().split('T')[0],
      contact_id: proforma.contact_id,
      seller_name: proforma.seller_name,
      seller_national_id: proforma.seller_national_id,
      seller_phone: proforma.seller_phone,
      seller_address: proforma.seller_address,
      buyer_name: proforma.buyer_name,
      buyer_national_id: proforma.buyer_national_id,
      buyer_phone: proforma.buyer_phone,
      buyer_address: proforma.buyer_address,
      subtotal: proforma.subtotal,
      total_discount: proforma.total_discount,
      total_tax: proforma.total_tax,
      payable: proforma.payable,
      global_discount_type: proforma.global_discount_type,
      global_discount_value: proforma.global_discount_value,
      global_tax_type: proforma.global_tax_type,
      global_tax_value: proforma.global_tax_value,
      notes: proforma.notes,
      status: 'open',
      converted_from: proforma.id,
    }).select().single();

    if (!newInv) return;

    const newItems = items.map((it) => ({
      invoice_id: newInv.id,
      product_id: it.product_id,
      sku: it.sku,
      name: it.name,
      unit: it.unit,
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount_type: it.discount_type,
      discount_value: it.discount_value,
      discount_amount: it.discount_amount,
      tax_rate: it.tax_rate,
      tax_amount: it.tax_amount,
      total: it.total,
    }));
    await supabase.from('invoice_items').insert(newItems);

    await applyInvoiceEffects(newInv as Invoice, items as InvoiceItem[]);

    await supabase.from('invoices').update({ status: 'converted' }).eq('id', proforma.id);

    load();
  };

  const handleEditInvoice = (id: string) => {
    const inv = invoices.find((i) => i.id === id);
    if (inv) {
      setDetailId(null);
      setEditingInvoice(inv);
      setFormOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="جستجو بر اساس شماره فاکتور..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | InvoiceType)}>
            <SelectTrigger className="w-full sm:w-44"><Filter className="ml-2 h-4 w-4" /><SelectValue placeholder="نوع فاکتور" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه فاکتورها</SelectItem>
              <SelectItem value="sales">فروش</SelectItem>
              <SelectItem value="purchase">خرید</SelectItem>
              <SelectItem value="proforma">پیش‌فاکتور</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setEditingInvoice(null); setFormOpen(true); }}>
          <Plus className="ml-2 h-4 w-4" /> فاکتور جدید
        </Button>
      </div>

      <Card className="bg-white shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />)}
            </div>
          ) : invoices.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">فاکتوری ثبت نشده است</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-right">
                    <th className="p-3 font-medium">شماره</th>
                    <th className="p-3 font-medium">نوع</th>
                    <th className="p-3 font-medium">طرف حساب</th>
                    <th className="p-3 font-medium">تاریخ</th>
                    <th className="p-3 font-medium">مبلغ نهایی</th>
                    <th className="p-3 font-medium">وضعیت</th>
                    <th className="p-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="cursor-pointer transition-colors hover:bg-slate-50" onClick={() => setDetailId(inv.id)}>
                      <td className="p-3 font-medium font-num">{toPersianDigits(inv.number)}</td>
                      <td className="p-3">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[inv.type]}`}>{TYPE_LABELS[inv.type]}</span>
                      </td>
                      <td className="p-3 text-muted-foreground">{inv.contact?.full_name || '-'}</td>
                      <td className="p-3 font-num text-muted-foreground">{formatJalaliDate(inv.date)}</td>
                      <td className="p-3 font-num font-bold">{formatCurrency(inv.payable)}</td>
                      <td className="p-3">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setDetailId(inv.id)} title="مشاهده">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {inv.type === 'proforma' && inv.status !== 'converted' && (
                            <Button variant="ghost" size="icon" onClick={() => handleConvertProforma(inv)} title="تبدیل به فاکتور فروش" className="text-success">
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(inv.id)} title="حذف">
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

      <InvoiceForm
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditingInvoice(null); }}
        settings={settings}
        onSaved={load}
        editingInvoice={editingInvoice}
      />

      <InvoiceDetailModal
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        invoiceId={detailId}
        settings={settings}
        onEdit={handleEditInvoice}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف فاکتور</AlertDialogTitle>
            <AlertDialogDescription>
              در صورت حذف، اثر این فاکتور روی موجودی کالاها و مانده حساب شخص برگردانده نخواهد شد. آیا مطمئن هستید؟
            </AlertDialogDescription>
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

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    open: { label: 'باز', className: 'bg-muted text-muted-foreground' },
    paid: { label: 'پرداخت شده', className: 'bg-success/10 text-success' },
    partial: { label: 'بخشی پرداخت', className: 'bg-warning/10 text-warning' },
    converted: { label: 'تبدیل شده', className: 'bg-primary/10 text-primary' },
    cancelled: { label: 'لغو شده', className: 'bg-destructive/10 text-destructive' },
  };
  const c = config[status] || config.open;
  return <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${c.className}`}>{c.label}</span>;
}

// --- Invoice Form ---

interface InvoiceFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settings: Settings | null;
  onSaved: () => void;
  editingInvoice: Invoice | null;
}

function InvoiceForm({ open, onOpenChange, settings, onSaved, editingInvoice }: InvoiceFormProps) {
  const [type, setType] = useState<InvoiceType>('sales');
  const [number, setNumber] = useState('');
  const [contactId, setContactId] = useState<string>('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [date, setDate] = useState<string>('');
  const [lines, setLines] = useState<InvoiceLineItem[]>([emptyLineItem(settings?.default_vat_rate || 0)]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerNationalId, setBuyerNationalId] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [globalConfig, setGlobalConfig] = useState<GlobalTotalsConfig>({
    discount_type: 'amount',
    discount_value: 0,
    tax_type: 'amount',
    tax_value: 0,
  });

  useEffect(() => {
    if (!open) return;
    supabase.from('contacts').select('*').order('full_name').then(({ data }) => setContacts((data as Contact[]) || []));

    if (editingInvoice) {
      // Load existing invoice for editing
      setType(editingInvoice.type);
      setNumber(editingInvoice.number);
      setContactId(editingInvoice.contact_id || '');
      setNotes(editingInvoice.notes || '');
      setBuyerName(editingInvoice.buyer_name || '');
      setBuyerNationalId(editingInvoice.buyer_national_id || '');
      setBuyerPhone(editingInvoice.buyer_phone || '');
      setBuyerAddress(editingInvoice.buyer_address || '');
      setGlobalConfig({
        discount_type: editingInvoice.global_discount_type || 'amount',
        discount_value: editingInvoice.global_discount_value || 0,
        tax_type: editingInvoice.global_tax_type || 'amount',
        tax_value: editingInvoice.global_tax_value || 0,
      });
      const jDate = parseJalaliInput(formatJalaliDate(editingInvoice.date));
      if (jDate) {
        setDate(`${jDate.jy}/${String(jDate.jm).padStart(2, '0')}/${String(jDate.jd).padStart(2, '0')}`);
      }
      // Load items
      supabase.from('invoice_items').select('*').eq('invoice_id', editingInvoice.id).then(({ data: itemsData }) => {
        if (itemsData && itemsData.length > 0) {
          setLines((itemsData as InvoiceItem[]).map((it) => ({
            key: Math.random().toString(36).slice(2),
            product_id: it.product_id,
            sku: it.sku || '',
            name: it.name,
            unit: it.unit,
            quantity: it.quantity,
            unit_price: it.unit_price,
            discount_type: it.discount_type,
            discount_value: it.discount_value,
            tax_rate: it.tax_rate,
          })));
        } else {
          setLines([emptyLineItem(settings?.default_vat_rate || 0)]);
        }
      });
    } else {
      // New invoice: auto-generate number
      const today = todayJalali();
      setDate(`${today.jy}/${String(today.jm).padStart(2, '0')}/${String(today.jd).padStart(2, '0')}`);
      setLines([emptyLineItem(settings?.default_vat_rate || 0)]);
      setType('sales');
      setContactId('');
      setNotes('');
      setBuyerName('');
      setBuyerNationalId('');
      setBuyerPhone('');
      setBuyerAddress('');
      setGlobalConfig({ discount_type: 'amount', discount_value: 0, tax_type: 'amount', tax_value: 0 });
      // Auto-generate next invoice number
      supabase.from('invoices').select('id', { count: 'exact', head: true }).then(({ count }) => {
        setNumber(generateInvoiceNumber(count || 0));
      });
    }
  }, [open, settings, editingInvoice]);

  useEffect(() => {
    if (contactId) {
      const c = contacts.find((ct) => ct.id === contactId);
      if (c) {
        setBuyerName(c.full_name);
        setBuyerNationalId(c.national_id || '');
        setBuyerPhone(c.phone || '');
        setBuyerAddress(c.address || '');
      }
    }
  }, [contactId, contacts]);

  const totals = calculateInvoiceTotals(lines, globalConfig);

  const updateLine = (index: number, patch: Partial<InvoiceLineItem>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, emptyLineItem(settings?.default_vat_rate || 0)]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProductSelect = (index: number, product: Product) => {
    updateLine(index, {
      product_id: product.id,
      sku: product.sku || '',
      name: product.name,
      unit: product.unit,
      unit_price: type === 'purchase' ? product.purchase_price : product.selling_price,
    });
  };

  const handleSave = async () => {
    if (lines.length === 0 || lines.every((l) => !l.name.trim())) return;
    setSaving(true);

    const parsed = parseJalaliInput(date);
    let gregorianDate = new Date().toISOString().split('T')[0];
    if (parsed) {
      gregorianDate = toGregorian(parsed.jy, parsed.jm, parsed.jd).toISOString().split('T')[0];
    }

    const sellerInfo = {
      seller_name: settings?.business_name || null,
      seller_national_id: settings?.economic_code || settings?.national_id || null,
      seller_phone: settings?.phone || null,
      seller_address: settings?.address || null,
    };

    const buyerInfo = type === 'purchase' ? {
      buyer_name: settings?.business_name || null,
      buyer_national_id: settings?.economic_code || settings?.national_id || null,
      buyer_phone: settings?.phone || null,
      buyer_address: settings?.address || null,
      seller_name: buyerName || null,
      seller_national_id: buyerNationalId || null,
      seller_phone: buyerPhone || null,
      seller_address: buyerAddress || null,
    } : {
      buyer_name: buyerName || null,
      buyer_national_id: buyerNationalId || null,
      buyer_phone: buyerPhone || null,
      buyer_address: buyerAddress || null,
    };

    const invoiceData = {
      number,
      type,
      date: gregorianDate,
      contact_id: contactId || null,
      ...sellerInfo,
      ...buyerInfo,
      subtotal: totals.subtotal,
      total_discount: totals.total_discount,
      total_tax: totals.total_tax,
      payable: totals.payable,
      global_discount_type: globalConfig.discount_type,
      global_discount_value: globalConfig.discount_value,
      global_tax_type: globalConfig.tax_type,
      global_tax_value: globalConfig.tax_value,
      notes: notes || null,
    };

    if (editingInvoice) {
      // Revert old effects, then apply new
      if (editingInvoice.type !== 'proforma') {
        await revertInvoiceEffects(editingInvoice);
      }
      await supabase.from('invoices').update({ ...invoiceData, status: 'open' }).eq('id', editingInvoice.id);
      await supabase.from('invoice_items').delete().eq('invoice_id', editingInvoice.id);

      const itemRows = lines.filter((l) => l.name.trim()).map((l) => {
        const calc = calculateLine(l);
        return {
          invoice_id: editingInvoice.id,
          product_id: l.product_id,
          sku: l.sku || null,
          name: l.name,
          unit: l.unit,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_type: l.discount_type,
          discount_value: l.discount_value,
          discount_amount: calc.discount_amount,
          tax_rate: l.tax_rate,
          tax_amount: calc.tax_amount,
          total: calc.total,
        };
      });
      await supabase.from('invoice_items').insert(itemRows);

      if (type !== 'proforma') {
        await applyInvoiceEffects({ ...editingInvoice, ...invoiceData } as Invoice, itemRows as unknown as InvoiceItem[]);
      }
    } else {
      const { data: newInvoice } = await supabase.from('invoices').insert({ ...invoiceData, status: 'open' }).select().single();

      if (newInvoice) {
        const itemRows = lines.filter((l) => l.name.trim()).map((l) => {
          const calc = calculateLine(l);
          return {
            invoice_id: newInvoice.id,
            product_id: l.product_id,
            sku: l.sku || null,
            name: l.name,
            unit: l.unit,
            quantity: l.quantity,
            unit_price: l.unit_price,
            discount_type: l.discount_type,
            discount_value: l.discount_value,
            discount_amount: calc.discount_amount,
            tax_rate: l.tax_rate,
            tax_amount: calc.tax_amount,
            total: calc.total,
          };
        });
        await supabase.from('invoice_items').insert(itemRows);

        if (type !== 'proforma') {
          await applyInvoiceEffects(newInvoice as Invoice, itemRows as unknown as InvoiceItem[]);
        }
      }
    }

    setSaving(false);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{editingInvoice ? 'ویرایش فاکتور' : 'فاکتور جدید'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Header fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>شماره فاکتور</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="۱۰۰۱" className="font-num" />
            </div>
            <div className="space-y-1.5">
              <Label>نوع فاکتور</Label>
              <Select value={type} onValueChange={(v) => setType(v as InvoiceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">فاکتور فروش</SelectItem>
                  <SelectItem value="purchase">فاکتور خرید</SelectItem>
                  <SelectItem value="proforma">پیش‌فاکتور</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>طرف حساب</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger><SelectValue placeholder="انتخاب..." /></SelectTrigger>
                <SelectContent>
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code ? `[${toPersianDigits(c.code)}] ` : ''}{c.full_name} {c.role === 'customer' ? '(مشتری)' : '(تامین‌کننده)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>تاریخ (شمسی)</Label>
              <Input value={date} onChange={(e) => setDate(e.target.value)} placeholder="۱۴۰۳/۰۱/۰۱" />
            </div>
          </div>

          {/* Buyer info */}
          <div className="rounded-lg border border-border bg-slate-50 p-3">
            <div className="mb-2 text-sm font-medium">{type === 'purchase' ? 'اطلاعات تامین‌کننده' : 'اطلاعات خریدار'}</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="نام" />
              <Input value={buyerNationalId} onChange={(e) => setBuyerNationalId(e.target.value)} placeholder="کد ملی / شناسه اقتصادی" />
              <Input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="تلفن" />
              <Input value={buyerAddress} onChange={(e) => setBuyerAddress(e.target.value)} placeholder="آدرس" />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="text-sm font-medium">اقلام فاکتور</div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-right">
                    <th className="p-2 font-medium min-w-[180px]">کالا</th>
                    <th className="p-2 font-medium w-20">تعداد</th>
                    <th className="p-2 font-medium w-28">قیمت واحد</th>
                    <th className="p-2 font-medium w-24">نوع تخفیف</th>
                    <th className="p-2 font-medium w-20">تخفیف</th>
                    <th className="p-2 font-medium w-20">مالیات٪</th>
                    <th className="p-2 font-medium w-28">جمع کل</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((line, i) => {
                    const calc = calculateLine(line);
                    return (
                      <tr key={line.key}>
                        <td className="p-2">
                          <ProductAutocomplete
                            value={line.name}
                            onSelect={(p) => handleProductSelect(i, p)}
                            placeholder="نام یا کد کالا..."
                          />
                        </td>
                        <td className="p-2">
                          <Input type="number" value={line.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} className="h-9 w-16 text-center font-num" />
                        </td>
                        <td className="p-2">
                          <Input type="number" value={line.unit_price} onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })} className="h-9 w-24 text-center font-num" />
                        </td>
                        <td className="p-2">
                          <Select value={line.discount_type} onValueChange={(v) => updateLine(i, { discount_type: v as DiscountType })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percent">درصد</SelectItem>
                              <SelectItem value="fixed">مبلغی</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input type="number" value={line.discount_value} onChange={(e) => updateLine(i, { discount_value: Number(e.target.value) })} className="h-9 w-20 text-center font-num" />
                        </td>
                        <td className="p-2">
                          <Input type="number" value={line.tax_rate} onChange={(e) => updateLine(i, { tax_rate: Number(e.target.value) })} className="h-9 w-16 text-center font-num" />
                        </td>
                        <td className="p-2 text-center font-num font-bold">{formatNumber(calc.total, 0)}</td>
                        <td className="p-2">
                          <Button variant="ghost" size="icon" onClick={() => removeLine(i)} disabled={lines.length === 1}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="ml-2 h-4 w-4" /> افزودن ردیف
            </Button>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>توضیحات</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="توضیحات اختیاری..." />
          </div>

          {/* Totals with global discount/tax */}
          <div className="flex justify-start">
            <div className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-slate-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">جمع کل اقلام:</span>
                <span className="font-num">{formatCurrency(totals.subtotal)}</span>
              </div>

              {/* Global discount */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">تخفیف کل:</Label>
                  <Select value={globalConfig.discount_type} onValueChange={(v) => setGlobalConfig({ ...globalConfig, discount_type: v as 'amount' | 'percent' })}>
                    <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">مبلغی</SelectItem>
                      <SelectItem value="percent">درصد</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={globalConfig.discount_value}
                    onChange={(e) => setGlobalConfig({ ...globalConfig, discount_value: Number(e.target.value) })}
                    className="h-8 w-28 text-left font-num"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>مبلغ تخفیف:</span>
                  <span className="font-num text-destructive">{formatCurrency(totals.global_discount)}</span>
                </div>
              </div>

              {/* Global tax */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">مالیات بر ارزش افزوده:</Label>
                  <Select value={globalConfig.tax_type} onValueChange={(v) => setGlobalConfig({ ...globalConfig, tax_type: v as 'amount' | 'percent' })}>
                    <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">مبلغی</SelectItem>
                      <SelectItem value="percent">درصد</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={globalConfig.tax_value}
                    onChange={(e) => setGlobalConfig({ ...globalConfig, tax_value: Number(e.target.value) })}
                    className="h-8 w-28 text-left font-num"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>مبلغ مالیات:</span>
                  <span className="font-num">{formatCurrency(totals.global_tax)}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">تخفیف کل (ردیفی + سرجمع):</span>
                <span className="font-num text-destructive">{formatCurrency(totals.total_discount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">مالیات کل:</span>
                <span className="font-num">{formatCurrency(totals.total_tax)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>مبلغ نهایی:</span>
                <span className="font-num text-primary">{formatCurrency(totals.payable)}</span>
              </div>
            </div>
          </div>

          {type === 'proforma' && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
              <FileText className="ml-2 inline h-4 w-4" />
              پیش‌فاکتور تأثیری روی موجودی کالا و مانده حساب اشخاص ندارد. با تبدیل به فاکتور فروش، این موارد اعمال می‌شوند.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
          <Button onClick={handleSave} disabled={saving || lines.every((l) => !l.name.trim())}>
            {saving ? 'در حال ذخیره...' : editingInvoice ? 'ذخیره تغییرات' : 'ذخیره فاکتور'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Business Logic Helpers ---

async function applyInvoiceEffects(invoice: Invoice, items: InvoiceItem[]) {
  const contactId = invoice.contact_id;
  if (!contactId) return;

  const amount = Number(invoice.payable);

  if (invoice.type === 'sales') {
    const { data: c } = await supabase.from('contacts').select('balance').eq('id', contactId).maybeSingle();
    if (c) await supabase.from('contacts').update({ balance: (Number(c.balance) || 0) + amount }).eq('id', contactId);
    for (const item of items) {
      if (item.product_id) {
        const { data: p } = await supabase.from('products').select('stock').eq('id', item.product_id).maybeSingle();
        if (p) await supabase.from('products').update({ stock: Number(p.stock) - Number(item.quantity) }).eq('id', item.product_id);
      }
    }
  } else if (invoice.type === 'purchase') {
    const { data: c } = await supabase.from('contacts').select('balance').eq('id', contactId).maybeSingle();
    if (c) await supabase.from('contacts').update({ balance: Number(c.balance) - amount }).eq('id', contactId);
    for (const item of items) {
      if (item.product_id) {
        const { data: p } = await supabase.from('products').select('stock').eq('id', item.product_id).maybeSingle();
        if (p) await supabase.from('products').update({ stock: Number(p.stock) + Number(item.quantity) }).eq('id', item.product_id);
      }
    }
  }
}

async function revertInvoiceEffects(invoice: Invoice) {
  const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id);
  if (!items) return;
  const contactId = invoice.contact_id;
  const amount = Number(invoice.payable);

  if (invoice.type === 'sales' && contactId) {
    const { data: c } = await supabase.from('contacts').select('balance').eq('id', contactId).maybeSingle();
    if (c) await supabase.from('contacts').update({ balance: Number(c.balance) - amount }).eq('id', contactId);
    for (const item of items) {
      if (item.product_id) {
        const { data: p } = await supabase.from('products').select('stock').eq('id', item.product_id).maybeSingle();
        if (p) await supabase.from('products').update({ stock: Number(p.stock) + Number(item.quantity) }).eq('id', item.product_id);
      }
    }
  } else if (invoice.type === 'purchase' && contactId) {
    const { data: c } = await supabase.from('contacts').select('balance').eq('id', contactId).maybeSingle();
    if (c) await supabase.from('contacts').update({ balance: Number(c.balance) + amount }).eq('id', contactId);
    for (const item of items) {
      if (item.product_id) {
        const { data: p } = await supabase.from('products').select('stock').eq('id', item.product_id).maybeSingle();
        if (p) await supabase.from('products').update({ stock: Number(p.stock) - Number(item.quantity) }).eq('id', item.product_id);
      }
    }
  }
}
