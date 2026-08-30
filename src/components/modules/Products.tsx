import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle } from 'lucide-react';
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
import type { Product } from '@/lib/types';

const UNITS = ['عدد', 'کیلوگرم', 'گرم', 'بسته', 'جعبه', 'لیتر', 'متر', 'متر مربع'];

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }
    const { data } = await query;
    setProducts((data as Product[]) || []);
    setLoading(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (formData: Partial<Product>) => {
    if (editing) {
      await supabase.from('products').update({ ...formData }).eq('id', editing.id);
    } else {
      await supabase.from('products').insert({ ...formData });
    }
    setDialogOpen(false);
    setEditing(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('products').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="جستجو بر اساس نام یا کد کالا..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="ml-2 h-4 w-4" /> کالای جدید
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">کالایی ثبت نشده است</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-right">
                    <th className="p-3 font-medium">کد کالا</th>
                    <th className="p-3 font-medium">نام کالا</th>
                    <th className="p-3 font-medium">واحد</th>
                    <th className="p-3 font-medium">قیمت خرید</th>
                    <th className="p-3 font-medium">قیمت فروش</th>
                    <th className="p-3 font-medium">موجودی</th>
                    <th className="p-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {products.map((p) => {
                    const isLow = Number(p.stock) <= Number(p.low_stock_threshold);
                    return (
                      <tr key={p.id} className="transition-colors hover:bg-muted/30">
                        <td className="p-3 font-num text-muted-foreground">{p.sku ? toPersianDigits(p.sku) : '-'}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span className="font-medium">{p.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{p.unit}</td>
                        <td className="p-3 font-num">{formatCurrency(p.purchase_price)}</td>
                        <td className="p-3 font-num">{formatCurrency(p.selling_price)}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-num ${isLow ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
                            {isLow && <AlertTriangle className="h-3 w-3" />}
                            {formatNumber(p.stock)} {p.unit}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setDialogOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ProductDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} onSave={handleSave} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف کالا</AlertDialogTitle>
            <AlertDialogDescription>آیا از حذف این کالا مطمئن هستید؟</AlertDialogDescription>
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

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Product | null;
  onSave: (data: Partial<Product>) => void;
}

function ProductDialog({ open, onOpenChange, editing, onSave }: ProductDialogProps) {
  const [form, setForm] = useState({
    sku: '', name: '', unit: 'عدد', purchase_price: 0, selling_price: 0, stock: 0, low_stock_threshold: 5,
  });

  useEffect(() => {
    if (editing) {
      setForm({
        sku: editing.sku || '',
        name: editing.name,
        unit: editing.unit,
        purchase_price: editing.purchase_price,
        selling_price: editing.selling_price,
        stock: editing.stock,
        low_stock_threshold: editing.low_stock_threshold,
      });
    } else {
      setForm({ sku: '', name: '', unit: 'عدد', purchase_price: 0, selling_price: 0, stock: 0, low_stock_threshold: 5 });
    }
  }, [editing, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'ویرایش کالا' : 'افزودن کالای جدید'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>کد کالا / SKU</Label>
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="مثال: P-001" />
          </div>
          <div className="space-y-1.5">
            <Label>نام کالا *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>واحد</Label>
            <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>موجودی فعلی</Label>
            <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>قیمت خرید (ریال)</Label>
            <Input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>قیمت فروش (ریال)</Label>
            <Input type="number" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>حد هشدار موجودی</Label>
            <Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>انصراف</Button>
          <Button onClick={() => onSave(form)} disabled={!form.name.trim()}>ذخیره</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
