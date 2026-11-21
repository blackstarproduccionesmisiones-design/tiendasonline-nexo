import React, { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Send,
  ShieldCheck,
  Smartphone,
  Store as StoreIcon,
} from 'lucide-react';
import { db } from '../lib/firebase';
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

  // Optional Google Form URL configured by Master Admin
  const [googleFormUrl, setGoogleFormUrl] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'platformConfig', 'contactForm'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as { googleFormUrl?: string };
          setGoogleFormUrl((data.googleFormUrl || '').trim());
        } else {
          setGoogleFormUrl('');
        }
      },
      () => {
        // Keep built-in form fallback if unavailable
      }
    );
    return () => unsub();
  }, []);

  const parsedGoogleForm = useMemo(() => {
    if (!googleFormUrl) return null;
    try {
      const parsed = new URL(googleFormUrl);
      if (parsed.protocol !== 'https:') return null;
      if (parsed.hostname === 'docs.google.com' && parsed.pathname.startsWith('/forms/')) {
        const embed = new URL(parsed.toString());
        embed.searchParams.set('embedded', 'true');
        return {
          mode: 'embed' as const,
          directUrl: parsed.toString(),
          embedUrl: embed.toString(),
        };
      }
      if (parsed.hostname === 'forms.gle' && parsed.pathname.length > 1) {
        return {
          mode: 'link' as const,
          directUrl: parsed.toString(),
          embedUrl: '',
        };
      }
      return null;
    } catch {
      return null;
    }
  }, [googleFormUrl]);

  // Store creation contact request form state
  const [reqStoreName, setReqStoreName] = useState('');
  const [reqCategory, setReqCategory] = useState('');
  const [reqFullName, setReqFullName] = useState('');
  const [reqPhone, setReqPhone] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);
  const [reqSuccess, setReqSuccess] = useState<{
    emailSent: boolean;
    mailtoHref: string;
    storeName: string;
  } | null>(null);

  const handleSubmitStoreRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setReqError(null);

    const storeName = reqStoreName.trim();
    const category = reqCategory.trim();
    const fullName = reqFullName.trim();
    const phone = reqPhone.trim();

    if (storeName.length < 2 || storeName.length > 100) {
      setReqError('Ingresá el nombre de la tienda (mínimo 2 caracteres).');
      return;
    }
    if (category.length < 2 || category.length > 80) {
      setReqError('Ingresá el rubro de tu comercio (mínimo 2 caracteres).');
      return;
    }
    if (fullName.length < 2 || fullName.length > 100) {
      setReqError('Ingresá tu nombre y apellido.');
      return;
    }
    if (phone.replace(/[^\d+]/g, '').length < 6 || phone.length > 30) {
      setReqError('Ingresá un número de teléfono o WhatsApp válido.');
      return;
    }

    setReqSubmitting(true);
    const requestId = `req_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

    try {
      await setDoc(doc(db, 'storeRequests', requestId), {
        id: requestId,
        storeName,
        category,
        fullName,
        phone,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      let emailSent = false;
      try {
        const res = await fetch('/api/store-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId,
            storeName,
            category,
            fullName,
            phone,
          }),
        });
        const raw = await res.text();
        if (res.ok && raw) {
          const parsed = JSON.parse(raw) as { emailSent?: boolean };
          emailSent = Boolean(parsed.emailSent);
        }
      } catch {
        emailSent = false;
      }

      const subject = encodeURIComponent(`Solicitud CREAR TIENDA: ${storeName} (${category})`);
      const body = encodeURIComponent(
        [
          'Hola equipo de NEXO+, quiero solicitar la creación de una tienda:',
          '',
          `Nombre de la tienda: ${storeName}`,
          `Rubro: ${category}`,
          `Nombre y apellido: ${fullName}`,
          `Tel: ${phone}`,
        ].join('\n')
      );

      setReqSuccess({
        emailSent,
        mailtoHref: `mailto:nexodigitalposadas@gmail.com?subject=${subject}&body=${body}`,
        storeName,
      });
      setReqStoreName('');
      setReqCategory('');
      setReqFullName('');
      setReqPhone('');
    } catch {
      setReqError('No pudimos enviar la solicitud en este momento. Intentá nuevamente o escribinos por correo.');
    } finally {
      setReqSubmitting(false);
    }
  };

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
              Directorio de Tiendas
            </a>
            <a
              href="#capacidades"
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
            >
              Plataforma
            </a>
            <a
              href="#crear-tienda"
              className="hover:text-zinc-900 transition-colors whitespace-nowrap shrink-0"
            >
              Crear Tienda
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
                NEXO+ · Plataforma de Catálogos Digitales y Directorio de Tiendas Online
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

      {/* Featured Stores Directory Section */}
      <section
        id="comercios"
        className="border-t border-zinc-200 bg-zinc-100/70 py-12 sm:py-16"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-2xl bg-zinc-900 px-6 py-6 text-white shadow-sm sm:px-8 sm:py-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                  Comercios disponibles
                </p>
                <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  DIRECTORIO DE TIENDAS
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm text-zinc-300">
                  Seleccioná una tienda para explorar su catálogo y realizar pedidos.
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs font-medium text-zinc-300 tabular-nums">
                <StoreIcon className="h-4 w-4 text-zinc-400 shrink-0" />
                <span>
                  {activeStores.length > 0
                    ? `${activeStores.length} ${activeStores.length === 1 ? 'tienda activa' : 'tiendas activas'}`
                    : 'Vista previa de demostración'}
                </span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-72 animate-pulse rounded-xl border border-zinc-200 bg-white"
              />
            ))}
          </div>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
        </div>
      </section>

      {/* Footer Segment: Solicitar CREAR TIENDA */}
      <footer id="crear-tienda" className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <div className="grid items-start gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Sumate a NEXO+
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                CREAR TIENDA
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                ¿Querés tener tu propio catálogo digital en el directorio? Completá el formulario y enviamos tu solicitud directamente al administrador maestro para activar tu tienda.
              </p>

              <div className="mt-6 space-y-3 border-t border-zinc-200 pt-5 text-xs text-zinc-600">
                <div className="flex items-center gap-2.5">
                  <StoreIcon className="h-4 w-4 text-zinc-800 shrink-0" />
                  <span>Enlace único para compartir en redes y WhatsApp</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Smartphone className="h-4 w-4 text-zinc-800 shrink-0" />
                  <span>App instalable en el celular con logo e ícono propios</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-zinc-800 shrink-0" />
                  <span>
                    Recepción directa:{' '}
                    <a
                      href="mailto:nexodigitalposadas@gmail.com"
                      className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700"
                    >
                      nexodigitalposadas@gmail.com
                    </a>
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-zinc-200 bg-[#FAFAFA] p-6 sm:p-8">
                {parsedGoogleForm?.mode === 'embed' ? (
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                      <iframe
                        src={parsedGoogleForm.embedUrl}
                        title="Formulario para solicitar CREAR TIENDA"
                        className="h-[680px] w-full border-0"
                        loading="lazy"
                      >
                        Cargando formulario…
                      </iframe>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                      <span>Formulario conectado directamente con Google Forms.</span>
                      <a
                        href={parsedGoogleForm.directUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-zinc-800 hover:text-zinc-950 underline underline-offset-2"
                      >
                        <span>Abrir en pestaña nueva</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ) : parsedGoogleForm?.mode === 'link' ? (
                  <div className="space-y-4 py-4">
                    <div>
                      <h3 className="font-display text-lg font-bold text-zinc-900">
                        Completar solicitud en Google Forms
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                        Ingresá el nombre de tu tienda, rubro, nombre y apellido y teléfono para recibir respuesta directa del equipo NEXO+.
                      </p>
                    </div>
                    <a
                      href={parsedGoogleForm.directUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
                    >
                      <span>Abrir formulario CREAR TIENDA</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                ) : reqSuccess ? (
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                      <div>
                        <p className="font-display text-sm font-bold">
                          Solicitud recibida para "{reqSuccess.storeName}"
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-emerald-900">
                          {reqSuccess.emailSent
                            ? 'Enviamos tus datos por correo a nexodigitalposadas@gmail.com y quedaron registrados en el panel administrador. Nos pondremos en contacto a la brevedad.'
                            : 'Tus datos quedaron registrados para el administrador maestro (nexodigitalposadas@gmail.com). Si querés, también podés enviar una copia inmediata desde tu correo.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {!reqSuccess.emailSent && (
                        <a
                          href={reqSuccess.mailtoHref}
                          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          <span>Enviar copia por correo</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setReqSuccess(null)}
                        className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 transition-colors cursor-pointer"
                      >
                        Enviar otra solicitud
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitStoreRequest} className="space-y-4">
                    <div>
                      <h3 className="font-display text-base font-bold text-zinc-900">
                        Solicitar alta de tienda
                      </h3>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        Completá los 4 datos para que te contactemos y configuremos tu catálogo.
                      </p>
                    </div>

                    {reqError && (
                      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                        <span>{reqError}</span>
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="req-store-name"
                          className="block text-xs font-semibold uppercase tracking-wide text-zinc-800"
                        >
                          Nombre de la tienda
                        </label>
                        <input
                          id="req-store-name"
                          type="text"
                          required
                          minLength={2}
                          maxLength={100}
                          value={reqStoreName}
                          onChange={(e) => setReqStoreName(e.target.value)}
                          placeholder="Ej.: Almacén del Sur"
                          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="req-category"
                          className="block text-xs font-semibold uppercase tracking-wide text-zinc-800"
                        >
                          Rubro
                        </label>
                        <input
                          id="req-category"
                          type="text"
                          required
                          minLength={2}
                          maxLength={80}
                          value={reqCategory}
                          onChange={(e) => setReqCategory(e.target.value)}
                          placeholder="Ej.: Indumentaria, Gastronomía, Bazar"
                          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="req-full-name"
                          className="block text-xs font-semibold uppercase tracking-wide text-zinc-800"
                        >
                          Nombre y apellido
                        </label>
                        <input
                          id="req-full-name"
                          type="text"
                          required
                          minLength={2}
                          maxLength={100}
                          value={reqFullName}
                          onChange={(e) => setReqFullName(e.target.value)}
                          placeholder="Ej.: Juan Pérez"
                          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="req-phone"
                          className="block text-xs font-semibold uppercase tracking-wide text-zinc-800"
                        >
                          Tel
                        </label>
                        <input
                          id="req-phone"
                          type="tel"
                          required
                          minLength={6}
                          maxLength={30}
                          value={reqPhone}
                          onChange={(e) => setReqPhone(e.target.value)}
                          placeholder="Ej.: +54 9 376 4000000"
                          className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3.5 py-2.5 font-mono text-sm text-zinc-900 placeholder:font-sans placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <span className="text-[11px] text-zinc-500">
                        Se envía a nexodigitalposadas@gmail.com
                      </span>
                      <button
                        type="submit"
                        disabled={reqSubmitting}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
                      >
                        {reqSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        <span>Solicitar CREAR TIENDA</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-200 bg-zinc-50 py-6">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-zinc-500 sm:px-6">
            <span>NEXO+ · Plataforma de Catálogos Digitales y Directorio de Tiendas Online</span>
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
        </div>
      </footer>
    </div>
  );
};
