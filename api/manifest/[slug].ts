import type { IncomingMessage, ServerResponse } from 'node:http';
import { getFirebaseConfig } from '../_firebase.js';

interface FirestoreFieldVal {
  stringValue?: string;
  booleanValue?: boolean;
}

function isCloudinaryUploadUrl(url: string): boolean {
  return url.includes('res.cloudinary.com') && url.includes('/image/upload/');
}

function toCloudinarySizedIcon(url: string, size: number): string {
  if (!isCloudinaryUploadUrl(url)) {
    return url;
  }
  return url.replace(
    '/image/upload/',
    `/image/upload/w_${size},h_${size},c_fill,g_center,f_png/`
  );
}

async function fetchStoreForManifest(slug: string): Promise<{
  name: string;
  description: string;
  accentColor: string;
  backgroundColor: string;
  appIconUrl: string;
  logoUrl: string;
} | null> {
  const firebaseConfig = getFirebaseConfig();
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';

  try {
    const docUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseConfig.projectId
    )}/databases/${encodeURIComponent(dbId)}/documents/stores/${encodeURIComponent(
      slug
    )}?key=${encodeURIComponent(firebaseConfig.apiKey)}`;

    const docRes = await fetch(docUrl);
    if (docRes.ok) {
      const docData = (await docRes.json()) as { fields?: Record<string, FirestoreFieldVal> };
      const fields = docData.fields;
      if (fields && fields.isActive?.booleanValue !== false) {
        return {
          name: fields.name?.stringValue || 'Tienda NEXO+',
          description:
            fields.description?.stringValue || 'Catálogo online y pedidos por WhatsApp.',
          accentColor: fields.accentColor?.stringValue || '#0F172A',
          backgroundColor: fields.backgroundColor?.stringValue || '#FAFAFA',
          appIconUrl: fields.appIconUrl?.stringValue || '',
          logoUrl: fields.logoUrl?.stringValue || '',
        };
      }
    }
  } catch {
    // Fallback to query below
  }

  try {
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      firebaseConfig.projectId
    )}/databases/${encodeURIComponent(dbId)}/documents:runQuery?key=${encodeURIComponent(
      firebaseConfig.apiKey
    )}`;

    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'stores' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'isActive' },
            op: 'EQUAL',
            value: { booleanValue: true },
          },
        },
        limit: 100,
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryBody),
    });

    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      document?: { fields?: Record<string, FirestoreFieldVal> };
    }>;

    const match = rows.find((r) => r.document?.fields?.slug?.stringValue === slug);
    const fields = match?.document?.fields;
    if (!fields) return null;

    return {
      name: fields.name?.stringValue || 'Tienda NEXO+',
      description:
        fields.description?.stringValue || 'Catálogo online y pedidos por WhatsApp.',
      accentColor: fields.accentColor?.stringValue || '#0F172A',
      backgroundColor: fields.backgroundColor?.stringValue || '#FAFAFA',
      appIconUrl: fields.appIconUrl?.stringValue || '',
      logoUrl: fields.logoUrl?.stringValue || '',
    };
  } catch {
    return null;
  }
}

export default async function handler(
  req: IncomingMessage & { query?: Record<string, string | string[] | undefined> },
  res: ServerResponse
): Promise<void> {
  const url = new URL(req.url || '/', 'https://nexo.local');
  const querySlug = typeof req.query?.slug === 'string' ? req.query.slug : '';
  const pathPart = querySlug || url.pathname.split('/').pop() || '';
  const rawSlug = decodeURIComponent(pathPart)
    .replace(/[^a-z0-9\-]/gi, '')
    .toLowerCase();

  const store = rawSlug ? await fetchStoreForManifest(rawSlug) : null;

  const qName = url.searchParams.get('name');
  const qIcon = url.searchParams.get('icon');
  const qTheme = url.searchParams.get('theme');
  const qBg = url.searchParams.get('bg');

  const fallbackName =
    qName && qName.trim() ? qName.trim().slice(0, 60) : 'NEXO+ Tienda';
  const fallbackIcon = qIcon && qIcon.startsWith('http') ? qIcon.trim() : '';
  const fallbackTheme =
    qTheme && /^#[0-9a-fA-F]{6}$/.test(qTheme) ? qTheme : '#0F172A';
  const fallbackBg =
    qBg && /^#[0-9a-fA-F]{6}$/.test(qBg) ? qBg : '#FAFAFA';

  const name = store?.name || fallbackName;
  const shortName = name.slice(0, 12).trim() || 'Tienda';
  const description = store?.description || 'Catálogo digital y pedidos por WhatsApp.';
  const themeColor = store?.accentColor || fallbackTheme;
  const backgroundColor = store?.backgroundColor || fallbackBg;
  const rawIcon = store?.appIconUrl || store?.logoUrl || fallbackIcon;
  const useCustomCloudinaryIcon = Boolean(rawIcon && isCloudinaryUploadUrl(rawIcon));

  const icons = useCustomCloudinaryIcon
    ? [
        {
          src: toCloudinarySizedIcon(rawIcon, 192),
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: toCloudinarySizedIcon(rawIcon, 512),
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: toCloudinarySizedIcon(rawIcon, 512),
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ]
    : [
        {
          src: '/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa-maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ];

  const startUrl = rawSlug ? `/?store=${encodeURIComponent(rawSlug)}` : '/';
  // Unique PWA identity per store so Android Chrome & mobile OS treat each store as a separate app
  const appId = rawSlug ? `/?store=${encodeURIComponent(rawSlug)}` : '/';

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(
    JSON.stringify({
      id: appId,
      name,
      short_name: shortName,
      description,
      start_url: startUrl,
      scope: '/',
      display: 'standalone',
      prefer_related_applications: false,
      theme_color: themeColor,
      background_color: backgroundColor,
      icons,
    })
  );
}
