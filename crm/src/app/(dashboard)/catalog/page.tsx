'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  RefreshCw,
  ChevronRight,
  Package,
  LayoutGrid,
  List,
  Loader2,
  Image as ImageIcon,
  ExternalLink,
  X,
  Shirt,
  Home,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';

type Category = {
  id: number;
  name: string;
  parent_id: number | null;
  children?: Category[];
};

type Product = {
  id: number;
  name: string;
  category_id: number | null;
  main_image_url: string | null;
  gallery_urls: string[];
  keycrm_id?: number | null;
  product_categories?: { name: string };
};

type Variant = {
  id: number;
  size: string | null;
  sku: string | null;
  price: number | null;
};

type ProductDetails = Product & {
  variants?: Variant[];
};

type SyncState = {
  at: string;
  categories: number;
  products: number;
  variants: number;
  errorsCount: number;
  status: 'success' | 'error';
  message: string;
};

const SYNC_STATE_KEY = 'catalog_sync_state';

export default function CatalogPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
    const raw = localStorage.getItem(SYNC_STATE_KEY);
    if (raw) {
      try {
        setSyncState(JSON.parse(raw) as SyncState);
      } catch {
        localStorage.removeItem(SYNC_STATE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [selectedCategory, search]);

  useEffect(() => {
    if (selectedProduct) {
      loadProductDetails(selectedProduct.id);
    } else {
      setProductDetails(null);
    }
  }, [selectedProduct]);

  useEffect(() => {
    if (!copiedKey) return;
    const t = setTimeout(() => setCopiedKey(null), 1500);
    return () => clearTimeout(t);
  }, [copiedKey]);

  async function loadProductDetails(id: number) {
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/catalog/products/${id}`);
      const data = (await res.json()) as ProductDetails;
      setProductDetails(data);
    } catch {
      setProductDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function loadCategories() {
    try {
      const res = await fetch('/api/catalog/categories');
      const data = (await res.json()) as Category[];
      setCategories(data);
    } catch {
      setCategories([]);
    }
  }

  async function loadProducts() {
    setLoading(true);
    try {
      const url = new URL('/api/catalog/products', window.location.origin);
      if (selectedCategory) url.searchParams.append('categoryId', selectedCategory.toString());
      if (search) url.searchParams.append('search', search);

      const res = await fetch(url.toString());
      const data = (await res.json()) as Product[];
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  function persistSyncState(next: SyncState) {
    setSyncState(next);
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(next));
  }

  async function handleSync() {
    if (!confirm('Почати синхронізацію з KeyCRM? Це може зайняти хвилину.')) return;

    setSyncing(true);
    try {
      const res = await fetch('/api/catalog/sync', { method: 'POST' });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result?.error || 'Sync failed');
      }

      const nextState: SyncState = {
        at: new Date().toISOString(),
        categories: Number(result.categories || 0),
        products: Number(result.products || 0),
        variants: Number(result.variants || 0),
        errorsCount: Array.isArray(result.errors) ? result.errors.length : 0,
        status: 'success',
        message: 'Синхронізація завершена',
      };

      persistSyncState(nextState);
      await loadCategories();
      await loadProducts();
    } catch (e) {
      const nextState: SyncState = {
        at: new Date().toISOString(),
        categories: 0,
        products: 0,
        variants: 0,
        errorsCount: 1,
        status: 'error',
        message: e instanceof Error ? e.message : 'Помилка синхронізації',
      };
      persistSyncState(nextState);
    } finally {
      setSyncing(false);
    }
  }

  function resetFilters() {
    setSelectedCategory(null);
    setSearch('');
  }

  function getCategoryName(id: number | null): string {
    if (!id) return 'Всі товари';
    const findInTree = (list: Category[]): string | null => {
      for (const cat of list) {
        if (cat.id === id) return cat.name;
        if (cat.children?.length) {
          const found = findInTree(cat.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findInTree(categories) || 'Категорія';
  }

  function formatSyncTime(iso: string): string {
    return new Date(iso).toLocaleString('uk-UA');
  }

  async function copyText(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
    } catch {
      setCopiedKey(null);
    }
  }

  const categoryLabel = getCategoryName(selectedCategory);
  const hasProducts = products.length > 0;
  const variants = productDetails?.variants || [];
  const hasVariants = variants.length > 0;
  const keycrmUrl = useMemo(() => {
    if (!productDetails?.keycrm_id) return null;
    return `https://vyshyvanky-kosar.keycrm.app/products/edit/${productDetails.keycrm_id}`;
  }, [productDetails?.keycrm_id]);

  return (
    <div className="flex flex-col h-full bg-[#fcfcfc] dark:bg-[#0a0a0a]">
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#0d0d0d]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
            <Package size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">Каталог виробів</h1>
            <p className="text-sm text-gray-500">{categoryLabel} · {products.length} моделей</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Пошук моделі..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 w-64 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-medium transition-colors shadow-sm shadow-blue-500/20"
          >
            {syncing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            {syncing ? 'Синхронізація...' : 'Оновити з KeyCRM'}
          </button>
        </div>
      </div>

      {syncState && (
        <div className={`mx-8 mt-4 rounded-xl border px-4 py-3 text-sm ${
          syncState.status === 'success'
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          <div className="font-semibold">{syncState.message}</div>
          <div className="mt-1 text-xs opacity-80">
            Остання синхронізація: {formatSyncTime(syncState.at)} · Категорій: {syncState.categories} · Моделей: {syncState.products} · Варіантів: {syncState.variants} · Помилок: {syncState.errorsCount}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-[#0d0d0d] p-6 overflow-y-auto">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6">Категорії</h2>
          <div className="space-y-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                selectedCategory === null
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
              }`}
            >
              <LayoutGrid size={18} />
              Всі товари
            </button>

            {categories.map((cat) => (
              <CategoryItem
                key={cat.id}
                category={cat}
                selectedId={selectedCategory}
                onSelect={setSelectedCategory}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="px-8 pt-6 pb-2 flex items-center gap-2 text-sm text-gray-400 font-medium">
            <Home size={14} />
            <ChevronRight size={12} />
            <span className={selectedCategory ? 'text-gray-400' : 'text-blue-600 font-bold'}>Каталог</span>
            {selectedCategory && (
              <>
                <ChevronRight size={12} />
                <span className="text-blue-600 font-bold">{categoryLabel}</span>
              </>
            )}
          </div>

          <div className="px-8 text-xs text-gray-500">
            Результат фільтрації: {products.length} моделей
          </div>

          <div className="p-8">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-blue-600" size={32} />
              </div>
            ) : !hasProducts ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <ImageIcon size={48} className="mb-4 opacity-20" />
                <p className="mb-3">У цій вибірці немає моделей</p>
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 rounded-xl text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                >
                  Скинути фільтр
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="group bg-white dark:bg-[#0d0d0d] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-xl hover:shadow-gray-200/40 dark:hover:shadow-none transition-all duration-300 flex flex-col cursor-pointer"
                  >
                    <div className="relative aspect-[4/5] bg-gray-50 dark:bg-gray-900 overflow-hidden">
                      {product.main_image_url ? (
                        <img
                          src={product.main_image_url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <ImageIcon size={48} />
                        </div>
                      )}
                      <div className="absolute top-3 left-3">
                        <span className="px-2.5 py-1 bg-white/90 dark:bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 border border-white/20">
                          {product.product_categories?.name || 'Без категорії'}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight mb-2 group-hover:text-blue-600 transition-colors">
                        {product.name}
                      </h3>
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50 dark:border-gray-800">
                        <span className="font-mono text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                          ID: {product.id}
                        </span>
                        <ExternalLink size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
          <div className="absolute inset-0" onClick={() => setSelectedProduct(null)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-[#0d0d0d] h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-gray-500"
                >
                  <X size={20} />
                </button>
                <h2 className="text-lg font-bold">Деталі виробу</h2>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              {loadingDetails ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="animate-spin text-blue-600" size={32} />
                </div>
              ) : productDetails ? (
                <div className="space-y-8">
                  <div className="flex gap-6">
                    <div className="w-48 aspect-[3/4] rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-900 border border-gray-100">
                      <img
                        src={productDetails.main_image_url || ''}
                        className="w-full h-full object-cover"
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          e.currentTarget.src = 'https://via.placeholder.com/300x400?text=No+Photo';
                        }}
                      />
                    </div>
                    <div className="flex-1 space-y-4">
                      <h1 className="text-2xl font-bold">{productDetails.name}</h1>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm">
                          ID: <span className="font-mono">{productDetails.id}</span>
                        </span>
                        <span className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm">
                          {productDetails.product_categories?.name}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => copyText(String(productDetails.id), 'model-id')}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          {copiedKey === 'model-id' ? <Check size={14} /> : <Copy size={14} />}
                          Копіювати ID
                        </button>

                        {keycrmUrl && (
                          <a
                            href={keycrmUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <ExternalLink size={14} />
                            Відкрити в KeyCRM
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                      <List size={16} />
                      Розміри та артикулі
                    </h3>
                    <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 uppercase text-[10px] font-bold">
                          <tr>
                            <th className="px-4 py-3">Розмір</th>
                            <th className="px-4 py-3">SKU</th>
                            <th className="px-4 py-3 text-right">Ціна</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {hasVariants ? variants.map((v) => (
                            <tr key={v.id}>
                              <td className="px-4 py-3 font-bold">{v.size || '—'}</td>
                              <td className="px-4 py-3 font-mono text-xs">
                                <button
                                  onClick={() => copyText(v.sku || '', `sku-${v.id}`)}
                                  className="inline-flex items-center gap-2 hover:text-blue-600"
                                  disabled={!v.sku}
                                >
                                  {v.sku || '—'}
                                  {v.sku && (copiedKey === `sku-${v.id}` ? <Check size={12} /> : <Copy size={12} />)}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-right">{v.price ?? '—'} {v.price != null ? 'грн' : ''}</td>
                            </tr>
                          )) : (
                            <tr>
                              <td className="px-4 py-4 text-gray-500" colSpan={3}>Немає варіантів для цієї моделі</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {!hasVariants && (
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm flex items-start gap-2">
                      <AlertTriangle size={16} className="mt-0.5" />
                      <span>Розміри/артикулі для цієї моделі ще не синхронізовані. Запустіть “Оновити з KeyCRM”.</span>
                    </div>
                  )}

                  <div className="p-6 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 space-y-4">
                    <h3 className="text-sm font-bold text-blue-700 flex items-center gap-2">
                      <Shirt size={18} />
                      Виробничі параметри
                    </h3>
                    <button className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium">
                      Налаштувати BOM (норми матеріалів)
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryItem({
  category,
  selectedId,
  onSelect,
  depth = 0,
}: {
  category: Category;
  selectedId: number | null;
  onSelect: (id: number) => void;
  depth?: number;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = !!category.children?.length;
  const isSelected = selectedId === category.id;

  return (
    <div className="space-y-1">
      <button
        onClick={() => {
          onSelect(category.id);
          if (hasChildren) setIsOpen(!isOpen);
        }}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
          isSelected
            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'
        }`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        {hasChildren ? (
          <ChevronRight size={14} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
        ) : (
          <div className="w-3.5" />
        )}
        <span className="truncate">{category.name}</span>
      </button>

      {hasChildren && isOpen && (
        <div className="space-y-1">
          {category.children!.map((child) => (
            <CategoryItem
              key={child.id}
              category={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
