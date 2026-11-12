import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { sendEmailVerification, signOut, type User } from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  Loader2,
  LogOut,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Store as StoreIcon,
  X,
} from 'lucide-react';
import { auth, db, firebaseApiKey, handleFirestoreError } from '../lib/firebase';
import { OperationType, type Store, type StoreAccount } from '../types';

function createSlugFromName(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'tienda';
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
    if (typeof maybeTs.toMillis === 'function') return maybeTs.toMillis();
    if (typeof maybeTs.seconds === 'number') return maybeTs.seconds * 1000;
  }
  return 0;
}

function sortStores(list: Store[]): Store[] {
  return [...list].sort(
    (a, b) => getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt)
  );
}

async function createStoreAccountFallback(params: {
  name: string;
  slug: string;
  email: string;
  whatsapp: string;
  tempPassword: string;
}) {
  const cleanName = params.name.trim();
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanWhatsapp = params.whatsapp.replace(/[^\d]/g, '').trim();

  if (cleanName.length < 2 || cleanName.length > 100) {
    throw new Error('El nombre del comercio debe tener entre 2 y 100 caracteres.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Ingresá un correo electrónico válido para el comercio.');
  }
  if (cleanWhatsapp.length < 6 || cleanWhatsapp.length > 20) {
    throw new Error('Ingresá un número de WhatsApp válido (ej. 5493764000000).');
  }
  if (params.tempPassword.length < 8) {
    throw new Error('La contraseña temporal debe tener al menos 8 caracteres.');
  }

  const signUpRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(firebaseApiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        password: params.tempPassword,
        returnSecureToken: true,
      }),
    }
  );

  const signUpText = await signUpRes.text();
  let signUpData: {
    localId?: string;
    idToken?: string;
    error?: { message?: string };
  } = {};
  try {
    signUpData = signUpText ? JSON.parse(signUpText) : {};
  } catch {
    throw new Error('Respuesta inválida del servicio de autenticación de Firebase.');
  }

  if (!signUpRes.ok || !signUpData.localId) {
    const code = signUpData.error?.message || 'AUTH_CREATE_FAILED';
    if (code.includes('EMAIL_EXISTS')) {
      throw new Error('Ya existe una cuenta en Firebase Authentication con ese correo electrónico.');
    }
    if (code.includes('OPERATION_NOT_ALLOWED')) {
      throw new Error(
        'Habilitá el proveedor "Correo electrónico/contraseña" en Firebase Console > Authentication > Sign-in method para el proyecto nexo-tiendas-online.'
      );
    }
    throw new Error(`No se pudo crear la cuenta del comercio (${code}).`);
  }

  if (signUpData.idToken) {
    await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${encodeURIComponent(firebaseApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: signUpData.idToken,
          displayName: cleanName,
          returnSecureToken: false,
        }),
      }
    ).catch(() => undefined);
  }

  const slug = createSlugFromName(params.slug || cleanName);
  return {
    uid: signUpData.localId,
    email: cleanEmail,
    name: cleanName,
    whatsapp: cleanWhatsapp,
    slug,
    storeId: slug,
  };
}

interface MasterAdminPanelProps {
  user: User;
  onOpenStorefront: (slug: string) => void;
  onManageStore: (store: Store) => void;
  onBackToDirectory: () => void;
}

export const MasterAdminPanel: React.FC<MasterAdminPanelProps> = ({
  user,
  onOpenStorefront,
  onManageStore,
  onBackToDirectory,
}) => {
  const [name, setName] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [stores, setStores] = useState<Store[]>([]);
  const [accountsMap, setAccountsMap] = useState<Record<string, StoreAccount>>({});
  const [loadingStores, setLoadingStores] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  // Edit existing store slug modal state
  const [editingSlugStore, setEditingSlugStore] = useState<Store | null>(null);
  const [editSlugValue, setEditSlugValue] = useState('');
  const [editSlugError, setEditSlugError] = useState<string | null>(null);
  const [savingSlug, setSavingSlug] = useState(false);

  // Cloudinary platform configuration state
  const [cloudName, setCloudName] = useState('');
  const [uploadPreset, setUploadPreset] = useState('');
  const [savingCloudinary, setSavingCloudinary] = useState(false);
  const [cloudinaryMsg, setCloudinaryMsg] = useState<string | null>(null);
  const [cloudinaryErr, setCloudinaryErr] = useState<string | null>(null);

  useEffect(() => {
    const unsubStores = onSnapshot(
      collection(db, 'stores'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Store);
        setStores(sortStores(list));
        setLoadingStores(false);
      },
      (err) => {
        setLoadingStores(false);
        handleFirestoreError(err, OperationType.LIST, 'stores');
      }
    );

    const unsubAccounts = onSnapshot(
      collection(db, 'storeAccounts'),
      (snap) => {
        const map: Record<string, StoreAccount> = {};
        snap.docs.forEach((d) => {
          const acc = d.data() as StoreAccount;
          map[acc.storeId] = acc;
        });
        setAccountsMap(map);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'storeAccounts');
      }
    );

    getDoc(doc(db, 'platformConfig', 'cloudinary'))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as { cloudName?: string; uploadPreset?: string };
          setCloudName(data.cloudName || '');
          setUploadPreset(data.uploadPreset || '');
        }
      })
      .catch(() => undefined);

    return () => {
      unsubStores();
      unsubAccounts();
    };
  }, []);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (tempPassword.length < 8) {
      setError('La contraseña temporal debe tener al menos 8 caracteres.');
      return;
    }

    const desiredSlug = createSlugFromName(customSlug || name);
    if (desiredSlug.length < 2 || !/^[a-z0-9\-]+$/.test(desiredSlug)) {
      setError('El enlace de la tienda debe tener al menos 2 caracteres (solo letras minúsculas, números y guiones).');
      return;
    }

    // Resolve unique slug if already taken
    let uniqueSlug = desiredSlug;
    if (stores.some((s) => s.slug === uniqueSlug)) {
      if (slugTouched) {
        setError(`El enlace "?store=${uniqueSlug}" ya está ocupado por otra tienda. Elegí otro nombre de enlace.`);
        return;
      }
      let counter = 2;
      while (stores.some((s) => s.slug === `${desiredSlug}-${counter}`)) {
        counter += 1;
      }
      uniqueSlug = `${desiredSlug}-${counter}`;
    }

    setCreating(true);
    try {
      const idToken = await user.getIdToken();
      type CreateStoreResponse = {
        uid?: string;
        email?: string;
        name?: string;
        whatsapp?: string;
        slug?: string;
        storeId?: string;
        message?: string;
        error?: string;
      };
      let data: CreateStoreResponse | null = null;
      let shouldFallback = false;

      try {
        const res = await fetch('/api/admin/create-store', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            slug: uniqueSlug,
            email: email.trim(),
            whatsapp: whatsapp.trim(),
            tempPassword,
          }),
        });

        const rawText = await res.text();
        let parsed: CreateStoreResponse | null = null;
        try {
          parsed = rawText ? (JSON.parse(rawText) as CreateStoreResponse) : null;
        } catch {
          parsed = null;
        }

        if (parsed && (parsed.uid || parsed.error || parsed.message)) {
          if (!res.ok || !parsed.uid || !parsed.storeId || !parsed.slug) {
            throw new Error(parsed.message || 'No se pudo procesar la creación en el servidor.');
          }
          data = parsed;
        } else if (res.status === 404 || !parsed) {
          shouldFallback = true;
        } else {
          throw new Error('No se pudo procesar la creación en el servidor.');
        }
      } catch (fetchErr) {
        if (
          fetchErr instanceof Error &&
          !fetchErr.message.includes('Failed to fetch') &&
          !fetchErr.message.includes('NetworkError') &&
          !fetchErr.message.includes('Load failed')
        ) {
          throw fetchErr;
        }
        shouldFallback = true;
      }

      if (shouldFallback || !data) {
        data = await createStoreAccountFallback({
          name,
          slug: uniqueSlug,
          email,
          whatsapp,
          tempPassword,
        });
      }

      if (!data.uid) {
        throw new Error('No se pudo completar la creación de la cuenta del comercio.');
      }

      const finalSlug = uniqueSlug;
      let finalStoreId = finalSlug;
      if (stores.some((s) => s.id === finalStoreId)) {
        finalStoreId = `${finalSlug}-${Math.random().toString(16).slice(2, 6)}`;
      }

      const storePath = `stores/${finalStoreId}`;
      try {
        await setDoc(doc(db, 'stores', finalStoreId), {
          id: finalStoreId,
          slug: finalSlug,
          name: data.name || name.trim(),
          description: 'Catálogo online y pedidos por WhatsApp.',
          whatsapp: data.whatsapp || whatsapp.replace(/[^\d]/g, ''),
          address: '',
          hours: '',
          bannerUrl: '',
          logoUrl: '',
          appIconUrl: '',
          accentColor: '#0F172A',
          backgroundColor: '#FAFAFA',
          backgroundTexture: 'none',
          backgroundImageUrl: '',
          isActive: true,
          ownerUid: data.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.CREATE, storePath);
      }

      const accountPath = `storeAccounts/${finalStoreId}`;
      try {
        await setDoc(doc(db, 'storeAccounts', finalStoreId), {
          storeId: finalStoreId,
          ownerUid: data.uid,
          ownerEmail: data.email || email.trim().toLowerCase(),
          createdAt: serverTimestamp(),
        });
      } catch (accErr) {
        handleFirestoreError(accErr, OperationType.CREATE, accountPath);
      }

      const defaultCatId = 'general';
      const catPath = `stores/${finalStoreId}/categories/${defaultCatId}`;
      try {
        await setDoc(doc(db, 'stores', finalStoreId, 'categories', defaultCatId), {
          id: defaultCatId,
          storeId: finalStoreId,
          ownerUid: data.uid,
          name: 'General',
          description: 'Productos principales del catálogo.',
          order: 1,
          isAvailable: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (catErr) {
        handleFirestoreError(catErr, OperationType.CREATE, catPath);
      }

      const nowIso = new Date().toISOString();
      const createdStore: Store = {
        id: finalStoreId,
        slug: finalSlug,
        name: data.name || name.trim(),
        description: 'Catálogo online y pedidos por WhatsApp.',
        whatsapp: data.whatsapp || whatsapp.replace(/[^\d]/g, ''),
        address: '',
        hours: '',
        bannerUrl: '',
        logoUrl: '',
        appIconUrl: '',
        accentColor: '#0F172A',
        backgroundColor: '#FAFAFA',
        backgroundTexture: 'none',
        backgroundImageUrl: '',
        isActive: true,
        ownerUid: data.uid,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setStores((prev) =>
        sortStores([createdStore, ...prev.filter((s) => s.id !== finalStoreId)])
      );
      setAccountsMap((prev) => ({
        ...prev,
        [finalStoreId]: {
          storeId: finalStoreId,
          ownerUid: data.uid!,
          ownerEmail: data.email || email.trim().toLowerCase(),
          createdAt: nowIso,
        },
      }));

      setSuccessMsg(
        `Comercio "${data.name}" creado correctamente (?store=${finalSlug}). El titular ya puede ingresar con ${data.email}.`
      );
      setName('');
      setCustomSlug('');
      setSlugTouched(false);
      setEmail('');
      setWhatsapp('');
      setTempPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al crear comercio.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (store: Store) => {
    const path = `stores/${store.id}`;
    const nextActive = !store.isActive;
    setStores((prev) =>
      prev.map((s) => (s.id === store.id ? { ...s, isActive: nextActive } : s))
    );
    try {
      await updateDoc(doc(db, 'stores', store.id), {
        isActive: nextActive,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setStores((prev) =>
        prev.map((s) => (s.id === store.id ? { ...s, isActive: store.isActive } : s))
      );
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleCopyUrl = async (slug: string) => {
    const url = `${window.location.origin}/?store=${encodeURIComponent(slug)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const openEditSlugModal = (store: Store) => {
    setEditingSlugStore(store);
    setEditSlugValue(store.slug);
    setEditSlugError(null);
  };

  const handleSaveEditedSlug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlugStore) return;
    const clean = createSlugFromName(editSlugValue);
    if (clean.length < 2 || clean.length > 80 || !/^[a-z0-9\-]+$/.test(clean)) {
      setEditSlugError('El enlace debe tener al menos 2 caracteres (solo letras minúsculas, números y guiones).');
      return;
    }
    const conflict = stores.find((s) => s.slug === clean && s.id !== editingSlugStore.id);
    if (conflict) {
      setEditSlugError(`Ese enlace ya pertenece al comercio "${conflict.name}".`);
      return;
    }
    setSavingSlug(true);
    setEditSlugError(null);
    const path = `stores/${editingSlugStore.id}`;
    try {
      await updateDoc(doc(db, 'stores', editingSlugStore.id), {
        slug: clean,
        updatedAt: serverTimestamp(),
      });
      const editedId = editingSlugStore.id;
      setStores((prev) =>
        prev.map((s) => (s.id === editedId ? { ...s, slug: clean } : s))
      );
      setEditingSlugStore(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setSavingSlug(false);
    }
  };

  const handleSaveCloudinary = async (e: React.FormEvent) => {
    e.preventDefault();
    setCloudinaryMsg(null);
    setCloudinaryErr(null);

    const cleanCloud = cloudName.trim();
    const cleanPreset = uploadPreset.trim();

    if (!/^[a-zA-Z0-9_\-]+$/.test(cleanCloud) || cleanCloud.length > 100) {
      setCloudinaryErr('El Cloud Name solo puede contener letras, números, guiones y guiones bajos.');
      return;
    }
    if (cleanPreset.length < 1 || cleanPreset.length > 100) {
      setCloudinaryErr('Ingresá el nombre del Upload Preset (modo Unsigned) de Cloudinary.');
      return;
    }

    setSavingCloudinary(true);
    const path = 'platformConfig/cloudinary';
    try {
      await setDoc(doc(db, 'platformConfig', 'cloudinary'), {
        id: 'cloudinary',
        cloudName: cleanCloud,
        uploadPreset: cleanPreset,
        updatedAt: serverTimestamp(),
      });
      setCloudinaryMsg('Configuración de Cloudinary guardada. Todos los comercios ya pueden subir imágenes desde su dispositivo.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setSavingCloudinary(false);
    }
  };

  const filteredStores = stores.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const ownerEmail = accountsMap[s.id]?.ownerEmail || '';
    return (
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      ownerEmail.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={onBackToDirectory}
              className="font-display text-base font-bold tracking-tight text-zinc-900 whitespace-nowrap cursor-pointer"
            >
              Panel maestro NEXO+
            </button>
            <span className="hidden md:inline text-xs text-zinc-500 truncate">
              Sesión activa para <strong className="font-medium text-zinc-800">{user.email}</strong>.
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onBackToDirectory}
              className="hidden sm:inline-flex rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 whitespace-nowrap cursor-pointer"
            >
              Ver directorio
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 whitespace-nowrap cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {!user.emailVerified && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3.5 text-xs text-amber-950">
            <span>
              Tu correo aún no está verificado en Firebase Auth. Para operar sin restricciones de seguridad, verificá tu correo o ingresá con Google.
            </span>
            <button
              type="button"
              disabled={verificationSent}
              onClick={async () => {
                await sendEmailVerification(user);
                setVerificationSent(true);
              }}
              className="rounded-lg bg-amber-900 px-3 py-1.5 font-semibold text-white hover:bg-amber-800 cursor-pointer"
            >
              {verificationSent ? 'Enlace enviado' : 'Enviar verificación'}
            </button>
          </div>
        )}

        {/* Master Identity Banner */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">
                  Sesión activa para {user.email}.
                </p>
                <h1 className="mt-0.5 font-display text-xl font-bold tracking-tight text-zinc-900">
                  Administrador maestro identificado
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-600">
                  Desde aquí podrás dar de alta comercios. La creación se procesará en el servidor y cada tienda tendrá su propio acceso.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 border-t border-zinc-100 pt-3 sm:border-t-0 sm:pt-0">
              <div>
                <p className="text-[11px] font-medium text-zinc-500">Comercios totales</p>
                <p className="font-mono text-xl font-bold text-zinc-900 tabular-nums">
                  {stores.length}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-zinc-500">Activos</p>
                <p className="font-mono text-xl font-bold text-emerald-700 tabular-nums">
                  {stores.filter((s) => s.isActive).length}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          {/* Left Column: Create Store Account Form */}
          <section className="lg:col-span-5">
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <h2 className="font-display text-lg font-bold text-zinc-900">
                Crear cuenta de comercio
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                Completá los datos para crear la cuenta y su ficha inicial.
              </p>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleCreateStore} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-800">
                    Nombre del comercio
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setName(val);
                      if (!slugTouched) {
                        setCustomSlug(val.trim() ? createSlugFromName(val) : '');
                      }
                    }}
                    placeholder="Ej.: Tienda Demo"
                    className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-800">
                    Enlace de la tienda (URL)
                  </label>
                  <div className="mt-1.5 flex items-center overflow-hidden rounded-lg border border-zinc-300 bg-white focus-within:border-zinc-900">
                    <span className="border-r border-zinc-200 bg-zinc-50 px-2.5 py-2.5 font-mono text-xs text-zinc-500 whitespace-nowrap">
                      /?store=
                    </span>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={80}
                      value={customSlug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setCustomSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9\-]/g, '-')
                            .replace(/-+/g, '-')
                        );
                      }}
                      placeholder="tienda-demo"
                      className="w-full px-3 py-2.5 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-800">
                    Correo de acceso
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="comercio@correo.com"
                    className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-800">
                    WhatsApp del comercio
                  </label>
                  <input
                    type="tel"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="549376..."
                    className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 font-mono text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-800">
                    Contraseña temporal (mínimo 8 caracteres)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={creating}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>Crear cuenta de comercio</span>
                </button>
              </form>
            </div>

            {/* Cloudinary Platform Configuration */}
            <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-700">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-zinc-900">
                    Configuración de Cloudinary
                  </h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">
                    Habilitá la subida de fotos desde el dispositivo (productos, portadas, logos e íconos) para todos los comercios.
                  </p>
                </div>
              </div>

              {cloudinaryErr && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>{cloudinaryErr}</span>
                </div>
              )}

              {cloudinaryMsg && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <span>{cloudinaryMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveCloudinary} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-800">
                    Cloud Name
                  </label>
                  <input
                    type="text"
                    required
                    value={cloudName}
                    onChange={(e) => setCloudName(e.target.value)}
                    placeholder="Ej.: mi-cloud-name"
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-800">
                    Upload Preset (Unsigned)
                  </label>
                  <input
                    type="text"
                    required
                    value={uploadPreset}
                    onChange={(e) => setUploadPreset(e.target.value)}
                    placeholder="Ej.: nexo_unsigned"
                    className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    En Cloudinary: Settings → Upload → Add upload preset → Signing Mode: <strong>Unsigned</strong>.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={savingCloudinary}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-60 cursor-pointer"
                >
                  {savingCloudinary && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Guardar configuración de imágenes</span>
                </button>
              </form>
            </div>
          </section>

          {/* Right Column: Registered Stores Directory */}
          <section className="lg:col-span-7">
            <div className="rounded-xl border border-zinc-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
                <div>
                  <h2 className="font-display text-base font-bold text-zinc-900">
                    Comercios registrados
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Administrá visibilidad, enlaces directos y catálogos.
                  </p>
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar comercio..."
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pr-3 pl-8 text-xs text-zinc-900 focus:border-zinc-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {loadingStores ? (
                <div className="space-y-3 p-5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-100" />
                  ))}
                </div>
              ) : filteredStores.length === 0 ? (
                <div className="p-10 text-center">
                  <StoreIcon className="mx-auto h-8 w-8 text-zinc-300" />
                  <p className="mt-2 font-display text-sm font-semibold text-zinc-900">
                    Todavía no hay comercios registrados
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Usá el formulario de la izquierda para dar de alta el primer comercio.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {filteredStores.map((store) => {
                    const ownerEmail = accountsMap[store.id]?.ownerEmail || 'Cuenta vinculada';
                    return (
                      <div
                        key={store.id}
                        className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between hover:bg-zinc-50/70 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span
                              className={
                                store.isActive
                                  ? 'font-medium text-emerald-700'
                                  : 'font-medium text-amber-700'
                              }
                            >
                              {store.isActive ? 'Activa' : 'Pausada'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono truncate">{store.whatsapp}</span>
                          </div>
                          <h3 className="mt-0.5 truncate font-display text-sm font-semibold text-zinc-900">
                            {store.name}
                          </h3>
                          <p className="truncate text-xs text-zinc-500">
                            <span>{ownerEmail}</span>
                            <span aria-hidden="true"> · </span>
                            <span className="font-mono text-zinc-700">?store={store.slug}</span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(store)}
                            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                          >
                            {store.isActive ? 'Pausar' : 'Activar'}
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditSlugModal(store)}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                            title="Modificar URL de la tienda"
                          >
                            <Link2 className="h-3 w-3" />
                            <span>Editar URL</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyUrl(store.slug)}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                            title="Copiar enlace directo de la tienda"
                          >
                            <Copy className="h-3 w-3" />
                            <span>{copiedSlug === store.slug ? 'Copiado' : 'Enlace'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenStorefront(store.slug)}
                            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Ver</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onManageStore(store)}
                            className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
                          >
                            <Settings2 className="h-3 w-3" />
                            <span>Gestionar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {editingSlugStore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <h2 className="font-display text-base font-bold text-zinc-900">
                  Modificar enlace de {editingSlugStore.name}
                </h2>
                <p className="text-xs text-zinc-500">
                  Personalizá la URL pública sin afectar tus productos ni categorías.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSlugStore(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedSlug} className="mt-4 space-y-4">
              {editSlugError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>{editSlugError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-800">
                  Nuevo identificador de enlace
                </label>
                <div className="mt-1.5 flex items-center overflow-hidden rounded-lg border border-zinc-300 bg-white focus-within:border-zinc-900">
                  <span className="border-r border-zinc-200 bg-zinc-50 px-2.5 py-2.5 font-mono text-xs text-zinc-500 whitespace-nowrap">
                    /?store=
                  </span>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={editSlugValue}
                    onChange={(e) => {
                      setEditSlugError(null);
                      setEditSlugValue(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9\-]/g, '-')
                          .replace(/-+/g, '-')
                      );
                    }}
                    placeholder="tienda-demo"
                    className="w-full px-3 py-2.5 font-mono text-xs text-zinc-900 focus:outline-none"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  Vista previa: <span className="font-mono text-zinc-800">{window.location.origin}/?store={createSlugFromName(editSlugValue || 'tienda')}</span>
                </p>
              </div>

              <div className="flex justify-end gap-2.5 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingSlugStore(null)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSlug}
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 cursor-pointer"
                >
                  {savingSlug && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Guardar enlace</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
