import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { CartItem, Category, Product, Store } from '../types';
import { DEMO_HERO_BANNER } from '../data/demoStore';
import { getContrastTextColor, getStoreBackgroundStyle } from '../lib/theme';
import { ResilientImage } from './ResilientImage';
import { PWAInstallButton } from './PWAInstallButton';

interface StorefrontViewProps {
  store: Store;
  categories: Category[];
  products: Product[];
  loading: boolean;
  canManageStore: boolean;
  onOpenStoreAdmin: () => void;
}

function formatPriceARS(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  store,
  categories,
  products,
  loading,
  canManageStore,
  onOpenStoreAdmin,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  // Product quick view & zoom modal
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [zoomScale, setZoomScale] = useState(1);

  const openQuickView = (product: Product) => {
    setQuickViewProduct(product);
    setZoomScale(1);
  };

  const closeQuickView = () => {
    setQuickViewProduct(null);
    setZoomScale(1);
  };

  // Checkout customer fields for WhatsApp message
  const [customerName, setCustomerName] = useState('');
  const [deliveryType, setDeliveryType] = useState<'retiro' | 'envio'>('retiro');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo / Transferencia');
  const [orderNotes, setOrderNotes] = useState('');

  const visibleCategories = useMemo(
    () =>
      categories
        .filter((c) => c.isAvailable)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [categories]
  );

  const availableCategoryIds = useMemo(
    () => new Set(visibleCategories.map((c) => c.id)),
    [visibleCategories]
  );

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    visibleCategories.forEach((c) => map.set(c.id, c));
    return map;
  }, [visibleCategories]);

  const visibleProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (!p.isAvailable) return false;
      // Hide products whose category is hidden/unavailable
      if (categories.length > 0 && !availableCategoryIds.has(p.categoryId)) {
        return false;
      }
      if (selectedCategoryId !== 'all' && p.categoryId !== selectedCategoryId) {
        return false;
      }
      if (q) {
        const hay = `${p.name} ${p.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, categories.length, availableCategoryIds, selectedCategoryId, searchQuery]);

  const cartCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const cartTotal = useMemo(
    () => cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0),
    [cart]
  );

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const whatsappHref = useMemo(() => {
    const cleanPhone = (store.whatsapp || '').replace(/[^\d]/g, '');
    const lines: string[] = [
      `Hola *${store.name}*! Quiero realizar el siguiente pedido:`,
      '',
    ];
    cart.forEach((item) => {
      const subtotal = item.product.price * item.quantity;
      lines.push(
        `• ${item.quantity}x ${item.product.name} — ${formatPriceARS(subtotal)}`
      );
    });
    lines.push('');
    lines.push(`*Total estimado:* ${formatPriceARS(cartTotal)}`);
    lines.push('');
    if (customerName.trim()) {
      lines.push(`*Cliente:* ${customerName.trim()}`);
    }
    lines.push(
      `*Modalidad:* ${deliveryType === 'envio' ? 'Envío a domicilio' : 'Retiro en el local'}`
    );
    if (deliveryType === 'envio' && customerAddress.trim()) {
      lines.push(`*Dirección:* ${customerAddress.trim()}`);
    }
    lines.push(`*Pago:* ${paymentMethod}`);
    if (orderNotes.trim()) {
      lines.push(`*Notas:* ${orderNotes.trim()}`);
    }
    const text = encodeURIComponent(lines.join('\n'));
    return `https://wa.me/${cleanPhone}?text=${text}`;
  }, [
    store.name,
    store.whatsapp,
    cart,
    cartTotal,
    customerName,
    deliveryType,
    customerAddress,
    paymentMethod,
    orderNotes,
  ]);

  const accent = store.accentColor || '#0F172A';
  const accentText = getContrastTextColor(accent);

  const bgTheme = useMemo(
    () =>
      getStoreBackgroundStyle({
        backgroundColor: store.backgroundColor,
        backgroundTexture: store.backgroundTexture,
        backgroundImageUrl: store.backgroundImageUrl,
      }),
    [store.backgroundColor, store.backgroundTexture, store.backgroundImageUrl]
  );

  const isDark = bgTheme.isDark;

  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = bgTheme.resolvedColor;
    return () => {
      document.body.style.backgroundColor = prev;
    };
  }, [bgTheme.resolvedColor]);

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        isDark ? 'text-zinc-100' : 'text-zinc-900'
      }`}
      style={bgTheme.style}
    >
      {/* Compact Store Top Bar */}
      <header
        className={`sticky top-0 z-30 border-b backdrop-blur-md ${
          isDark
            ? 'border-white/10 bg-zinc-950/85 text-zinc-100'
            : 'border-zinc-200/80 bg-white/95 text-zinc-900'
        }`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            {store.logoUrl && (
              <div
                className={`h-8 w-8 shrink-0 overflow-hidden rounded-lg border ${
                  isDark ? 'border-white/15 bg-zinc-900' : 'border-zinc-200 bg-white'
                }`}
              >
                <ResilientImage
                  src={store.logoUrl}
                  alt={store.name}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <span
              className={`truncate font-display text-base font-bold tracking-tight ${
                isDark ? 'text-zinc-100' : 'text-zinc-900'
              }`}
            >
              {store.name}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton
              storeName={store.name}
              variant="outline"
              darkSurface={isDark}
            />
            {canManageStore && (
              <button
                type="button"
                onClick={onOpenStoreAdmin}
                className={`hidden sm:inline-flex rounded-lg border px-3.5 py-2 text-xs font-medium whitespace-nowrap cursor-pointer ${
                  isDark
                    ? 'border-white/15 bg-zinc-900 text-zinc-100 hover:bg-zinc-800'
                    : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50'
                }`}
              >
                Administrar tienda
              </button>
            )}

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-transform active:scale-[0.98] whitespace-nowrap cursor-pointer"
              style={{ backgroundColor: accent, color: accentText }}
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Pedido</span>
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums ${
                  accentText === '#FFFFFF' ? 'bg-white/20' : 'bg-black/15'
                }`}
              >
                {cartCount}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Store Cover Banner & Profile */}
      <section className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        <div
          className={`overflow-hidden rounded-xl border backdrop-blur-xs ${
            isDark
              ? 'border-white/10 bg-zinc-900/90'
              : 'border-zinc-200 bg-white'
          }`}
        >
          <div
            className={`relative aspect-[3/1] w-full overflow-hidden ${
              isDark ? 'bg-zinc-950' : 'bg-zinc-100'
            }`}
          >
            <ResilientImage
              src={store.bannerUrl || DEMO_HERO_BANNER}
              alt={`Portada de ${store.name}`}
              className="h-full w-full object-cover object-center"
            />
          </div>

          <div className="px-5 pb-4 pt-3 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
              {store.logoUrl && (
                <div
                  className={`-mt-10 relative z-10 h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 shadow-md sm:-mt-12 sm:h-20 sm:w-20 ${
                    isDark ? 'border-zinc-900 bg-zinc-900' : 'border-white bg-white'
                  }`}
                >
                  <ResilientImage
                    src={store.logoUrl}
                    alt={`Logo de ${store.name}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1
                  className={`font-display text-xl font-bold tracking-tight sm:text-2xl text-balance ${
                    isDark ? 'text-zinc-100' : 'text-zinc-900'
                  }`}
                >
                  {store.name}
                </h1>
                {store.description && (
                  <p
                    className={`mt-1 max-w-2xl text-xs leading-relaxed sm:text-sm ${
                      isDark ? 'text-zinc-300' : 'text-zinc-600'
                    }`}
                  >
                    {store.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {(store.address || store.hours || store.whatsapp) && (
            <div
              className={`flex flex-wrap items-center justify-between gap-4 border-t px-5 py-3 text-xs sm:px-6 ${
                isDark
                  ? 'border-white/10 text-zinc-300'
                  : 'border-zinc-100 text-zinc-600'
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {store.address && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin
                      className={`h-3.5 w-3.5 ${
                        isDark ? 'text-zinc-400' : 'text-zinc-400'
                      }`}
                    />
                    <span>{store.address}</span>
                  </span>
                )}
                {store.hours && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock
                      className={`h-3.5 w-3.5 ${
                        isDark ? 'text-zinc-400' : 'text-zinc-400'
                      }`}
                    />
                    <span>{store.hours}</span>
                  </span>
                )}
              </div>

              {store.whatsapp && (
                <a
                  href={`https://wa.me/${store.whatsapp.replace(/[^\d]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 font-semibold whitespace-nowrap ${
                    isDark
                      ? 'text-emerald-400 hover:text-emerald-300'
                      : 'text-emerald-700 hover:text-emerald-800'
                  }`}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Consultar por WhatsApp</span>
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Search & Category Filter Controls */}
      <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedCategoryId('all')}
              className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategoryId === 'all'
                  ? ''
                  : isDark
                    ? 'border border-white/15 bg-zinc-900/90 text-zinc-200 hover:bg-zinc-800'
                    : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
              style={
                selectedCategoryId === 'all'
                  ? { backgroundColor: accent, color: accentText }
                  : undefined
              }
            >
              Todos
            </button>
            {visibleCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategoryId === cat.id
                    ? ''
                    : isDark
                      ? 'border border-white/15 bg-zinc-900/90 text-zinc-200 hover:bg-zinc-800'
                      : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
                style={
                  selectedCategoryId === cat.id
                    ? { backgroundColor: accent, color: accentText }
                    : undefined
                }
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              className={`pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 ${
                isDark ? 'text-zinc-400' : 'text-zinc-400'
              }`}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar producto..."
              className={`w-full rounded-lg border py-2 pr-3 pl-9 text-xs focus:outline-none ${
                isDark
                  ? 'border-white/15 bg-zinc-900/90 text-zinc-100 placeholder:text-zinc-400 focus:border-white/40'
                  : 'border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900'
              }`}
            />
          </div>
        </div>
      </section>

      {/* Catalog Grid */}
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-20 sm:px-6">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className={`h-80 animate-pulse rounded-xl border ${
                  isDark ? 'border-white/10 bg-zinc-900/80' : 'border-zinc-200 bg-white'
                }`}
              />
            ))}
          </div>
        ) : visibleProducts.length === 0 ? (
          <div
            className={`rounded-xl border p-12 text-center ${
              isDark ? 'border-white/10 bg-zinc-900/90' : 'border-zinc-200 bg-white'
            }`}
          >
            <p
              className={`font-display text-base font-semibold ${
                isDark ? 'text-zinc-100' : 'text-zinc-900'
              }`}
            >
              No hay productos disponibles en esta vista
            </p>
            <p className={`mt-1 text-sm ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              Probá cambiando de categoría o limpiando el filtro de búsqueda.
            </p>
            {(selectedCategoryId !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId('all');
                  setSearchQuery('');
                }}
                className={`mt-4 rounded-lg border px-4 py-2 text-xs font-medium cursor-pointer ${
                  isDark
                    ? 'border-white/15 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                    : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
                }`}
              >
                Ver todo el catálogo
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProducts.map((product) => {
              const catName = categoryMap.get(product.categoryId)?.name || 'Catálogo';
              const inCart = cart.find((i) => i.product.id === product.id);
              return (
                <article
                  key={product.id}
                  className={`group flex flex-col overflow-hidden rounded-xl border backdrop-blur-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                    isDark
                      ? 'border-white/10 bg-zinc-900/90 hover:border-white/20'
                      : 'border-zinc-200 bg-white'
                  }`}
                >
                  {/* Clickable Image Container: Shows full uncropped image (object-contain) with subtle ambient backdrop and zoom icon */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openQuickView(product)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openQuickView(product);
                      }
                    }}
                    className={`relative aspect-[4/3] w-full overflow-hidden cursor-zoom-in select-none group/img ${
                      isDark ? 'bg-zinc-950/80' : 'bg-zinc-100/90'
                    }`}
                    title="Click para ampliar imagen y ver detalles"
                  >
                    {/* Blurred backdrop to blend edges smoothly for any image aspect ratio */}
                    {product.imageUrl && (
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-15 blur-md scale-110"
                        style={{ backgroundImage: `url(${product.imageUrl})` }}
                        aria-hidden="true"
                      />
                    )}
                    <ResilientImage
                      src={product.imageUrl}
                      alt={product.name}
                      fallbackLabel={product.name}
                      className="relative z-1 h-full w-full object-contain p-2 transition-transform duration-300 group-hover/img:scale-[1.03]"
                    />

                    {/* Hover indicator to make zoom affordance unmistakable */}
                    <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 rounded-full bg-zinc-950/70 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-xs opacity-0 transition-opacity duration-200 group-hover/img:opacity-100">
                      <ZoomIn className="h-3 w-3" />
                      <span>Ver foto</span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <div
                        className={`flex items-center gap-2 text-[11px] font-medium ${
                          isDark ? 'text-zinc-400' : 'text-zinc-500'
                        }`}
                      >
                        <span>{catName}</span>
                        {product.featured && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className={isDark ? 'text-zinc-200' : 'text-zinc-800'}>
                              Destacado
                            </span>
                          </>
                        )}
                      </div>
                      <h2
                        onClick={() => openQuickView(product)}
                        className={`mt-1 font-display text-base font-semibold cursor-pointer transition-colors ${
                          isDark
                            ? 'text-zinc-100 hover:text-white'
                            : 'text-zinc-900 hover:text-zinc-700'
                        }`}
                      >
                        {product.name}
                      </h2>
                      {product.description && (
                        <p
                          className={`mt-1.5 line-clamp-2 text-xs leading-relaxed ${
                            isDark ? 'text-zinc-300' : 'text-zinc-600'
                          }`}
                        >
                          {product.description}
                        </p>
                      )}
                    </div>

                    <div
                      className={`mt-4 flex items-center justify-between gap-3 border-t pt-3.5 ${
                        isDark ? 'border-white/10' : 'border-zinc-100'
                      }`}
                    >
                      <span
                        className={`font-mono text-base font-semibold tabular-nums ${
                          isDark ? 'text-zinc-100' : 'text-zinc-900'
                        }`}
                      >
                        {formatPriceARS(product.price)}
                      </span>

                      {inCart ? (
                        <div
                          className={`inline-flex items-center gap-1 rounded-lg border p-1 ${
                            isDark
                              ? 'border-white/15 bg-zinc-800'
                              : 'border-zinc-200 bg-zinc-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => updateQuantity(product.id, -1)}
                            className={`flex h-7 w-7 items-center justify-center rounded-md cursor-pointer ${
                              isDark
                                ? 'bg-zinc-900 text-zinc-100 hover:bg-zinc-700'
                                : 'bg-white text-zinc-700 hover:bg-zinc-100'
                            }`}
                            aria-label="Restar unidad"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[24px] text-center font-mono text-xs font-semibold tabular-nums">
                            {inCart.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(product.id, 1)}
                            className={`flex h-7 w-7 items-center justify-center rounded-md cursor-pointer ${
                              isDark
                                ? 'bg-zinc-900 text-zinc-100 hover:bg-zinc-700'
                                : 'bg-white text-zinc-700 hover:bg-zinc-100'
                            }`}
                            aria-label="Sumar unidad"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-transform active:scale-[0.98] whitespace-nowrap cursor-pointer"
                          style={{ backgroundColor: accent, color: accentText }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Agregar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Slide-Over WhatsApp Cart Drawer */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-zinc-950/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <div>
                <h2 className="font-display text-base font-bold text-zinc-900">
                  Tu pedido en {store.name}
                </h2>
                <p className="text-xs text-zinc-500 tabular-nums">
                  {cartCount} {cartCount === 1 ? 'producto' : 'productos'} seleccionados
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 cursor-pointer"
                aria-label="Cerrar carrito"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center py-12">
                  <ShoppingBag className="h-10 w-10 text-zinc-300" />
                  <p className="mt-3 font-display text-sm font-semibold text-zinc-900">
                    El carrito está vacío
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Agregá productos del catálogo para armar tu pedido por WhatsApp.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <ul className="divide-y divide-zinc-100">
                    {cart.map((item) => (
                      <li key={item.product.id} className="flex items-center gap-3 py-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                          <ResilientImage
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-zinc-900">
                            {item.product.name}
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-zinc-600 tabular-nums">
                            {formatPriceARS(item.product.price * item.quantity)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="min-w-[20px] text-center font-mono text-xs font-semibold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            className="ml-1 rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* Delivery Details */}
                  <div className="space-y-3 border-t border-zinc-200 pt-4">
                    <h3 className="text-xs font-semibold text-zinc-900">
                      Datos para coordinar tu pedido
                    </h3>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600">
                        Tu nombre
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Ej.: Sofía Martínez"
                        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600">
                        Modalidad de entrega
                      </label>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setDeliveryType('retiro')}
                          className={`rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer ${
                            deliveryType === 'retiro'
                              ? 'border-zinc-900 bg-zinc-900 text-white'
                              : 'border-zinc-200 bg-white text-zinc-700'
                          }`}
                        >
                          Retiro en local
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeliveryType('envio')}
                          className={`rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer ${
                            deliveryType === 'envio'
                              ? 'border-zinc-900 bg-zinc-900 text-white'
                              : 'border-zinc-200 bg-white text-zinc-700'
                          }`}
                        >
                          Envío a domicilio
                        </button>
                      </div>
                    </div>

                    {deliveryType === 'envio' && (
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-600">
                          Dirección de entrega
                        </label>
                        <input
                          type="text"
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                          placeholder="Calle, número, piso / referencia"
                          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600">
                        Forma de pago preferida
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none"
                      >
                        <option value="Efectivo / Transferencia">Efectivo / Transferencia</option>
                        <option value="Transferencia bancaria">Transferencia bancaria</option>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Tarjeta / Mercado Pago">Tarjeta / Mercado Pago</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-600">
                        Notas adicionales (opcional)
                      </label>
                      <textarea
                        rows={2}
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="Aclaraciones sobre talles, horarios o variantes..."
                        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-zinc-200 bg-zinc-50 px-5 py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-600">Total del pedido</span>
                  <span className="font-mono text-lg font-bold text-zinc-900 tabular-nums">
                    {formatPriceARS(cartTotal)}
                  </span>
                </div>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Enviar pedido por WhatsApp</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Image Zoom & Details Modal */}
      {quickViewProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          onClick={closeQuickView}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xl sm:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={closeQuickView}
              className="absolute top-3 right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-md backdrop-blur-xs hover:bg-black/80 transition-colors cursor-pointer sm:top-4 sm:right-4"
              aria-label="Cerrar vista ampliada"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Left / Top: Interactive Zoom Canvas (Complete uncropped image) */}
            <div className="relative flex flex-1 flex-col items-center justify-center bg-zinc-950/95 overflow-hidden min-h-[280px] sm:min-h-[440px] select-none">
              {/* Subtle ambient background glow */}
              {quickViewProduct.imageUrl && (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-20 blur-xl scale-125"
                  style={{ backgroundImage: `url(${quickViewProduct.imageUrl})` }}
                  aria-hidden="true"
                />
              )}

              {/* Main image with interactive zoom */}
              <div
                className="relative z-10 flex h-full w-full items-center justify-center p-4 overflow-auto cursor-zoom-in"
                onClick={() => setZoomScale((prev) => (prev >= 2.5 ? 1 : prev + 0.75))}
                title="Click en la imagen para aumentar zoom"
              >
                <img
                  src={quickViewProduct.imageUrl || ''}
                  alt={quickViewProduct.name}
                  className="max-h-[55vh] sm:max-h-[460px] w-auto max-w-full object-contain transition-transform duration-200 ease-out drop-shadow-md"
                  style={{ transform: `scale(${zoomScale})` }}
                />
              </div>

              {/* Zoom control pill */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full bg-zinc-900/85 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur-xs border border-white/10">
                <button
                  type="button"
                  onClick={() => setZoomScale((prev) => Math.max(1, Number((prev - 0.5).toFixed(2))))}
                  disabled={zoomScale <= 1}
                  className="p-1 text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer"
                  title="Reducir zoom"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="font-mono text-[11px] tabular-nums px-1.5 font-semibold">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomScale((prev) => Math.min(3, Number((prev + 0.5).toFixed(2))))}
                  disabled={zoomScale >= 3}
                  className="p-1 text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer"
                  title="Aumentar zoom"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                {zoomScale !== 1 && (
                  <button
                    type="button"
                    onClick={() => setZoomScale(1)}
                    className="ml-1 pl-1.5 border-l border-white/20 text-[11px] text-zinc-300 hover:text-white cursor-pointer"
                    title="Restablecer tamaño normal"
                  >
                    <RotateCcw className="h-3 w-3 inline mr-1" />
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Right / Bottom: Details, Price, and Cart Controls */}
            <div
              className={`flex w-full flex-col justify-between p-6 sm:w-80 sm:border-l ${
                isDark
                  ? 'border-white/10 bg-zinc-900 text-zinc-100'
                  : 'border-zinc-200 bg-white text-zinc-900'
              }`}
            >
              <div className="space-y-3">
                <div
                  className={`flex items-center gap-2 text-xs font-medium ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}
                >
                  <span>{categoryMap.get(quickViewProduct.categoryId)?.name || 'Catálogo'}</span>
                  {quickViewProduct.featured && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className={`font-semibold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                        Destacado
                      </span>
                    </>
                  )}
                </div>

                <h3
                  className={`font-display text-xl font-bold leading-tight ${
                    isDark ? 'text-zinc-100' : 'text-zinc-900'
                  }`}
                >
                  {quickViewProduct.name}
                </h3>

                <div className="pt-1">
                  <span
                    className={`font-mono text-2xl font-bold tabular-nums ${
                      isDark ? 'text-zinc-100' : 'text-zinc-900'
                    }`}
                  >
                    {formatPriceARS(quickViewProduct.price)}
                  </span>
                </div>

                {quickViewProduct.description ? (
                  <div
                    className={`border-t pt-3 ${
                      isDark ? 'border-white/10' : 'border-zinc-100'
                    }`}
                  >
                    <h4 className="text-xs font-semibold tracking-wider text-zinc-400">
                      Descripción
                    </h4>
                    <p
                      className={`mt-1.5 text-xs sm:text-sm leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto pr-1 ${
                        isDark ? 'text-zinc-300' : 'text-zinc-600'
                      }`}
                    >
                      {quickViewProduct.description}
                    </p>
                  </div>
                ) : (
                  <div
                    className={`border-t pt-3 ${
                      isDark ? 'border-white/10' : 'border-zinc-100'
                    }`}
                  >
                    <p className="text-xs text-zinc-400 italic">
                      Producto disponible para entrega o retiro inmediato.
                    </p>
                  </div>
                )}
              </div>

              {/* Action buttons: Cart / Counter */}
              <div
                className={`mt-6 border-t pt-4 space-y-3 ${
                  isDark ? 'border-white/10' : 'border-zinc-100'
                }`}
              >
                {(() => {
                  const inCart = cart.find((i) => i.product.id === quickViewProduct.id);
                  return (
                    <div className="space-y-2">
                      {inCart ? (
                        <div
                          className={`flex items-center justify-between gap-3 rounded-xl border p-2 ${
                            isDark
                              ? 'border-white/10 bg-zinc-800'
                              : 'border-zinc-200 bg-zinc-50'
                          }`}
                        >
                          <span
                            className={`text-xs font-medium pl-2 ${
                              isDark ? 'text-zinc-200' : 'text-zinc-700'
                            }`}
                          >
                            En tu pedido:
                          </span>
                          <div
                            className={`inline-flex items-center gap-1.5 border rounded-lg p-1 ${
                              isDark
                                ? 'border-white/15 bg-zinc-900'
                                : 'border-zinc-200 bg-white'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => updateQuantity(quickViewProduct.id, -1)}
                              className={`flex h-8 w-8 items-center justify-center rounded-md cursor-pointer ${
                                isDark
                                  ? 'text-zinc-200 hover:bg-zinc-800'
                                  : 'text-zinc-700 hover:bg-zinc-100'
                              }`}
                              aria-label="Restar unidad"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span
                              className={`min-w-[28px] text-center font-mono text-sm font-bold tabular-nums ${
                                isDark ? 'text-zinc-100' : 'text-zinc-900'
                              }`}
                            >
                              {inCart.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(quickViewProduct.id, 1)}
                              className={`flex h-8 w-8 items-center justify-center rounded-md cursor-pointer ${
                                isDark
                                  ? 'text-zinc-200 hover:bg-zinc-800'
                                  : 'text-zinc-700 hover:bg-zinc-100'
                              }`}
                              aria-label="Sumar unidad"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(quickViewProduct)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold shadow-sm transition-transform active:scale-[0.98] cursor-pointer"
                          style={{ backgroundColor: accent, color: accentText }}
                        >
                          <Plus className="h-4 w-4" />
                          <span>Agregar al carrito</span>
                        </button>
                      )}

                      {/* Button to open checkout directly */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!inCart) addToCart(quickViewProduct);
                          closeQuickView();
                          setCartOpen(true);
                        }}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                          isDark
                            ? 'border-white/15 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'
                            : 'border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50'
                        }`}
                      >
                        <ShoppingBag className="h-3.5 w-3.5" />
                        <span>Ver carrito ({cartCount})</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
