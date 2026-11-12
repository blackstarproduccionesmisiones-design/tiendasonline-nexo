import { useEffect } from 'react';
import type { Store } from '../types';

export function useDynamicStoreManifest(store: Store | null, routeSlug?: string | null) {
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

    const effectiveSlug = store?.slug || routeSlug || null;

    if (!effectiveSlug) {
      document.title = 'NEXO+ Tiendas Online';
      if (manifestLink.getAttribute('href') !== '/manifest.webmanifest') {
        manifestLink.href = '/manifest.webmanifest';
      }
      if (appleIcon) appleIcon.href = '/apple-touch-icon.png';
      if (themeMeta) themeMeta.content = '#0F172A';
      if (appleTitle) appleTitle.content = 'NEXO+';
      return;
    }

    if (store) {
      document.title = `${store.name} · Catálogo Online`;
      const iconUrl = store.appIconUrl || store.logoUrl || '';
      if (appleIcon) {
        appleIcon.href = iconUrl || '/apple-touch-icon.png';
      }
      if (themeMeta) {
        themeMeta.content = store.accentColor || '#0F172A';
      }
      if (appleTitle) {
        appleTitle.content = store.name.slice(0, 12);
      }
    }

    const params = new URLSearchParams();
    if (store?.name) params.set('name', store.name);
    const iconUrl = store?.appIconUrl || store?.logoUrl || '';
    if (iconUrl && iconUrl.startsWith('http')) params.set('icon', iconUrl);
    if (store?.accentColor) params.set('theme', store.accentColor);
    if (store?.backgroundColor) params.set('bg', store.backgroundColor);

    const qs = params.toString();
    const baseManifestUrl = `/api/manifest/${encodeURIComponent(effectiveSlug)}`;
    const dynamicManifestUrl = `${baseManifestUrl}${qs ? `?${qs}` : ''}`;

    fetch(dynamicManifestUrl, { headers: { Accept: 'application/manifest+json, application/json' } })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          if (manifestLink && manifestLink.getAttribute('href') !== '/manifest.webmanifest') {
            manifestLink.href = '/manifest.webmanifest';
          }
          return;
        }
        const text = await res.text();
        const parsed = JSON.parse(text) as { start_url?: string; icons?: unknown[]; name?: string };
        if (cancelled || !parsed?.start_url || !Array.isArray(parsed.icons) || !manifestLink) {
          return;
        }
        const currentHref = manifestLink.getAttribute('href') || '';
        // If <head> bootstrap already set /api/manifest/<slug> and server returned valid icons, avoid churning href unnecessarily
        if (currentHref === baseManifestUrl && (!store || parsed.name === store.name)) {
          return;
        }
        if (currentHref !== dynamicManifestUrl) {
          manifestLink.href = dynamicManifestUrl;
        }
      })
      .catch(() => {
        if (!cancelled && manifestLink && manifestLink.getAttribute('href') !== '/manifest.webmanifest') {
          manifestLink.href = '/manifest.webmanifest';
        }
      });

    return () => {
      cancelled = true;
    };
  }, [store, routeSlug]);
}
