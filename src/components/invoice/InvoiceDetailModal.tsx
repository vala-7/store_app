import { useEffect, useState } from 'react';
import { Printer, X, Store, User, Pencil, Settings2, Hash } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber } from '@/lib/format';
import { formatJalaliDate, toPersianDigits } from '@/lib/jalali';
import type { Invoice, InvoiceItem, Settings, Contact } from '@/lib/types';

interface InvoiceDetailModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invoiceId: string | null;
  settings: Settings | null;
  onEdit?: (invoiceId: string) => void;
}

export default function InvoiceDetailModal({ open, onOpenChange, invoiceId, settings, onEdit }: InvoiceDetailModalProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [contactBalance, setContactBalance] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<Settings | null>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!invoiceId || !open) return;
    setLoading(true);
    setContactBalance(null);
    Promise.all([
      supabase.from('invoices').select('*, contact:contacts(id, full_name, role, code)').eq('id', invoiceId).maybeSingle(),
      supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: true }),
    ]).then(([invRes, itemsRes]) => {
      const inv = invRes.data as Invoice | null;
      setInvoice(inv);
      setItems((itemsRes.data as InvoiceItem[]) || []);
      setLoading(false);
      // Fetch previous balance if needed
      if (inv?.contact_id && localSettings?.print_show_previous_balance) {
        supabase.from('contacts').select('balance').eq('id', inv.contact_id).maybeSingle().then(({ data }) => {
          if (data) setContactBalance(Number((data as Contact).balance) - Number(inv.payable));
        });
      }
    });
  }, [invoiceId, open, localSettings]);

  const handlePrint = () => {
    // Apply paper size class to body before printing
    if (localSettings?.print_paper_size === 'A5') {
      document.body.classList.add('print-a5');
    } else {
      document.body.classList.remove('print-a5');
    }
    window.print();
  };

  if (!open) return null;

  const typeLabels: Record<string, string> = {
    sales: 'فاکتور فروش',
    purchase: 'فاکتور خرید',
    proforma: 'پیش‌فاکتور',
  };
  const typeColors: Record<string, string> = {
    sales: 'bg-success/10 text-success',
    purchase: 'bg-primary/10 text-primary',
    proforma: 'bg-warning/10 text-warning',
  };

  const ps = localSettings;
  const showLogo = ps?.print_show_logo ?? true;
  const showSellerContact = ps?.print_show_seller_contact ?? true;
  const showBuyerNid = ps?.print_show_buyer_national_id ?? true;
  const showProductCode = ps?.print_show_product_code ?? true;
  const showTaxCol = ps?.print_show_tax_column ?? true;
  const showDiscountCol = ps?.print_show_discount_column ?? true;
  const showPrevBalance = ps?.print_show_previous_balance ?? false;
  const showSignatures = ps?.print_show_signatures ?? true;
  const defaultNotes = ps?.print_default_notes || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-auto">
          <DialogHeader className="no-print">
            <DialogTitle className="flex items-center justify-between">
              <span>مشاهده فاکتور</span>
              <div className="flex gap-1">
                {onEdit && invoice && invoice.status !== 'converted' && (
                  <Button variant="outline" size="sm" onClick={() => onEdit(invoiceId!)}>
                    <Pencil className="ml-1.5 h-4 w-4" /> ویرایش فاکتور
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="تنظیمات چاپ">
                  <Settings2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="h-64 animate-pulse rounded-lg bg-muted/40" />
          ) : invoice ? (
            <div className="print-area space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between border-b-2 border-primary pb-4">
                <div className="flex items-center gap-3">
                  {showLogo && (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <Store className="h-6 w-6" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-bold">{settings?.business_name || 'فروشگاه'}</h2>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${typeColors[invoice.type]}`}>
                      {typeLabels[invoice.type]}
                    </span>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold">شماره: {toPersianDigits(invoice.number)}</div>
                  <div className="text-sm text-muted-foreground">تاریخ: {formatJalaliDate(invoice.date)}</div>
                  {invoice.status === 'converted' && (
                    <div className="mt-1 text-xs text-success">تبدیل شده به فاکتور فروش</div>
                  )}
                </div>
              </div>

              {/* Seller & Buyer */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-slate-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
                    <Store className="h-4 w-4" /> فروشنده
                  </div>
                  <div className="space-y-1 text-sm">
                    <div><span className="text-muted-foreground">نام: </span>{invoice.seller_name || settings?.business_name || '-'}</div>
                    {showSellerContact && (
                      <>
                        <div><span className="text-muted-foreground">کد ملی / شناسه اقتصادی: </span>{invoice.seller_national_id || settings?.economic_code || '-'}</div>
                        <div><span className="text-muted-foreground">تلفن: </span>{invoice.seller_phone || settings?.phone || '-'}</div>
                        <div><span className="text-muted-foreground">آدرس: </span>{invoice.seller_address || settings?.address || '-'}</div>
                      </>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-slate-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
                    <User className="h-4 w-4" /> خریدار
                  </div>
                  <div className="space-y-1 text-sm">
                    <div><span className="text-muted-foreground">نام: </span>{invoice.buyer_name || invoice.contact?.full_name || '-'}</div>
                    {showBuyerNid && (
                      <div><span className="text-muted-foreground">کد ملی / شناسه اقتصادی: </span>{invoice.buyer_national_id || '-'}</div>
                    )}
                    <div><span className="text-muted-foreground">تلفن: </span>{invoice.buyer_phone || '-'}</div>
                    <div><span className="text-muted-foreground">آدرس: </span>{invoice.buyer_address || '-'}</div>
                  </div>
                </div>
              </div>

              {/* Items table */}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 text-right">
                      <th className="p-2.5 font-medium">ردیف</th>
                      {showProductCode && <th className="p-2.5 font-medium">کد کالا</th>}
                      <th className="p-2.5 font-medium">شرح کالا</th>
                      <th className="p-2.5 font-medium">تعداد</th>
                      <th className="p-2.5 font-medium">واحد</th>
                      <th className="p-2.5 font-medium">قیمت واحد</th>
                      {showDiscountCol && <th className="p-2.5 font-medium">تخفیف</th>}
                      {showTaxCol && <th className="p-2.5 font-medium">مالیات</th>}
                      <th className="p-2.5 font-medium">جمع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item, i) => (
                      <tr key={item.id}>
                        <td className="p-2.5 text-center font-num">{toPersianDigits(i + 1)}</td>
                        {showProductCode && <td className="p-2.5 font-num text-muted-foreground">{item.sku ? toPersianDigits(item.sku) : '-'}</td>}
                        <td className="p-2.5 font-medium">{item.name}</td>
                        <td className="p-2.5 text-center font-num">{formatNumber(item.quantity)}</td>
                        <td className="p-2.5 text-center text-muted-foreground">{item.unit}</td>
                        <td className="p-2.5 text-center font-num">{formatCurrency(item.unit_price)}</td>
                        {showDiscountCol && <td className="p-2.5 text-center font-num text-destructive">{formatCurrency(item.discount_amount)}</td>}
                        {showTaxCol && <td className="p-2.5 text-center font-num">{formatCurrency(item.tax_amount)}</td>}
                        <td className="p-2.5 text-center font-num font-bold">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-start">
                <div className="w-full max-w-xs space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">جمع کل:</span>
                    <span className="font-num">{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">تخفیف کل:</span>
                    <span className="font-num text-destructive">{formatCurrency(invoice.total_discount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">مالیات بر ارزش افزوده:</span>
                    <span className="font-num">{formatCurrency(invoice.total_tax)}</span>
                  </div>
                  {showPrevBalance && contactBalance !== null && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">مانده قبلی:</span>
                      <span className="font-num">{formatCurrency(contactBalance)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-base font-bold">
                    <span>مبلغ نهایی:</span>
                    <span className="font-num text-primary">{formatCurrency(invoice.payable)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {invoice.notes && (
                <div className="rounded-lg border border-border bg-slate-50 p-3 text-sm">
                  <span className="text-muted-foreground">توضیحات: </span>{invoice.notes}
                </div>
              )}

              {/* Default notes */}
              {defaultNotes.length > 0 && (
                <div className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  {defaultNotes.filter((n) => n.trim()).map((note, i) => (
                    <div key={i}>{toPersianDigits(`${i + 1}. `)}{note}</div>
                  ))}
                </div>
              )}

              {/* Signatures */}
              {showSignatures && (
                <div className="print-signatures hidden justify-between pt-8 print:flex">
                  <div className="text-center text-sm">
                    <div className="mb-12 text-muted-foreground">مهر و امضای فروشنده</div>
                    <div className="border-t border-border pt-1">‌</div>
                  </div>
                  <div className="text-center text-sm">
                    <div className="mb-12 text-muted-foreground">مهر و امضای خریدار</div>
                    <div className="border-t border-border pt-1">‌</div>
                  </div>
                </div>
              )}

              {/* Print button */}
              <div className="flex justify-end gap-2 no-print">
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="ml-2 h-4 w-4" /> چاپ فاکتور
                </Button>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">فاکتور یافت نشد</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Print Settings Drawer */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" /> تنظیمات چاپ فاکتور
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-8">
            <div className="space-y-2">
              <label className="text-sm font-medium">سایز کاغذ</label>
              <Select
                value={localSettings?.print_paper_size || 'A4'}
                onValueChange={(v) => setLocalSettings({ ...(localSettings as Settings), print_paper_size: v as 'A4' | 'A5' })}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4">A4 - استاندارد</SelectItem>
                  <SelectItem value="A5">A5 - فشرده</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-3">
              <label className="text-sm font-medium">نمایش فیلدها</label>
              <QuickToggle label="لوگو و اطلاعات فروشنده" checked={showLogo} onChange={(v) => setLocalSettings({ ...(localSettings as Settings), print_show_logo: v })} />
              <QuickToggle label="اطلاعات تماس فروشنده" checked={showSellerContact} onChange={(v) => setLocalSettings({ ...(localSettings as Settings), print_show_seller_contact: v })} />
              <QuickToggle label="کد ملی / شناسه اقتصادی خریدار" checked={showBuyerNid} onChange={(v) => setLocalSettings({ ...(localSettings as Settings), print_show_buyer_national_id: v })} />
              <QuickToggle label="ستون کد کالا" checked={showProductCode} onChange={(v) => setLocalSettings({ ...(localSettings as Settings), print_show_product_code: v })} />
              <QuickToggle label="ستون مالیات / ارزش افزوده" checked={showTaxCol} onChange={(v) => setLocalSettings({ ...(localSettings as Settings), print_show_tax_column: v })} />
              <QuickToggle label="ستون تخفیف" checked={showDiscountCol} onChange={(v) => setLocalSettings({ ...(localSettings as Settings), print_show_discount_column: v })} />
              <QuickToggle label="مانده قبلی مشتری" checked={showPrevBalance} onChange={(v) => setLocalSettings({ ...(localSettings as Settings), print_show_previous_balance: v })} />
              <QuickToggle label="محل مهر و امضا" checked={showSignatures} onChange={(v) => setLocalSettings({ ...(localSettings as Settings), print_show_signatures: v })} />
            </div>
            <Separator />
            <Button className="w-full" onClick={() => setSettingsOpen(false)}>
              اعمال و بستن
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function QuickToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-slate-50 px-3 py-2.5">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
