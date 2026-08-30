import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Package, FileText, BookOpen, Wallet, Settings, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Settings as SettingsType } from '@/lib/types';
import Dashboard from '@/components/modules/Dashboard';
import Contacts from '@/components/modules/Contacts';
import Products from '@/components/modules/Products';
import Invoices from '@/components/modules/Invoices';
import Ledger from '@/components/modules/Ledger';
import Payments from '@/components/modules/Payments';
import SettingsModule from '@/components/modules/SettingsModule';

export type View = 'dashboard' | 'contacts' | 'products' | 'invoices' | 'ledger' | 'payments' | 'settings';

interface NavItem {
  id: View;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { id: 'contacts', label: 'اشخاص', icon: Users },
  { id: 'products', label: 'کالاها', icon: Package },
  { id: 'invoices', label: 'فاکتورها', icon: FileText },
  { id: 'ledger', label: 'گردش حساب', icon: BookOpen },
  { id: 'payments', label: 'دریافت و پرداخت', icon: Wallet },
  { id: 'settings', label: 'تنظیمات', icon: Settings },
];

function App() {
  const [view, setView] = useState<View>('dashboard');
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => setSettings(data as SettingsType | null));
  }, []);

  // Listen for cross-module edit-invoice requests (from Ledger)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string };
      setView('invoices');
      setPendingEditInvoiceId(detail.id);
    };
    window.addEventListener('navigate-to-invoices-edit', handler);
    return () => window.removeEventListener('navigate-to-invoices-edit', handler);
  }, []);

  const [pendingEditInvoiceId, setPendingEditInvoiceId] = useState<string | null>(null);

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <Dashboard onNavigate={setView} />;
      case 'contacts':
        return <Contacts />;
      case 'products':
        return <Products />;
      case 'invoices':
        return <Invoices settings={settings} onSettingsRefresh={() => refreshSettings(setSettings)} pendingEditId={pendingEditInvoiceId} onEditConsumed={() => setPendingEditInvoiceId(null)} />;
      case 'ledger':
        return <Ledger settings={settings} />;
      case 'payments':
        return <Payments />;
      case 'settings':
        return <SettingsModule settings={settings} onSaved={(s) => setSettings(s)} />;
      default:
        return <Dashboard onNavigate={setView} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-gradient-to-b from-emerald-800 to-emerald-900 text-emerald-50">
        <SidebarContent view={view} setView={setView} settings={settings} />
      </aside>

      {/* Sidebar - Mobile */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 right-0 z-50 w-64 flex flex-col bg-gradient-to-b from-emerald-800 to-emerald-900 text-emerald-50 md:hidden animate-fade-in">
            <SidebarContent view={view} setView={(v) => { setView(v); setSidebarOpen(false); }} settings={settings} />
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between bg-emerald-900 px-4 text-emerald-50 no-print shadow-md">
          <button
            className="md:hidden rounded-lg p-2 hover:bg-emerald-700"
            onClick={() => setSidebarOpen(true)}
          >
            <LayoutDashboard className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">
            {NAV_ITEMS.find((n) => n.id === view)?.label}
          </h1>
          <div className="flex items-center gap-2 text-sm text-emerald-200">
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">{settings?.business_name || 'فروشگاه'}</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-slate-50 p-4 md:p-6">
          <div className="mx-auto max-w-7xl animate-fade-in">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
}

async function refreshSettings(setSettings: (s: SettingsType | null) => void) {
  const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
  setSettings(data as SettingsType | null);
}

interface SidebarProps {
  view: View;
  setView: (v: View) => void;
  settings: SettingsType | null;
}

function SidebarContent({ view, setView, settings }: SidebarProps) {
  return (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-emerald-700/50 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/20 ring-1 ring-emerald-300/30">
          <Store className="h-5 w-5 text-emerald-200" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold leading-tight text-white">{settings?.business_name || 'حسابداری فروشگاهی'}</span>
          <span className="text-xs text-emerald-300">سیستم مدیریت فروش</span>
        </div>
      </div>
      <nav className="flex-1 p-3">
        {NAV_ITEMS.map((item, idx) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <div key={item.id}>
              {idx > 0 && <div className="mx-3 border-b border-emerald-700/20" />}
              <button
                onClick={() => setView(item.id)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-emerald-400/25 text-white ring-1 ring-emerald-300/40 shadow-md scale-[1.02]'
                    : 'text-emerald-200/70 hover:bg-emerald-700/50 hover:text-white hover:scale-[1.01] hover:shadow-sm'
                )}
              >
                <Icon className={cn(
                  'h-5 w-5 shrink-0 transition-all duration-200',
                  active
                    ? 'text-emerald-100'
                    : 'text-emerald-300/60 group-hover:text-emerald-100 group-hover:scale-110'
                )} />
                {item.label}
                {active && <span className="mr-auto h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-sm shadow-emerald-300/50" />}
              </button>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-emerald-700/50 p-4 text-xs text-emerald-300/70">
        نسخه ۱.۰.۰
      </div>
    </>
  );
}

export default App;
