import React from 'react';
import { ArrowRight, Store as StoreIcon, MapPin, MessageCircle, Smartphone, ShieldCheck } from 'lucide-react';
import type { Store } from '../types';
import { DEMO_HERO_BANNER, DEMO_STORE } from '../data/demoStore';
import { ResilientImage } from './ResilientImage';
import { PWAInstallButton } from './PWAInstallButton';

interface DirectoryViewProps {
  stores: Store[];
  loading: boolean;
  onSelectStore: (slug: string) => void;
  onOpenAuth: () => void;
  currentUserEmail?: string | null;
  isMasterAdmin: boolean;
  onOpenDashboard: () => void;
}

export const DirectoryView: React.FC<DirectoryViewProps> = ({
  stores,
  loading,
  onSelectStore,
  onOpenAuth,
  currentUserEmail,
  isMasterAdmin,
  onOpenDashboard,
}) => {
  const activeStores = stores.filter((s) => s.isActive);
  const displayStores = activeStores.length > 0 ? activeStores : [DEMO_STORE];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-display text-lg font-bold tracking-tight text-zinc-900 whitespace-nowrap shrink-0"
          >
            NEXO+
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-600">
            <a
              href="#comercios"
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
            >
              Comercios
            </a>
            <a
              href="#capacidades"
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
            >
              Plataforma
            </a>
            <button
              type="button"
              onClick={() => onSelectStore(displayStores[0].slug)}
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Tienda Demo
            </button>
            <button
              type="button"
              onClick={currentUserEmail ? onOpenDashboard : onOpenAuth}
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {currentUserEmail
                ? isMasterAdmin
                  ? 'Panel Maestro'
                  : 'Mi Comercio'
                : 'Acceso Comercios'}
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <PWAInstallButton variant="outline" />
            <button
              type="button"
              onClick={currentUserEmail ? onOpenDashboard : onOpenAuth}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {currentUserEmail ? 'Ir al panel' : 'Ingresar'}
            </button>
          </div>
        </div>
      </header>

      {/* Editorial Hero Section */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-12 sm:px-6 lg:pt-14">
        <div className="grid items-stretch gap-8 lg:grid-cols-12">
          <div className="flex flex-col justify-between lg:col-span-6">
            <div>
              <p className="text-xs font-medium tracking-wide text-zinc-500">
                NEXO+ · Plataforma de Catálogos Digitales
              </p>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-zinc-900 sm:text-5xl sm:leading-[1.08] text-balance">
                Tu tienda online lista para vender por WhatsApp.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600">
                Cada comercio cuenta con su propio catálogo autoadministrable, fotos alojadas en Cloudinary, carrito con pedido directo a WhatsApp y aplicación instalable con ícono propio.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onSelectStore(displayStores[0].slug)}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>Explorar {activeStores.length > 0 ? displayStores[0].name : 'Tienda Demo'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={currentUserEmail ? onOpenDashboard : onOpenAuth}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>{currentUserEmail ? 'Abrir panel de gestión' : 'Ingresar a mi panel'}</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-72 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 sm:h-88 lg:h-full min-h-[300px]">
              <ResilientImage
                src={DEMO_HERO_BANNER}
                alt="Exhibición editorial de comercio en NEXO+"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 text-white">
                <p className="text-xs font-medium text-zinc-200">
                  Catálogo en vivo · Experiencia móvil instalable
                </p>
                <p className="mt-1 font-display text-lg font-semibold">
                  Diseño limpio enfocado en tus productos
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width 4-Column Feature Strip */}
        <div
          id="capacidades"
          className="mt-10 grid gap-4 border-y border-zinc-200 py-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
              <MessageCircle className="h-4 w-4 text-emerald-700" />
              <span>Pedidos por WhatsApp</span>
            </div>
            <p className="text-xs leading-relaxed text-zinc-600">
              Carrito estructurado que arma el resumen con cantidades, entrega y total.
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
              <StoreIcon className="h-4 w-4 text-zinc-800" />
              <span>Gestión Independiente</span>
            </div>
            <p className="text-xs leading-relaxed text-zinc-600">
              Cada tienda accede con su correo para editar precios, disponibilidad y horarios.
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
              <Smartphone className="h-4 w-4 text-zinc-800" />
              <span>PWA con Ícono Propio</span>
            </div>
            <p className="text-xs leading-relaxed text-zinc-600">
              Subí el ícono personalizado de tu tienda para instalarla como app en Android e iOS.
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900">
              <ShieldCheck className="h-4 w-4 text-zinc-800" />
              <span>Panel Maestro NEXO+</span>
            </div>
            <p className="text-xs leading-relaxed text-zinc-600">
              Alta centralizada de comercios con cuentas aisladas y control de disponibilidad.
            </p>
          </div>
        </div>
      </section>

      {/* Active Stores Directory */}
      <section id="comercios" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-zinc-900">
              Comercios disponibles
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Seleccioná una tienda para explorar su catálogo y realizar pedidos.
            </p>
          </div>
          <span className="font-mono text-xs text-zinc-500 tabular-nums">
            {activeStores.length > 0
              ? `${activeStores.length} ${activeStores.length === 1 ? 'tienda activa' : 'tiendas activas'}`
              : 'Vista previa de demostración'}
          </span>
        </div>

        {loading ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-xl border border-zinc-200 bg-white"
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayStores.map((store) => (
              <article
                key={store.id}
                onClick={() => onSelectStore(store.slug)}
                className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
              >
                <div className="relative h-44 w-full overflow-hidden bg-zinc-100">
                  <ResilientImage
                    src={store.bannerUrl || DEMO_HERO_BANNER}
                    alt={`Portada de ${store.name}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  {store.logoUrl && (
                    <div className="absolute bottom-3 left-4 h-12 w-12 overflow-hidden rounded-lg border border-white/80 bg-white shadow-sm">
                      <ResilientImage
                        src={store.logoUrl}
                        alt={`Logo de ${store.name}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span>{store.isDemo ? 'Tienda Demo' : 'Catálogo Online'}</span>
                      <span aria-hidden="true">·</span>
                      <span>WhatsApp activo</span>
                    </div>
                    <h3 className="mt-1.5 font-display text-lg font-semibold text-zinc-900">
                      {store.name}
                    </h3>
                    {store.description && (
                      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-zinc-600">
                        {store.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 truncate text-zinc-500 max-w-[65%]">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{store.address || 'Pedidos online'}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-zinc-900 group-hover:translate-x-0.5 transition-transform whitespace-nowrap">
                      <span>Ver tienda</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-zinc-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-zinc-500 sm:px-6">
          <span>NEXO+ · Plataforma de Comercios Online</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={currentUserEmail ? onOpenDashboard : onOpenAuth}
              className="hover:text-zinc-900 transition-colors cursor-pointer"
            >
              Panel de administración
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
