import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { signOut, type User } from 'firebase/auth';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FolderTree,
  Loader2,
  LogOut,
  Package,
  Plus,
  Search,
  Smartphone,
  Store as StoreIcon,
  Trash2,
  X,
} from 'lucide-react';
import { auth, db, handleFirestoreError } from '../lib/firebase';
import { OperationType, type Category, type Product, type Store } from '../types';
import { ImageUploaderField } from './ImageUploaderField';
import { ResilientImage } from './ResilientImage';
import { PWAInstallButton } from './PWAInstallButton';

interface StoreAdminPanelProps {
  user: User;
  store: Store;
  isMasterAdminView?: boolean;
  onBackToMaster?: () => void;
  onOpenStorefront: (slug: string) => void;
}

type AdminTab = 'products' | 'categories' | 'business' | 'pwa';

const ACCENT_PRESETS = [
  { label: 'Obsidiana', hex: '#0F172A' },
  { label: 'Esmeralda', hex: '#059669' },
  { label: 'Terracota', hex: '#B45309' },
  { label: 'Cobalto', hex: '#1D4ED8' },
  { label: 'Borgoña', hex: '#9F1239' },
];

function createDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

function formatPriceARS(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

function getTimestampMs(value: unknown): number {
  if (!value) return Date.now();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object' && value !== null) {
    const maybeTs = value as { toMillis?: () => number; seconds?: number };
    if (typeof maybeTs.toMillis === 'function') {
      return maybeTs.toMillis();
    }
    if (typeof maybeTs.seconds === 'number') {
      return maybeTs.seconds * 1000;
    }
  }
  return 0;
}

function sortCategories(list: Category[]): Category[] {
  return [...list].sort((a, b) => {
    const orderDiff = (a.order ?? 0) - (b.order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return (a.name || '').localeCompare(b.name || '', 'es');
  });
}

function sortProducts(list: Product[]): Product[] {
  return [...list].sort((a, b) => {
    const timeDiff = getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt);
    if (timeDiff !== 0) return timeDiff;
    return (a.name || '').localeCompare(b.name || '', 'es');
  });
}

export const StoreAdminPanel: React.FC<StoreAdminPanelProps> = ({
  user,
  store,
  isMasterAdminView = false,
  onBackToMaster,
  onOpenStorefront,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('products');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Business Info state
  const [bizName, setBizName] = useState(store.name);
  const [bizDesc, setBizDesc] = useState(store.description || '');
  const [bizWhatsapp, setBizWhatsapp] = useState(store.whatsapp);
  const [bizAddress, setBizAddress] = useState(store.address || '');
  const [bizHours, setBizHours] = useState(store.hours || '');
  const [bizBanner, setBizBanner] = useState(store.bannerUrl || '');
  const [bizLogo, setBizLogo] = useState(store.logoUrl || '');
  const [bizAppIcon, setBizAppIcon] = useState(store.appIconUrl || '');
  const [bizAccent, setBizAccent] = useState(store.accentColor || '#0F172A');
  const [savingBiz, setSavingBiz] = useState(false);
  const [savedBizToast, setSavedBizToast] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Product search/filter & modal
  const [prodSearch, setProdSearch] = useState('');
  const [prodCatFilter, setProdCatFilter] = useState('all');
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pCategoryId, setPCategoryId] = useState('');
  const [pImageUrl, setPImageUrl] = useState('');
  const [pAvailable, setPAvailable] = useState(true);
  const [pFeatured, setPFeatured] = useState(false);
  const [savingProd, setSavingProd] = useState(false);

  // Category modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cOrder, setCOrder] = useState('1');
  const [cAvailable, setCAvailable] = useState(true);
  const [savingCat, setSavingCat] = useState(false);

  useEffect(() => {
    setBizName(store.name);
    setBizDesc(store.description || '');
    setBizWhatsapp(store.whatsapp);
    setBizAddress(store.address || '');
    setBizHours(store.hours || '');
    setBizBanner(store.bannerUrl || '');
    setBizLogo(store.logoUrl || '');
    setBizAppIcon(store.appIconUrl || '');
    setBizAccent(store.accentColor || '#0F172A');
  }, [store]);

  useEffect(() => {
    setLoadingCatalog(true);
    const catPath = `stores/${store.id}/categories`;
    const prodPath = `stores/${store.id}/products`;

    const catsQuery = isMasterAdminView
      ? collection(db, catPath)
      : query(collection(db, catPath), where('ownerUid', '==', store.ownerUid));

    const prodsQuery = isMasterAdminView
      ? collection(db, prodPath)
      : query(collection(db, prodPath), where('ownerUid', '==', store.ownerUid));

    const unsubCats = onSnapshot(
      catsQuery,
      (snap) => {
        setCategories(sortCategories(snap.docs.map((d) => d.data() as Category)));
        setLoadingCatalog(false);
      },
      (err) => {
        setLoadingCatalog(false);
        handleFirestoreError(err, OperationType.LIST, catPath);
      }
    );

    const unsubProds = onSnapshot(
      prodsQuery,
      (snap) => {
        setProducts(sortProducts(snap.docs.map((d) => d.data() as Product)));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, prodPath);
      }
    );

    return () => {
      unsubCats();
      unsubProds();
    };
  }, [store.id, store.ownerUid, isMasterAdminView]);

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (prodCatFilter !== 'all' && p.categoryId !== prodCatFilter) return false;
      if (q && !`${p.name} ${p.description || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, prodSearch, prodCatFilter]);

  const openNewProductModal = () => {
    setEditingProduct(null);
    setPName('');
    setPDesc('');
    setPPrice('');
    setPCategoryId(categories[0]?.id || 'general');
    setPImageUrl('');
    setPAvailable(true);
    setPFeatured(false);
    setProdModalOpen(true);
  };

  const openEditProductModal = (prod: Product) => {
    setEditingProduct(prod);
    setPName(prod.name);
    setPDesc(prod.description || '');
    setPPrice(String(prod.price));
    setPCategoryId(prod.categoryId);
    setPImageUrl(prod.imageUrl || '');
    setPAvailable(prod.isAvailable);
    setPFeatured(Boolean(prod.featured));
    setProdModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProd(true);
    const numericPrice = Math.max(0, Number(pPrice) || 0);
    const resolvedCategoryId = pCategoryId || categories[0]?.id || 'general';
    const cleanName = pName.trim();
    const cleanDesc = pDesc.trim();
    const cleanImageUrl = pImageUrl.trim();

    try {
      if (editingProduct) {
        const path = `stores/${store.id}/products/${editingProduct.id}`;
        try {
          await updateDoc(doc(db, 'stores', store.id, 'products', editingProduct.id), {
            categoryId: resolvedCategoryId,
            name: cleanName,
            description: cleanDesc,
            price: numericPrice,
            imageUrl: cleanImageUrl,
            isAvailable: pAvailable,
            featured: pFeatured,
            updatedAt: serverTimestamp(),
          });
          setProducts((prev) =>
            sortProducts(
              prev.map((item) =>
                item.id === editingProduct.id
                  ? {
                      ...item,
                      categoryId: resolvedCategoryId,
                      name: cleanName,
                      description: cleanDesc,
                      price: numericPrice,
                      imageUrl: cleanImageUrl,
                      isAvailable: pAvailable,
                      featured: pFeatured,
                      updatedAt: new Date().toISOString(),
                    }
                  : item
              )
            )
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        const newId = createDocId('prod');
        const path = `stores/${store.id}/products/${newId}`;
        try {
          await setDoc(doc(db, 'stores', store.id, 'products', newId), {
            id: newId,
            storeId: store.id,
            ownerUid: store.ownerUid,
            categoryId: resolvedCategoryId,
            name: cleanName,
            description: cleanDesc,
            price: numericPrice,
            imageUrl: cleanImageUrl,
            isAvailable: pAvailable,
            featured: pFeatured,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const nowIso = new Date().toISOString();
          const createdProduct: Product = {
            id: newId,
            storeId: store.id,
            ownerUid: store.ownerUid,
            categoryId: resolvedCategoryId,
            name: cleanName,
            description: cleanDesc,
            price: numericPrice,
            imageUrl: cleanImageUrl,
            isAvailable: pAvailable,
            featured: pFeatured,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          setProducts((prev) =>
            sortProducts([createdProduct, ...prev.filter((item) => item.id !== newId)])
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
      setProdModalOpen(false);
    } finally {
      setSavingProd(false);
    }
  };

  const handleToggleProductAvailability = async (prod: Product) => {
    const path = `stores/${store.id}/products/${prod.id}`;
    const nextAvailable = !prod.isAvailable;
    setProducts((prev) =>
      prev.map((item) =>
        item.id === prod.id ? { ...item, isAvailable: nextAvailable } : item
      )
    );
    try {
      await updateDoc(doc(db, 'stores', store.id, 'products', prod.id), {
        isAvailable: nextAvailable,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setProducts((prev) =>
        prev.map((item) =>
          item.id === prod.id ? { ...item, isAvailable: prod.isAvailable } : item
        )
      );
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteProduct = async (prod: Product) => {
    const path = `stores/${store.id}/products/${prod.id}`;
    setProducts((prev) => prev.filter((item) => item.id !== prod.id));
    try {
      await deleteDoc(doc(db, 'stores', store.id, 'products', prod.id));
    } catch (err) {
      setProducts((prev) => sortProducts([prod, ...prev]));
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const openNewCategoryModal = () => {
    setEditingCategory(null);
    setCName('');
    setCDesc('');
    setCOrder(String(categories.length + 1));
    setCAvailable(true);
    setCatModalOpen(true);
  };

  const openEditCategoryModal = (cat: Category) => {
    setEditingCategory(cat);
    setCName(cat.name);
    setCDesc(cat.description || '');
    setCOrder(String(cat.order ?? 1));
    setCAvailable(cat.isAvailable);
    setCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCat(true);
    const numOrder = Math.max(0, Number(cOrder) || 0);
    const cleanName = cName.trim();
    const cleanDesc = cDesc.trim();

    try {
      if (editingCategory) {
        const path = `stores/${store.id}/categories/${editingCategory.id}`;
        try {
          await updateDoc(doc(db, 'stores', store.id, 'categories', editingCategory.id), {
            name: cleanName,
            description: cleanDesc,
            order: numOrder,
            isAvailable: cAvailable,
            updatedAt: serverTimestamp(),
          });
          setCategories((prev) =>
            sortCategories(
              prev.map((item) =>
                item.id === editingCategory.id
                  ? {
                      ...item,
                      name: cleanName,
                      description: cleanDesc,
                      order: numOrder,
                      isAvailable: cAvailable,
                      updatedAt: new Date().toISOString(),
                    }
                  : item
              )
            )
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      } else {
        const newId = createDocId('cat');
        const path = `stores/${store.id}/categories/${newId}`;
        try {
          await setDoc(doc(db, 'stores', store.id, 'categories', newId), {
            id: newId,
            storeId: store.id,
            ownerUid: store.ownerUid,
            name: cleanName,
            description: cleanDesc,
            order: numOrder,
            isAvailable: cAvailable,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          const nowIso = new Date().toISOString();
          const createdCategory: Category = {
            id: newId,
            storeId: store.id,
            ownerUid: store.ownerUid,
            name: cleanName,
            description: cleanDesc,
            order: numOrder,
            isAvailable: cAvailable,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          setCategories((prev) =>
            sortCategories([...prev.filter((item) => item.id !== newId), createdCategory])
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }
      setCatModalOpen(false);
    } finally {
      setSavingCat(false);
    }
  };

  const handleToggleCategoryAvailability = async (cat: Category) => {
    const path = `stores/${store.id}/categories/${cat.id}`;
    const nextAvailable = !cat.isAvailable;
    setCategories((prev) =>
      prev.map((item) =>
        item.id === cat.id ? { ...item, isAvailable: nextAvailable } : item
      )
    );
    try {
      await updateDoc(doc(db, 'stores', store.id, 'categories', cat.id), {
        isAvailable: nextAvailable,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setCategories((prev) =>
        prev.map((item) =>
          item.id === cat.id ? { ...item, isAvailable: cat.isAvailable } : item
        )
      );
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    const path = `stores/${store.id}/categories/${cat.id}`;
    setCategories((prev) => prev.filter((item) => item.id !== cat.id));
    try {
      await deleteDoc(doc(db, 'stores', store.id, 'categories', cat.id));
    } catch (err) {
      setCategories((prev) => sortCategories([...prev, cat]));
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const handleSaveBusinessInfo = async (e: React.FormEvent, message: string) => {
    e.preventDefault();
    setSavingBiz(true);
    setSavedBizToast(null);
    const path = `stores/${store.id}`;
    try {
      await updateDoc(doc(db, 'stores', store.id), {
        name: bizName.trim(),
        description: bizDesc.trim(),
        whatsapp: bizWhatsapp.replace(/[^\d]/g, '').trim(),
        address: bizAddress.trim(),
        hours: bizHours.trim(),
        bannerUrl: bizBanner.trim(),
        logoUrl: bizLogo.trim(),
        appIconUrl: bizAppIcon.trim(),
        accentColor: bizAccent.trim() || '#0F172A',
        updatedAt: serverTimestamp(),
      });
      setSavedBizToast(message);
      setTimeout(() => setSavedBizToast(null), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setSavingBiz(false);
    }
  };

  const storeDirectUrl = `${window.location.origin}/?store=${encodeURIComponent(store.slug)}`;

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'products', label: 'Productos', icon: <Package className="h-4 w-4" /> },
    { id: 'categories', label: 'Categorías', icon: <FolderTree className="h-4 w-4" /> },
    { id: 'business', label: 'Negocio y Portada', icon: <StoreIcon className="h-4 w-4" /> },
    { id: 'pwa', label: 'App Instalable', icon: <Smartphone className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            {isMasterAdminView && onBackToMaster && (
              <button
                type="button"
                onClick={onBackToMaster}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 shrink-0 cursor-pointer"
                title="Volver al Panel Maestro"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <span className="block truncate font-display text-sm font-bold text-zinc-900 sm:text-base">
                {store.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenStorefront(store.slug)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 whitespace-nowrap cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Ver catálogo</span>
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-8">
        {/* Sidebar Navigation (Desktop) & Segmented Bar (Mobile) */}
        <aside className="mb-6 lg:col-span-3 lg:mb-0">
          <div className="rounded-xl border border-zinc-200 bg-white p-2 lg:p-3">
            <div className="hidden lg:block px-3 pb-3 mb-2 border-b border-zinc-100">
              <p className="text-[11px] font-medium text-zinc-400">Sesión de comercio</p>
              <p className="mt-0.5 truncate text-xs font-medium text-zinc-700">
                {user.email}
              </p>
            </div>
            <nav className="flex gap-1 overflow-x-auto lg:flex-col">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === item.id
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="lg:col-span-9">
          {savedBizToast && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              <span>{savedBizToast}</span>
            </div>
          )}

          {/* TAB: PRODUCTS */}
          {activeTab === 'products' && (
            <div className="rounded-xl border border-zinc-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
                <div>
                  <h1 className="font-display text-lg font-bold text-zinc-900">
                    Productos del catálogo
                  </h1>
                  <p className="text-xs text-zinc-500">
                    Subí fotos desde tu dispositivo a Cloudinary o pegá una URL, y activá o pausá la disponibilidad.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewProductModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Nuevo producto</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-5 py-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="search"
                    value={prodSearch}
                    onChange={(e) => setProdSearch(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pr-3 pl-8 text-xs text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none"
                  />
                </div>
                <select
                  value={prodCatFilter}
                  onChange={(e) => setProdCatFilter(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-800 focus:border-zinc-900 focus:outline-none"
                >
                  <option value="all">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {loadingCatalog ? (
                <div className="space-y-3 p-5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-100" />
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-12 text-center">
                  <Package className="mx-auto h-8 w-8 text-zinc-300" />
                  <p className="mt-2 font-display text-sm font-semibold text-zinc-900">
                    No hay productos cargados
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Creá tu primer producto para empezar a recibir pedidos por WhatsApp.
                  </p>
                  <button
                    type="button"
                    onClick={openNewProductModal}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Agregar primer producto</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {filteredProducts.map((prod) => (
                    <div
                      key={prod.id}
                      className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-zinc-50/70"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="h-14 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
                          <ResilientImage
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                            <span>{categoryNameMap.get(prod.categoryId) || 'Sin categoría'}</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                prod.isAvailable
                                  ? 'font-medium text-emerald-700'
                                  : 'font-medium text-amber-700'
                              }
                            >
                              {prod.isAvailable ? 'Disponible' : 'Oculto'}
                            </span>
                          </div>
                          <p className="truncate font-display text-sm font-semibold text-zinc-900">
                            {prod.name}
                          </p>
                          <p className="font-mono text-xs font-medium text-zinc-700 tabular-nums">
                            {formatPriceARS(prod.price)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleProductAvailability(prod)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                            prod.isAvailable
                              ? 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                              : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                          }`}
                          title={
                            prod.isAvailable
                              ? 'Marcar como no disponible (ocultar del catálogo)'
                              : 'Volver a mostrar en catálogo'
                          }
                        >
                          {prod.isAvailable ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              <span>Ocultar</span>
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              <span>Publicar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditProductModal(prod)}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(prod)}
                          className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                          title="Eliminar producto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: CATEGORIES */}
          {activeTab === 'categories' && (
            <div className="rounded-xl border border-zinc-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
                <div>
                  <h1 className="font-display text-lg font-bold text-zinc-900">
                    Categorías
                  </h1>
                  <p className="text-xs text-zinc-500">
                    Si marcás una categoría como no disponible, se ocultará junto con sus productos del catálogo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewCategoryModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Nueva categoría</span>
                </button>
              </div>

              {categories.length === 0 ? (
                <div className="p-12 text-center">
                  <FolderTree className="mx-auto h-8 w-8 text-zinc-300" />
                  <p className="mt-2 font-display text-sm font-semibold text-zinc-900">
                    Sin categorías creadas
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Organizá tu tienda creando secciones como Indumentaria, Bebidas o Combos.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <span className="font-mono tabular-nums">Orden {cat.order}</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              cat.isAvailable
                                ? 'font-medium text-emerald-700'
                                : 'font-medium text-amber-700'
                            }
                          >
                            {cat.isAvailable ? 'Visible en catálogo' : 'Oculta'}
                          </span>
                        </div>
                        <h3 className="mt-0.5 font-display text-sm font-semibold text-zinc-900">
                          {cat.name}
                        </h3>
                        {cat.description && (
                          <p className="text-xs text-zinc-500">{cat.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleCategoryAvailability(cat)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                            cat.isAvailable
                              ? 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                              : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                          }`}
                        >
                          {cat.isAvailable ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              <span>Ocultar</span>
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              <span>Mostrar</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditCategoryModal(cat)}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                          title="Eliminar categoría"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: BUSINESS INFO & BRANDING */}
          {activeTab === 'business' && (
            <form
              onSubmit={(e) => handleSaveBusinessInfo(e, 'Información del negocio actualizada.')}
              className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6"
            >
              <div>
                <h1 className="font-display text-lg font-bold text-zinc-900">
                  Información del negocio y portada
                </h1>
                <p className="mt-1 text-xs text-zinc-500">
                  Actualizá los datos de contacto, horarios de atención, banner de portada y logo de tu comercio.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-800">
                    Nombre del comercio
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-800">
                    WhatsApp para recibir pedidos
                  </label>
                  <input
                    type="tel"
                    required
                    value={bizWhatsapp}
                    onChange={(e) => setBizWhatsapp(e.target.value)}
                    placeholder="5493764000000"
                    className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-800">
                  Descripción corta
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={bizDesc}
                  onChange={(e) => setBizDesc(e.target.value)}
                  placeholder="Contale a tus clientes qué ofrecés..."
                  className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-800">
                    Dirección del local
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={bizAddress}
                    onChange={(e) => setBizAddress(e.target.value)}
                    placeholder="Ej.: Av. Mitre 1420, Posadas"
                    className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-800">
                    Horarios de atención
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={bizHours}
                    onChange={(e) => setBizHours(e.target.value)}
                    placeholder="Ej.: Lun a Sáb · 09:00 a 20:00"
                    className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-800">
                  Color principal de la tienda
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2.5">
                  {ACCENT_PRESETS.map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setBizAccent(preset.hex)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                        bizAccent.toLowerCase() === preset.hex.toLowerCase()
                          ? 'border-zinc-900 bg-zinc-100 text-zinc-900'
                          : 'border-zinc-200 bg-white text-zinc-600'
                      }`}
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-black/10"
                        style={{ backgroundColor: preset.hex }}
                      />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                  <input
                    type="color"
                    value={bizAccent}
                    onChange={(e) => setBizAccent(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-zinc-200 bg-white p-0.5"
                    aria-label="Color personalizado"
                  />
                </div>
              </div>

              <div className="grid gap-6 border-t border-zinc-100 pt-6 sm:grid-cols-2">
                <ImageUploaderField
                  label="Banner de portada"
                  helperText="Medida recomendada: 1200 × 400 px (formato panorámico 3:1). Se muestra completo en celular y PC."
                  value={bizBanner}
                  onChange={setBizBanner}
                  folder={`stores/${store.slug}/banners`}
                  previewAspect="wide"
                />

                <ImageUploaderField
                  label="Logo del comercio"
                  helperText="Formato cuadrado (1:1). Se muestra sobre la portada."
                  value={bizLogo}
                  onChange={setBizLogo}
                  folder={`stores/${store.slug}/logos`}
                  squareSize={512}
                  previewAspect="square"
                />
              </div>

              <div className="flex justify-end border-t border-zinc-100 pt-4">
                <button
                  type="submit"
                  disabled={savingBiz}
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 cursor-pointer"
                >
                  {savingBiz && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Guardar cambios del negocio</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB: PWA INSTALLABLE APP & CUSTOM ICON */}
          {activeTab === 'pwa' && (
            <form
              onSubmit={(e) =>
                handleSaveBusinessInfo(e, 'Ícono personalizado de la aplicación actualizado.')
              }
              className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6"
            >
              <div>
                <h1 className="font-display text-lg font-bold text-zinc-900">
                  Aplicación instalable (PWA) e ícono personalizado
                </h1>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                  Cada cliente que abra tu catálogo podrá instalar tu tienda como una app en su celular o computadora usando el ícono que cargues aquí.
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <ImageUploaderField
                    label="Ícono personalizado de la app (512×512 PNG)"
                    helperText="Al subir una imagen desde tu dispositivo se ajusta automáticamente a formato cuadrado 512×512 y se aloja en Cloudinary."
                    value={bizAppIcon}
                    onChange={setBizAppIcon}
                    folder={`stores/${store.slug}/app-icon`}
                    squareSize={512}
                    previewAspect="square"
                  />
                </div>

                {/* Live Phone Home Screen Preview */}
                <div className="lg:col-span-5">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
                    <p className="text-xs font-semibold text-zinc-800">
                      Vista previa en pantalla de inicio
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      Así verán tu aplicación instalada en Android e iOS.
                    </p>

                    <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-gradient-to-b from-zinc-900 to-zinc-800 py-8 text-white">
                      <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/20 bg-white shadow-lg">
                        <ResilientImage
                          src={bizAppIcon || bizLogo || '/pwa-192x192.png'}
                          alt="Ícono de app"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <span className="mt-2.5 max-w-[120px] truncate text-xs font-medium text-zinc-100">
                        {bizName.slice(0, 12) || 'Mi Tienda'}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      <p className="text-[11px] font-medium text-zinc-600">
                        Enlace directo instalable de tu tienda:
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={storeDirectUrl}
                          className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-zinc-600"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(storeDirectUrl);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 shrink-0 cursor-pointer"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>{copiedLink ? 'Copiado' : 'Copiar'}</span>
                        </button>
                      </div>
                      <div className="pt-2">
                        <PWAInstallButton storeName={bizName} variant="solid" accentColor={bizAccent} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end border-t border-zinc-100 pt-4">
                <button
                  type="submit"
                  disabled={savingBiz}
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 cursor-pointer"
                >
                  {savingBiz && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Guardar ícono de la app</span>
                </button>
              </div>
            </form>
          )}
        </main>
      </div>

      {/* Product Create/Edit Modal */}
      {prodModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h2 className="font-display text-base font-bold text-zinc-900">
                {editingProduct ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button
                type="button"
                onClick={() => setProdModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-800">
                  Nombre del producto
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  placeholder="Ej.: Remera Oversize Algodón"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-800">
                    Categoría
                  </label>
                  <select
                    value={pCategoryId}
                    onChange={(e) => setPCategoryId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                  >
                    {categories.length === 0 ? (
                      <option value="general">General</option>
                    ) : (
                      categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-800">
                    Precio ($)
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={pPrice}
                    onChange={(e) => setPPrice(e.target.value)}
                    placeholder="15000"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-800">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  maxLength={600}
                  value={pDesc}
                  onChange={(e) => setPDesc(e.target.value)}
                  placeholder="Detalles, materiales, medidas o sabores..."
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                />
              </div>

              <ImageUploaderField
                label="Foto del producto"
                helperText="Subila desde tu dispositivo (Cloudinary) o pegá una URL."
                value={pImageUrl}
                onChange={setPImageUrl}
                folder={`stores/${store.slug}/products`}
                previewAspect="product"
              />

              <div className="flex flex-wrap gap-5 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pAvailable}
                    onChange={(e) => setPAvailable(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 accent-zinc-900"
                  />
                  <span>Disponible en catálogo</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pFeatured}
                    onChange={(e) => setPFeatured(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 accent-zinc-900"
                  />
                  <span>Destacar producto</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setProdModalOpen(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingProd}
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 cursor-pointer"
                >
                  {savingProd && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingProduct ? 'Guardar cambios' : 'Crear producto'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Create/Edit Modal */}
      {catModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h2 className="font-display text-base font-bold text-zinc-900">
                {editingCategory ? 'Editar categoría' : 'Nueva categoría'}
              </h2>
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-800">
                  Nombre de la categoría
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  placeholder="Ej.: Bebidas Artesanales"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-800">
                  Descripción breve (opcional)
                </label>
                <input
                  type="text"
                  maxLength={240}
                  value={cDesc}
                  onChange={(e) => setCDesc(e.target.value)}
                  placeholder="Descripción para organización interna"
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-800">
                  Orden de aparición
                </label>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={cOrder}
                  onChange={(e) => setCOrder(e.target.value)}
                  className="mt-1 w-28 rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cAvailable}
                  onChange={(e) => setCAvailable(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 accent-zinc-900"
                />
                <span>Visible en el catálogo público</span>
              </label>

              <div className="flex justify-end gap-2.5 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setCatModalOpen(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCat}
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 cursor-pointer"
                >
                  {savingCat && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingCategory ? 'Guardar cambios' : 'Crear categoría'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
