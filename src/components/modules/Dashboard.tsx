import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, FileText, Users, Package, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber } from '@/lib/format';
import { formatJalaliDate, toPersianDigits } from '@/lib/jalali';
import type { View } from '@/App';

interface DashboardData {
  totalSales: number;
  totalPurchases: number;
  totalReceivables: number;
  totalPayables: number;
  invoiceCount: number;
  contactCount: number;
  productCount: number;
  lowStockCount: number;
  recentInvoices: Array<{
    id: string;
    number: string;
    type: string;
    date: string;
    payable: number;
    contact?: { full_name: string };
  }>;
  lowStockProducts: Array<{
    id: string;
    name: string;
    sku: string | null;
    stock: number;
    unit: string;
  }>;
}

export default function Dashboard({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-32 animate-pulse bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="فروش کل"
          value={formatCurrency(data.totalSales)}
          icon={TrendingUp}
          color="text-success"
          bg="bg-success/10"
        />
        <StatCard
          title="خرید کل"
          value={formatCurrency(data.totalPurchases)}
          icon={TrendingDown}
          color="text-primary"
          bg="bg-primary/10"
        />
        <StatCard
          title="طلب‌کار (بستانکار)"
          value={formatCurrency(data.totalReceivables)}
          icon={TrendingUp}
          color="text-warning"
          bg="bg-warning/10"
        />
        <StatCard
          title="بده‌کار"
          value={formatCurrency(data.totalPayables)}
          icon={TrendingDown}
          color="text-destructive"
          bg="bg-destructive/10"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat label="فاکتورها" value={formatNumber(data.invoiceCount)} icon={FileText} onClick={() => onNavigate('invoices')} />
        <MiniStat label="اشخاص" value={formatNumber(data.contactCount)} icon={Users} onClick={() => onNavigate('contacts')} />
        <MiniStat label="کالاها" value={formatNumber(data.productCount)} icon={Package} onClick={() => onNavigate('products')} />
        <MiniStat label="کم‌ موجود" value={formatNumber(data.lowStockCount)} icon={AlertTriangle} onClick={() => onNavigate('products')} danger={data.lowStockCount > 0} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent invoices */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">آخرین فاکتورها</CardTitle>
            <button onClick={() => onNavigate('invoices')} className="flex items-center gap-1 text-sm text-primary hover:underline">
              مشاهده همه <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          </CardHeader>
          <CardContent>
            {data.recentInvoices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">فاکتوری ثبت نشده است</p>
            ) : (
              <div className="space-y-2">
                {data.recentInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{inv.number}</span>
                      <span className="text-xs text-muted-foreground">
                        {inv.contact?.full_name || 'بدون نام'} - {formatJalaliDate(inv.date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <InvoiceTypeBadge type={inv.type} />
                      <span className="text-sm font-bold font-num">{formatCurrency(inv.payable)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low stock alert */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">هشدار کم‌موجودی</CardTitle>
            <button onClick={() => onNavigate('products')} className="flex items-center gap-1 text-sm text-primary hover:underline">
              مدیریت کالاها <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          </CardHeader>
          <CardContent>
            {data.lowStockProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">همه کالاها موجودی کافی دارند</p>
            ) : (
              <div className="space-y-2">
                {data.lowStockProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/5 p-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{p.name}</span>
                      {p.sku && <span className="text-xs text-muted-foreground">کد: {toPersianDigits(p.sku)}</span>}
                    </div>
                    <span className="text-sm font-bold text-warning font-num">
                      {formatNumber(p.stock)} {p.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, bg }: { title: string; value: string; icon: typeof TrendingUp; color: string; bg: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{title}</span>
            <span className="text-xl font-bold font-num">{value}</span>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bg}`}>
            <Icon className={`h-6 w-6 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, icon: Icon, onClick, danger }: { label: string; value: string; icon: typeof FileText; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-right transition-colors hover:bg-muted/50">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${danger ? 'bg-warning/10' : 'bg-muted'}`}>
        <Icon className={`h-5 w-5 ${danger ? 'text-warning' : 'text-muted-foreground'}`} />
      </div>
      <div className="flex flex-col">
        <span className="text-lg font-bold font-num">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </button>
  );
}

function InvoiceTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; className: string }> = {
    sales: { label: 'فروش', className: 'bg-success/10 text-success' },
    purchase: { label: 'خرید', className: 'bg-primary/10 text-primary' },
    proforma: { label: 'پیش‌فاکتور', className: 'bg-warning/10 text-warning' },
  };
  const c = config[type] || config.sales;
  return <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${c.className}`}>{c.label}</span>;
}

async function loadData(): Promise<DashboardData> {
  const [invoices, contacts, products, lowStock] = await Promise.all([
    supabase.from('invoices').select('id, number, type, date, payable, contact:contacts(full_name)').order('created_at', { ascending: false }).limit(50),
    supabase.from('contacts').select('id, role, balance'),
    supabase.from('products').select('id, name, sku, stock, unit, low_stock_threshold'),
    null,
  ]);

  const invoiceList = invoices.data || [];
  const contactList = contacts.data || [];
  const productList = products.data || [];

  const totalSales = invoiceList.filter((i) => i.type === 'sales').reduce((s, i) => s + Number(i.payable), 0);
  const totalPurchases = invoiceList.filter((i) => i.type === 'purchase').reduce((s, i) => s + Number(i.payable), 0);
  const totalReceivables = contactList.filter((c) => c.balance > 0).reduce((s, c) => s + Number(c.balance), 0);
  const totalPayables = contactList.filter((c) => c.balance < 0).reduce((s, c) => s + Math.abs(Number(c.balance)), 0);

  const lowStockProducts = productList.filter((p) => Number(p.stock) <= Number((p as { low_stock_threshold: number }).low_stock_threshold || 5));
  const recentInvoices = invoiceList.slice(0, 5);

  return {
    totalSales,
    totalPurchases,
    totalReceivables,
    totalPayables,
    invoiceCount: invoiceList.length,
    contactCount: contactList.length,
    productCount: productList.length,
    lowStockCount: lowStockProducts.length,
    recentInvoices: recentInvoices as unknown as DashboardData['recentInvoices'],
    lowStockProducts: lowStockProducts.map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: Number(p.stock), unit: p.unit })),
  };
}
