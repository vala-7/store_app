import { useState, useRef, useEffect } from 'react';
import { Search, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatNumber } from '@/lib/format';
import { toPersianDigits } from '@/lib/jalali';
import type { Product } from '@/lib/types';

interface ProductAutocompleteProps {
  value: string;
  onSelect: (product: Product) => void;
  placeholder?: string;
}

export default function ProductAutocomplete({ value, onSelect, placeholder }: ProductAutocompleteProps) {
  const [search, setSearch] = useState(value);
  const [results, setResults] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const { data } = await supabase
      .from('products')
      .select('*')
      .or(`name.ilike.%${query}%,sku.ilike.%${query}%`)
      .limit(10);
    setResults((data as Product[]) || []);
  };

  const handleChange = (val: string) => {
    setSearch(val);
    setOpen(true);
    setHighlightIndex(-1);
    doSearch(val);
  };

  const handleSelect = (product: Product) => {
    onSelect(product);
    setSearch(product.name);
    setOpen(false);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (search.trim()) { setOpen(true); doSearch(search); } }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'جستجوی کالا...'}
          className="h-9 pr-8 text-sm"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg animate-fade-in">
          <div className="max-h-64 overflow-auto">
            {results.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                onMouseEnter={() => setHighlightIndex(i)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-right transition-colors ${i === highlightIndex ? 'bg-accent' : 'hover:bg-muted/50'}`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{p.name}</span>
                    {p.sku && <span className="text-xs text-muted-foreground font-num">کد: {toPersianDigits(p.sku)}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    موجودی: {formatNumber(p.stock)} {p.unit} - قیمت: {formatCurrency(p.selling_price)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
