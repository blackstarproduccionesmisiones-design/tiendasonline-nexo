import { useEffect } from 'react';
import type { Store } from '../types';

export function useDynamicStoreManifest(store: Store | null) {
  useEffect(() => {
    let cancelled = false;
    const appleIcon = document.getElementById('link-apple-icon') as HTMLLinkElement | null;
    const themeMeta = document.getElementById('meta-theme-color') as HTMLMetaElement | null;
    const appleTitle = document.getElementById('meta-apple-title') as HTMLMetaElement | null;

    let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }

    if (!store) {
      document.title = 'NEXO+ Tiendas Online';
      manifestLink.href = '/manifest.webmanifest';
      if (appleIcon) appleIcon.href = '/apple-touch-icon.png';
      if (themeMeta) themeMeta.content = '#0F172A';
      if (appleTitle) appleTitle.content = 'NEXO+';
      return;
    }

    document.title = `${store.name} · Catálogo Online`;
    const iconUrl = store.appIconUrl || store.logoUrl || '';
    const params = new URLSearchParams();
    params.set('name', store.name);
    if (iconUrl && iconUrl.startsWith('http')) params.set('icon', iconUrl);
    if (store.accentColor) params.set('theme', store.accentColor);

    if (appleIcon) {
      appleIcon.href = iconUrl || '/apple-touch-icon.png';
    }
    if (themeMeta) {
      themeMeta.content = store.accentColor || '#0F172A';
    }
    if (appleTitle) {
      appleTitle.content = store.name.slice(0, 12);
    }

    const dynamicManifestUrl = `/api/manifest/${encodeURIComponent(store.slug)}?${params.toString()}`;

    // Verify dynamic manifest endpoint returns valid JSON before pointing <link rel="manifest"> to it
    // so static deployments never end up with a 404 manifest that blocks PWA installation.
    fetch(dynamicManifestUrl, { headers: { Accept: 'application/manifest+json, application/json' } })
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const text = await res.text();
        const parsed = JSON.parse(text) as { start_url?: string; icons?: unknown[] };
        if (!cancelled && parsed?.start_url && Array.isArray(parsed.icons) && manifestLink) {
          manifestLink.href = dynamicManifestUrl;
        }
      })
      .catch(() => {
        // Keep /manifest.webmanifest fallback intact
      });

    return () => {
      cancelled = true;
    };
  }, [store]);
}
