import { useEffect, useState, useCallback } from 'react';
import { Search, BookOpen, TrendingUp, TrendingDown, FileText, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { formatJalaliDate, toPersianDigits } from '@/lib/jalali';
import InvoiceDetailModal from '@/components/invoice/InvoiceDetailModal';
import type { Contact, Invoice, Payment, Settings } from '@/lib/types';

interface LedgerEntry {
  id: string;
  date: string;
  type: 'invoice' | 'payment' | 'initial';
  description: string;
  docNumber: string;
  debit: number;
  credit: number;
  balance: number;
  invoiceId?: string | null;
}

interface LedgerProps {
  settings: Settings | null;
}

export default function Ledger({ settings }: LedgerProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('contacts').select('*').order('full_name').then(({ data }) => {
      setContacts((data as Contact[]) || []);
      if (data && data.length > 0) setSelectedId((data as Contact[])[0].id);
    });
  }, []);

  const loadEntries = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    const contact = contacts.find((c) => c.id === selectedId);

    const [invRes, payRes] = await Promise.all([
      supabase.from('invoices').select('id, number, type, date, payable, status').eq('contact_id', selectedId).order('date', { ascending: true }),
      supabase.from('payments').select('id, number, date, direction, amount, notes').eq('contact_id', selectedId).order('date', { ascending: true }),
    ]);

    const allEntries: LedgerEntry[] = [];

    if (contact) {
      allEntries.push({
        id: 'initial',
        date: contact.created_at,
        type: 'initial',
        description: 'مانده اول دوره',
        docNumber: '-',
        debit: contact.initial_balance > 0 ? contact.initial_balance : 0,
        credit: contact.initial_balance < 0 ? Math.abs(contact.initial_balance) : 0,
        balance: contact.initial_balance,
      });
    }

    for (const inv of (invRes.data as Invoice[]) || []) {
      if (inv.type === 'proforma') continue;
      const isSales = inv.type === 'sales';
      allEntries.push({
        id: inv.id,
        date: inv.date,
        type: 'invoice',
        description: isSales ? 'فاکتور فروش' : 'فاکتور خرید',
        docNumber: inv.number,
        debit: isSales ? Number(inv.payable) : 0,
        credit: !isSales ? Number(inv.payable) : 0,
        balance: 0,
        invoiceId: inv.id,
      });
    }

    for (const pay of (payRes.data as Payment[]) || []) {
      allEntries.push({
        id: pay.id,
        date: pay.date,
        type: 'payment',
        description: pay.direction === 'receipt' ? 'دریافت وجه' : 'پرداخت وجه',
        docNumber: pay.number,
        debit: pay.direction === 'payment' ? Number(pay.amount) : 0,
        credit: pay.direction === 'receipt' ? Number(pay.amount) : 0,
        balance: 0,
      });
    }

    allEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = contact?.initial_balance || 0;
    for (const e of allEntries) {
      if (e.id === 'initial') { e.balance = running; continue; }
      running += e.debit - e.credit;
      e.balance = running;
    }

    setEntries(allEntries);
    setLoading(false);
  }, [selectedId, contacts]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const filteredContacts = contacts.filter((c) =>
    !search.trim() || c.full_name.includes(search) || (c.phone || '').includes(search)
  );
  const selectedContact = contacts.find((c) => c.id === selectedId);
  const filteredEntries = entries.filter((e) =>
    !search.trim() || e.docNumber.includes(search) || e.description.includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="انتخاب شخص..." /></SelectTrigger>
          <SelectContent>
            {filteredContacts.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.role === 'customer' ? 'مشتری' : 'تامین‌کننده'})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="جستجو در گردش حساب..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
        </div>
      </div>

      {selectedContact && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <span className="text-xs text-muted-foreground">مانده فعلی</span>
                <div className={`text-lg font-bold font-num ${selectedContact.balance > 0 ? 'text-destructive' : selectedContact.balance < 0 ? 'text-success' : 'text-muted-foreground'}`}>
                  {formatCurrency(selectedContact.balance)}
                </div>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${selectedContact.balance > 0 ? 'bg-destructive/10 text-destructive' : selectedContact.balance < 0 ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                <BookOpen className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <span className="text-xs text-muted-foreground">بدهکار</span>
                <div className="text-lg font-bold font-num text-destructive">{formatCurrency(entries.reduce((s, e) => s + e.debit, 0))}</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                <TrendingUp className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <span className="text-xs text-muted-foreground">بستانکار</span>
                <div className="text-lg font-bold font-num text-success">{formatCurrency(entries.reduce((s, e) => s + e.credit, 0))}</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                <TrendingDown className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">گردش حساب {selectedContact?.full_name || ''}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />)}
            </div>
          ) : filteredEntries.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">تراکنشی ثبت نشده است</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-right">
                    <th className="p-3 font-medium">تاریخ</th>
                    <th className="p-3 font-medium">نوع سند</th>
                    <th className="p-3 font-medium">شرح</th>
                    <th className="p-3 font-medium">شماره</th>
                    <th className="p-3 font-medium">بدهکار</th>
                    <th className="p-3 font-medium">بستانکار</th>
                    <th className="p-3 font-medium">مانده</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEntries.map((e) => (
                    <tr
                      key={e.id}
                      className={`transition-colors ${e.invoiceId ? 'cursor-pointer hover:bg-primary/5' : 'hover:bg-muted/30'}`}
                      onClick={() => e.invoiceId && setDetailId(e.invoiceId)}
                    >
                      <td className="p-3 font-num text-muted-foreground">{formatJalaliDate(e.date)}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          {e.type === 'invoice' && <FileText className="h-3.5 w-3.5 text-primary" />}
                          {e.type === 'payment' && <Wallet className="h-3.5 w-3.5 text-success" />}
                          {e.type === 'initial' && <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />}
                          <span className="text-xs">{e.description}</span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{e.description}</td>
                      <td className="p-3 font-num text-muted-foreground">{e.docNumber !== '-' ? toPersianDigits(e.docNumber) : '-'}</td>
                      <td className="p-3 font-num text-destructive">{e.debit > 0 ? formatCurrency(e.debit) : '-'}</td>
                      <td className="p-3 font-num text-success">{e.credit > 0 ? formatCurrency(e.credit) : '-'}</td>
                      <td className={`p-3 font-num font-bold ${e.balance > 0 ? 'text-destructive' : e.balance < 0 ? 'text-success' : 'text-muted-foreground'}`}>
                        {formatCurrency(e.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <InvoiceDetailModal
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        invoiceId={detailId}
        settings={settings}
        onEdit={(id) => {
          setDetailId(null);
          window.dispatchEvent(new CustomEvent('navigate-to-invoices-edit', { detail: { id } }));
        }}
      />
    </div>
  );
}
