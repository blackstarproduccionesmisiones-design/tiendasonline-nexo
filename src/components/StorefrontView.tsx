import React, { useMemo, useState } from 'react';
import {
  Clock,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import type { CartItem, Category, Product, Store } from '../types';
import { DEMO_HERO_BANNER } from '../data/demoStore';
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

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900">
      {/* Compact Store Top Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            {store.logoUrl && (
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                <ResilientImage
                  src={store.logoUrl}
                  alt={store.name}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <span className="truncate font-display text-base font-bold tracking-tight text-zinc-900">
              {store.name}
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton storeName={store.name} variant="outline" />
            {canManageStore && (
              <button
                type="button"
                onClick={onOpenStoreAdmin}
                className="hidden sm:inline-flex rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 whitespace-nowrap cursor-pointer"
              >
                Administrar tienda
              </button>
            )}

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-transform active:scale-[0.98] whitespace-nowrap cursor-pointer"
              style={{ backgroundColor: accent }}
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Pedido</span>
              <span className="rounded bg-white/20 px-1.5 py-0.5 font-mono text-[11px] tabular-nums">
                {cartCount}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Store Cover Banner & Profile */}
      <section className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="relative h-52 w-full bg-zinc-900 sm:h-64">
            <ResilientImage
              src={store.bannerUrl || DEMO_HERO_BANNER}
              alt={`Portada de ${store.name}`}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end gap-4 p-5 sm:p-6">
              {store.logoUrl && (
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-white bg-white shadow-md sm:h-20 sm:w-20">
                  <ResilientImage
                    src={store.logoUrl}
                    alt={`Logo de ${store.name}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0 text-white">
                <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl text-balance">
                  {store.name}
                </h1>
                {store.description && (
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-200 sm:text-sm">
                    {store.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-100 px-5 py-3.5 text-xs text-zinc-600 sm:px-6">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {store.address && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                  <span>{store.address}</span>
                </span>
              )}
              {store.hours && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-zinc-400" />
                  <span>{store.hours}</span>
                </span>
              )}
            </div>

            {store.whatsapp && (
              <a
                href={`https://wa.me/${store.whatsapp.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Consultar por WhatsApp</span>
              </a>
            )}
          </div>
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
                  ? 'bg-zinc-900 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
              style={
                selectedCategoryId === 'all' ? { backgroundColor: accent } : undefined
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
                    ? 'bg-zinc-900 text-white'
                    : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                }`}
                style={
                  selectedCategoryId === cat.id ? { backgroundColor: accent } : undefined
                }
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pr-3 pl-9 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
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
                className="h-80 animate-pulse rounded-xl border border-zinc-200 bg-white"
              />
            ))}
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
            <p className="font-display text-base font-semibold text-zinc-900">
              No hay productos disponibles en esta vista
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Probá cambiando de categoría o limpiando el filtro de búsqueda.
            </p>
            {(selectedCategoryId !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId('all');
                  setSearchQuery('');
                }}
                className="mt-4 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 cursor-pointer"
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
                  className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                    <ResilientImage
                      src={product.imageUrl}
                      alt={product.name}
                      fallbackLabel={product.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-500">
                        <span>{catName}</span>
                        {product.featured && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-zinc-800">Destacado</span>
                          </>
                        )}
                      </div>
                      <h2 className="mt-1 font-display text-base font-semibold text-zinc-900">
                        {product.name}
                      </h2>
                      {product.description && (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-zinc-600">
                          {product.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3.5">
                      <span className="font-mono text-base font-semibold text-zinc-900 tabular-nums">
                        {formatPriceARS(product.price)}
                      </span>

                      {inCart ? (
                        <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(product.id, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-zinc-700 hover:bg-zinc-100 cursor-pointer"
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
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                            aria-label="Sumar unidad"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-transform active:scale-[0.98] whitespace-nowrap cursor-pointer"
                          style={{ backgroundColor: accent }}
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
    </div>
  );
};
