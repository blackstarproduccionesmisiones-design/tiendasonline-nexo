import { getFirebaseConfig } from '../_firebase';

interface FirestoreFieldVal {
  stringValue?: string;
  booleanValue?: boolean;
}

function toCloudinarySizedIcon(url: string, size: number): string {
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
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
  appIconUrl: string;
  logoUrl: string;
} | null> {
  const firebaseConfig = getFirebaseConfig();
  try {
    const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
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
            field: { fieldPath: 'slug' },
            op: 'EQUAL',
            value: { stringValue: slug },
          },
        },
        limit: 1,
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

    const fields = rows[0]?.document?.fields;
    if (!fields) return null;

    return {
      name: fields.name?.stringValue || 'Tienda NEXO+',
      description:
        fields.description?.stringValue || 'Catálogo online y pedidos por WhatsApp.',
      accentColor: fields.accentColor?.stringValue || '#0F172A',
      appIconUrl: fields.appIconUrl?.stringValue || '',
      logoUrl: fields.logoUrl?.stringValue || '',
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathPart = url.pathname.split('/').pop() || '';
  const rawSlug = decodeURIComponent(pathPart)
    .replace(/[^a-z0-9\-]/gi, '')
    .toLowerCase();
  const store = rawSlug ? await fetchStoreForManifest(rawSlug) : null;

  const qName = url.searchParams.get('name');
  const qIcon = url.searchParams.get('icon');
  const qTheme = url.searchParams.get('theme');

  const fallbackName =
    qName && qName.trim() ? qName.trim().slice(0, 60) : 'NEXO+ Tienda';
  const fallbackIcon =
    qIcon && qIcon.startsWith('http') ? qIcon.trim() : '';
  const fallbackTheme =
    qTheme && /^#[0-9a-fA-F]{6}$/.test(qTheme) ? qTheme : '#0F172A';

  const name = store?.name || fallbackName;
  const shortName = name.slice(0, 12).trim() || 'Tienda';
  const description = store?.description || 'Catálogo digital y pedidos por WhatsApp.';
  const themeColor = store?.accentColor || fallbackTheme;
  const rawIcon = store?.appIconUrl || store?.logoUrl || fallbackIcon;

  const icons = rawIcon
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

  return new Response(
    JSON.stringify({
      id: startUrl,
      name,
      short_name: shortName,
      description,
      start_url: startUrl,
      scope: '/',
      display: 'standalone',
      theme_color: themeColor,
      background_color: '#FAFAFA',
      icons,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    }
  );
}
