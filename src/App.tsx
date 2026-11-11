import React, { Component, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { AlertTriangle, Loader2, LogOut, Store as StoreIcon } from 'lucide-react';
import {
  auth,
  db,
  handleFirestoreError,
  isMasterAdminEmail,
} from './lib/firebase';
import { OperationType, type Category, type Product, type Store } from './types';
import { DEMO_CATEGORIES, DEMO_PRODUCTS, DEMO_STORE } from './data/demoStore';
import { useDynamicStoreManifest } from './hooks/useDynamicStoreManifest';
import { DirectoryView } from './components/DirectoryView';
import { StorefrontView } from './components/StorefrontView';
import { AuthView } from './components/AuthView';
import { MasterAdminPanel } from './components/MasterAdminPanel';
import { StoreAdminPanel } from './components/StoreAdminPanel';
import { OfflineIndicator } from './components/OfflineIndicator';

type AppRoute =
  | { view: 'directory' }
  | { view: 'storefront'; slug: string }
  | { view: 'auth' }
  | { view: 'master-admin' }
  | { view: 'store-admin'; storeId?: string };

interface ErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] p-6 text-zinc-900">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center">
            <AlertTriangle className="mx-auto h-9 w-9 text-amber-600" />
            <h1 className="mt-3 font-display text-lg font-bold">
              Ocurrió un inconveniente al cargar la vista
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
              Verificá tu conexión o los permisos de la cuenta activa e intentá nuevamente.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null });
                window.location.href = '/';
              }}
              className="mt-5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function getInitialSlugFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('store')?.trim();
  return slug || null;
}

function AppContent() {
  const [route, setRoute] = useState<AppRoute>(() => {
    const initialSlug = getInitialSlugFromUrl();
    return initialSlug
      ? { view: 'storefront', slug: initialSlug }
      : { view: 'directory' };
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // Public active stores list
  const [publicStores, setPublicStores] = useState<Store[]>([]);
  const [loadingPublicStores, setLoadingPublicStores] = useState(true);

  // Store owned by logged-in store user
  const [ownedStore, setOwnedStore] = useState<Store | null>(null);
  const [loadingOwnedStore, setLoadingOwnedStore] = useState(false);

  // Master admin managing a specific store
  const [managedStore, setManagedStore] = useState<Store | null>(null);

  // Active Storefront catalog data
  const [storeCategories, setStoreCategories] = useState<Category[]>([]);
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [loadingStoreCatalog, setLoadingStoreCatalog] = useState(false);

  const isMasterAdmin = useMemo(
    () => isMasterAdminEmail(currentUser?.email),
    [currentUser?.email]
  );

  // Sync URL query ?store=<slug>
  useEffect(() => {
    const onPopState = () => {
      const slug = getInitialSlugFromUrl();
      if (slug) {
        setRoute({ view: 'storefront', slug });
      } else {
        setRoute({ view: 'directory' });
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateToStorefront = (slug: string) => {
    const nextUrl = `/?store=${encodeURIComponent(slug)}`;
    window.history.pushState({}, '', nextUrl);
    setRoute({ view: 'storefront', slug });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToDirectory = () => {
    window.history.pushState({}, '', '/');
    setRoute({ view: 'directory' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthReady(true);

      if (user && isMasterAdminEmail(user.email) && user.emailVerified) {
        try {
          await setDoc(
            doc(db, 'admins', user.uid),
            {
              uid: user.uid,
              email: (user.email || '').toLowerCase(),
              role: 'master',
              createdAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch {
          // Non-fatal if rules check email directly
        }
      }

      if (user) {
        setRoute((prev) => {
          if (prev.view === 'auth') {
            return isMasterAdminEmail(user.email)
              ? { view: 'master-admin' }
              : { view: 'store-admin' };
          }
          return prev;
        });
      } else {
        setOwnedStore(null);
        setManagedStore(null);
        setRoute((prev) =>
          prev.view === 'master-admin' || prev.view === 'store-admin'
            ? { view: 'directory' }
            : prev
        );
      }
    });
    return () => unsub();
  }, []);

  // Load public active stores
  useEffect(() => {
    const q = query(collection(db, 'stores'), where('isActive', '==', true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPublicStores(snap.docs.map((d) => d.data() as Store));
        setLoadingPublicStores(false);
      },
      (err) => {
        setLoadingPublicStores(false);
        handleFirestoreError(err, OperationType.LIST, 'stores');
      }
    );
    return () => unsub();
  }, []);

  // Load store owned by current non-master user
  useEffect(() => {
    if (!authReady || !currentUser || isMasterAdmin) {
      setOwnedStore(null);
      setLoadingOwnedStore(false);
      return;
    }

    setLoadingOwnedStore(true);
    const q = query(
      collection(db, 'stores'),
      where('ownerUid', '==', currentUser.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const first = snap.docs[0]?.data() as Store | undefined;
        setOwnedStore(first || null);
        setLoadingOwnedStore(false);
      },
      (err) => {
        setLoadingOwnedStore(false);
        handleFirestoreError(err, OperationType.LIST, 'stores');
      }
    );
    return () => unsub();
  }, [authReady, currentUser, isMasterAdmin]);

  // Resolve active storefront object
  const activeStorefront: Store | null = useMemo(() => {
    if (route.view !== 'storefront') return null;
    if (route.slug === DEMO_STORE.slug) return DEMO_STORE;
    return publicStores.find((s) => s.slug === route.slug) || null;
  }, [route, publicStores]);

  // Dynamic PWA manifest for active storefront
  useDynamicStoreManifest(activeStorefront);

  // Load categories & products for active storefront
  useEffect(() => {
    if (route.view !== 'storefront') return;

    if (route.slug === DEMO_STORE.slug) {
      setStoreCategories(DEMO_CATEGORIES);
      setStoreProducts(DEMO_PRODUCTS);
      setLoadingStoreCatalog(false);
      return;
    }

    if (!activeStorefront) {
      setStoreCategories([]);
      setStoreProducts([]);
      return;
    }

    setLoadingStoreCatalog(true);
    const catPath = `stores/${activeStorefront.id}/categories`;
    const prodPath = `stores/${activeStorefront.id}/products`;

    const unsubCats = onSnapshot(
      query(collection(db, catPath), where('isAvailable', '==', true)),
      (snap) => {
        setStoreCategories(snap.docs.map((d) => d.data() as Category));
        setLoadingStoreCatalog(false);
      },
      (err) => {
        setLoadingStoreCatalog(false);
        handleFirestoreError(err, OperationType.LIST, catPath);
      }
    );

    const unsubProds = onSnapshot(
      query(collection(db, prodPath), where('isAvailable', '==', true)),
      (snap) => {
        setStoreProducts(snap.docs.map((d) => d.data() as Product));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, prodPath);
      }
    );

    return () => {
      unsubCats();
      unsubProds();
    };
  }, [route, activeStorefront]);

  // Keep managedStore fresh if updated
  useEffect(() => {
    if (!managedStore) return;
    const unsub = onSnapshot(
      doc(db, 'stores', managedStore.id),
      (snap) => {
        if (snap.exists()) {
          setManagedStore(snap.data() as Store);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `stores/${managedStore.id}`);
      }
    );
    return () => unsub();
  }, [managedStore?.id]);

  // Avoid unused import warning for serverTimestamp if needed later
  void serverTimestamp;

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (route.view === 'auth') {
    return <AuthView onBack={navigateToDirectory} />;
  }

  if (route.view === 'master-admin') {
    if (!currentUser || !isMasterAdmin) {
      return <AuthView onBack={navigateToDirectory} />;
    }
    return (
      <MasterAdminPanel
        user={currentUser}
        onOpenStorefront={navigateToStorefront}
        onManageStore={(store) => {
          setManagedStore(store);
          setRoute({ view: 'store-admin', storeId: store.id });
        }}
        onBackToDirectory={navigateToDirectory}
      />
    );
  }

  if (route.view === 'store-admin') {
    if (!currentUser) {
      return <AuthView onBack={navigateToDirectory} />;
    }

    const targetStore = isMasterAdmin ? managedStore : ownedStore;

    if (!isMasterAdmin && loadingOwnedStore) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      );
    }

    if (!targetStore) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] p-6">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center">
            <StoreIcon className="mx-auto h-9 w-9 text-zinc-300" />
            <h1 className="mt-3 font-display text-lg font-bold text-zinc-900">
              Sin comercio asignado
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
              No encontramos una tienda vinculada a <strong>{currentUser.email}</strong>. Solicitá el alta desde el Panel Maestro NEXO+.
            </p>
            <div className="mt-5 flex justify-center gap-2.5">
              <button
                type="button"
                onClick={navigateToDirectory}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
              >
                Ver tiendas
              </button>
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <StoreAdminPanel
        user={currentUser}
        store={targetStore}
        isMasterAdminView={isMasterAdmin}
        onBackToMaster={() => setRoute({ view: 'master-admin' })}
        onOpenStorefront={navigateToStorefront}
      />
    );
  }

  if (route.view === 'storefront') {
    if (!activeStorefront && loadingPublicStores) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      );
    }

    if (!activeStorefront) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] p-6">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center">
            <StoreIcon className="mx-auto h-9 w-9 text-zinc-300" />
            <h1 className="mt-3 font-display text-lg font-bold text-zinc-900">
              Tienda no encontrada o pausada
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
              El comercio solicitado no está disponible en este momento.
            </p>
            <button
              type="button"
              onClick={navigateToDirectory}
              className="mt-5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
            >
              Explorar comercios activos
            </button>
          </div>
        </div>
      );
    }

    const canManage =
      Boolean(currentUser) &&
      !activeStorefront.isDemo &&
      (isMasterAdmin || currentUser?.uid === activeStorefront.ownerUid);

    return (
      <StorefrontView
        store={activeStorefront}
        categories={storeCategories}
        products={storeProducts}
        loading={loadingStoreCatalog}
        onBackToDirectory={navigateToDirectory}
        onOpenAuth={() => setRoute({ view: 'auth' })}
        canManageStore={canManage}
        onOpenStoreAdmin={() => {
          if (isMasterAdmin) {
            setManagedStore(activeStorefront);
          }
          setRoute({ view: 'store-admin', storeId: activeStorefront.id });
        }}
      />
    );
  }

  return (
    <DirectoryView
      stores={publicStores}
      loading={loadingPublicStores}
      onSelectStore={navigateToStorefront}
      onOpenAuth={() => setRoute({ view: 'auth' })}
      currentUserEmail={currentUser?.email}
      isMasterAdmin={isMasterAdmin}
      onOpenDashboard={() => {
        if (isMasterAdmin) {
          setRoute({ view: 'master-admin' });
        } else {
          setRoute({ view: 'store-admin' });
        }
      }}
    />
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
      <OfflineIndicator />
    </AppErrorBoundary>
  );
}
