import { useState, useEffect } from 'react';
import { Store, Save, Check, Printer, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import type { Settings } from '@/lib/types';

interface SettingsModuleProps {
  settings: Settings | null;
  onSaved: (s: Settings) => void;
}

export default function SettingsModule({ settings, onSaved }: SettingsModuleProps) {
  const [form, setForm] = useState({
    business_name: '',
    economic_code: '',
    national_id: '',
    phone: '',
    address: '',
    default_vat_rate: 0,
    print_paper_size: 'A4' as 'A4' | 'A5',
    print_show_logo: true,
    print_show_seller_contact: true,
    print_show_buyer_national_id: true,
    print_show_product_code: true,
    print_show_tax_column: true,
    print_show_discount_column: true,
    print_show_previous_balance: false,
    print_show_signatures: true,
    print_default_notes: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        business_name: settings.business_name || '',
        economic_code: settings.economic_code || '',
        national_id: settings.national_id || '',
        phone: settings.phone || '',
        address: settings.address || '',
        default_vat_rate: settings.default_vat_rate || 0,
        print_paper_size: settings.print_paper_size || 'A4',
        print_show_logo: settings.print_show_logo ?? true,
        print_show_seller_contact: settings.print_show_seller_contact ?? true,
        print_show_buyer_national_id: settings.print_show_buyer_national_id ?? true,
        print_show_product_code: settings.print_show_product_code ?? true,
        print_show_tax_column: settings.print_show_tax_column ?? true,
        print_show_discount_column: settings.print_show_discount_column ?? true,
        print_show_previous_balance: settings.print_show_previous_balance ?? false,
        print_show_signatures: settings.print_show_signatures ?? true,
        print_default_notes: settings.print_default_notes || [],
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    const { data } = await supabase.from('settings').update({
      business_name: form.business_name,
      economic_code: form.economic_code || null,
      national_id: form.national_id || null,
      phone: form.phone || null,
      address: form.address || null,
      default_vat_rate: form.default_vat_rate,
      print_paper_size: form.print_paper_size,
      print_show_logo: form.print_show_logo,
      print_show_seller_contact: form.print_show_seller_contact,
      print_show_buyer_national_id: form.print_show_buyer_national_id,
      print_show_product_code: form.print_show_product_code,
      print_show_tax_column: form.print_show_tax_column,
      print_show_discount_column: form.print_show_discount_column,
      print_show_previous_balance: form.print_show_previous_balance,
      print_show_signatures: form.print_show_signatures,
      print_default_notes: form.print_default_notes.filter((n) => n.trim()),
      updated_at: new Date().toISOString(),
    }).eq('id', 1).select().single();

    setSaving(false);
    setSaved(true);
    if (data) onSaved(data as Settings);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateNote = (index: number, value: string) => {
    setForm((prev) => {
      const notes = [...prev.print_default_notes];
      notes[index] = value;
      return { ...prev, print_default_notes: notes };
    });
  };

  const addNote = () => {
    if (form.print_default_notes.length < 5) {
      setForm({ ...form, print_default_notes: [...form.print_default_notes, ''] });
    }
  };

  const removeNote = (index: number) => {
    setForm({ ...form, print_default_notes: form.print_default_notes.filter((_, i) => i !== index) });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>پروفایل فروشگاه</CardTitle>
              <p className="text-sm text-muted-foreground">این اطلاعات در سربرگ فاکتورها استفاده می‌شود</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>نام فروشگاه / کسب و کار</Label>
            <Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="مثال: فروشگاه نمونه" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>شناسه اقتصادی</Label>
              <Input value={form.economic_code} onChange={(e) => setForm({ ...form, economic_code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>کد ملی</Label>
              <Input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>تلفن</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="۰۲۱-۱۲۳۴۵۶۷۸" />
          </div>
          <div className="space-y-1.5">
            <Label>آدرس</Label>
            <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3} />
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Label>نرخ پیش‌فرض مالیات بر ارزش افزوده (٪)</Label>
            <Input type="number" value={form.default_vat_rate} onChange={(e) => setForm({ ...form, default_vat_rate: Number(e.target.value) })} />
            <p className="text-xs text-muted-foreground">این نرخ به‌صورت پیش‌فرض در اقلام فاکتور اعمال می‌شود</p>
          </div>
        </CardContent>
      </Card>

      {/* Print Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Printer className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>تنظیمات چاپ فاکتور</CardTitle>
              <p className="text-sm text-muted-foreground">سفارشی‌سازی فیلدها و فرمت چاپ فاکتور</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Paper Size */}
          <div className="space-y-2">
            <Label>سایز کاغذ</Label>
            <Select value={form.print_paper_size} onValueChange={(v) => setForm({ ...form, print_paper_size: v as 'A4' | 'A5' })}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4 - استاندارد</SelectItem>
                <SelectItem value="A5">A5 - فشرده</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Print Field Toggles */}
          <div className="space-y-3">
            <Label>نمایش فیلدهای چاپ</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ToggleRow
                label="لوگو و اطلاعات فروشنده"
                checked={form.print_show_logo}
                onChange={(v) => setForm({ ...form, print_show_logo: v })}
              />
              <ToggleRow
                label="اطلاعات تماس فروشنده"
                checked={form.print_show_seller_contact}
                onChange={(v) => setForm({ ...form, print_show_seller_contact: v })}
              />
              <ToggleRow
                label="کد ملی / شناسه اقتصادی خریدار"
                checked={form.print_show_buyer_national_id}
                onChange={(v) => setForm({ ...form, print_show_buyer_national_id: v })}
              />
              <ToggleRow
                label="ستون کد کالا"
                checked={form.print_show_product_code}
                onChange={(v) => setForm({ ...form, print_show_product_code: v })}
              />
              <ToggleRow
                label="ستون مالیات / ارزش افزوده"
                checked={form.print_show_tax_column}
                onChange={(v) => setForm({ ...form, print_show_tax_column: v })}
              />
              <ToggleRow
                label="ستون تخفیف"
                checked={form.print_show_discount_column}
                onChange={(v) => setForm({ ...form, print_show_discount_column: v })}
              />
              <ToggleRow
                label="مانده قبلی مشتری"
                checked={form.print_show_previous_balance}
                onChange={(v) => setForm({ ...form, print_show_previous_balance: v })}
              />
              <ToggleRow
                label="محل مهر و امضا"
                checked={form.print_show_signatures}
                onChange={(v) => setForm({ ...form, print_show_signatures: v })}
              />
            </div>
          </div>

          <Separator />

          {/* Default Notes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>توضیحات پیش‌فرض فاکتور</Label>
              <Button variant="outline" size="sm" onClick={addNote} disabled={form.print_default_notes.length >= 5}>
                افزودن خط
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">این توضیحات به‌صورت خودکار در پایین فاکتورهای چاپی قرار می‌گیرند (حداکثر ۵ خط)</p>
            <div className="space-y-2">
              {form.print_default_notes.map((note, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={note}
                    onChange={(e) => updateNote(i, e.target.value)}
                    placeholder={`مثال: شرایط بازگشت کالا، شماره شبا و...`}
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeNote(i)}>
                    <FileText className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {form.print_default_notes.length === 0 && (
                <p className="text-sm text-muted-foreground">هیچ توضیح پیش‌فرضی ثبت نشده است</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        {saved && (
          <span className="flex items-center gap-1 text-sm text-success">
            <Check className="h-4 w-4" /> ذخیره شد
          </span>
        )}
        <Button onClick={handleSave} disabled={saving}>
          <Save className="ml-2 h-4 w-4" /> {saving ? 'در حال ذخیره...' : 'ذخیره تنظیمات'}
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-slate-50 px-3 py-2.5">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
