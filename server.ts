import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();

interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig: FirebaseAppletConfig = JSON.parse(
  fs.readFileSync(configPath, 'utf-8')
);

const MASTER_ADMIN_EMAILS = new Set([
  'nexodigitalposadas@gmail.com',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

interface VerifiedTokenUser {
  localId: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
}

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedTokenUser | null> {
  if (!idToken || !firebaseConfig.apiKey) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      users?: Array<{
        localId: string;
        email?: string;
        emailVerified?: boolean;
        displayName?: string;
      }>;
    };
    const user = data.users?.[0];
    if (!user?.localId || !user.email) return null;
    return {
      localId: user.localId,
      email: user.email.toLowerCase(),
      emailVerified: Boolean(user.emailVerified),
      displayName: user.displayName,
    };
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
}

function slugifyStoreName(input: string): string {
  const base = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'tienda';
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

interface FirestoreFieldVal {
  stringValue?: string;
  booleanValue?: boolean;
}

async function fetchStoreForManifest(slug: string): Promise<{
  name: string;
  description: string;
  accentColor: string;
  appIconUrl: string;
  logoUrl: string;
} | null> {
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
            fields.description?.stringValue ||
            'Catálogo online y pedidos por WhatsApp.',
          accentColor: fields.accentColor?.stringValue || '#0F172A',
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
        fields.description?.stringValue ||
        'Catálogo online y pedidos por WhatsApp.',
      accentColor: fields.accentColor?.stringValue || '#0F172A',
      appIconUrl: fields.appIconUrl?.stringValue || '',
      logoUrl: fields.logoUrl?.stringValue || '',
    };
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, projectId: firebaseConfig.projectId });
  });

  app.get('/api/cloudinary/status', (_req: Request, res: Response) => {
    const cloudName =
      process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
      process.env.NOMBRE_DE_LA_NUBE_CLOUDINARY?.trim() ||
      process.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() ||
      '';
    const uploadPreset =
      process.env.CLOUDINARY_UPLOAD_PRESET?.trim() ||
      process.env.PREAJUSTE_DE_SUBIDA_CLOUDINARY?.trim() ||
      process.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() ||
      '';
    const apiKey =
      process.env.CLOUDINARY_API_KEY?.trim() ||
      process.env.CLAVE_API_DE_CLOUDINARY?.trim() ||
      '';
    const apiSecret =
      process.env.CLOUDINARY_API_SECRET?.trim() ||
      process.env.SECRETO_API_DE_CLOUDINARY?.trim() ||
      '';

    const isSigned = Boolean(cloudName && apiKey && apiSecret);
    const isUnsigned = Boolean(cloudName && uploadPreset);

    res.json({
      configured: isSigned || isUnsigned,
      mode: isSigned ? 'signed' : isUnsigned ? 'unsigned' : 'none',
    });
  });

  app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    const user = await verifyFirebaseIdToken(token);
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Sesión inválida o expirada.' });
      return;
    }

    const cloudName =
      process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
      process.env.NOMBRE_DE_LA_NUBE_CLOUDINARY?.trim() ||
      process.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() ||
      '';
    const uploadPreset =
      process.env.CLOUDINARY_UPLOAD_PRESET?.trim() ||
      process.env.PREAJUSTE_DE_SUBIDA_CLOUDINARY?.trim() ||
      process.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() ||
      '';
    const apiKey =
      process.env.CLOUDINARY_API_KEY?.trim() ||
      process.env.CLAVE_API_DE_CLOUDINARY?.trim() ||
      '';
    const apiSecret =
      process.env.CLOUDINARY_API_SECRET?.trim() ||
      process.env.SECRETO_API_DE_CLOUDINARY?.trim() ||
      '';

    if (!cloudName || (!uploadPreset && !(apiKey && apiSecret))) {
      res.status(503).json({
        error: 'CLOUDINARY_NOT_CONFIGURED',
        message:
          'Cloudinary no está configurado en el servidor. Configurá CLOUDINARY_CLOUD_NAME y CLOUDINARY_UPLOAD_PRESET (o API Key/Secret) en Secrets, o guardalos en Panel maestro NEXO+.',
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'NO_FILE', message: 'No se recibió ningún archivo de imagen.' });
      return;
    }

    const rawFolder = typeof req.body?.folder === 'string' ? req.body.folder : 'catalogos';
    const safeFolder = rawFolder.replace(/[^a-zA-Z0-9_\-/]/g, '').slice(0, 80) || 'catalogos';
    const fullFolder = `nexo-tiendas/${safeFolder}`;

    try {
      const base64 = req.file.buffer.toString('base64');
      const dataUri = `data:${req.file.mimetype};base64,${base64}`;
      const form = new URLSearchParams();
      form.append('file', dataUri);
      form.append('folder', fullFolder);

      if (apiKey && apiSecret) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const paramsToSign = `folder=${fullFolder}&timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');
        form.append('api_key', apiKey);
        form.append('timestamp', timestamp);
        form.append('signature', signature);
      } else {
        form.append('upload_preset', uploadPreset);
      }

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        }
      );

      const cloudData = (await cloudRes.json()) as {
        secure_url?: string;
        public_id?: string;
        width?: number;
        height?: number;
        error?: { message?: string };
      };

      if (!cloudRes.ok || !cloudData.secure_url) {
        res.status(502).json({
          error: 'CLOUDINARY_UPLOAD_FAILED',
          message: cloudData.error?.message || 'Error al subir la imagen a Cloudinary.',
        });
        return;
      }

      res.json({
        secureUrl: cloudData.secure_url,
        publicId: cloudData.public_id || '',
        width: cloudData.width || null,
        height: cloudData.height || null,
      });
    } catch (err) {
      res.status(500).json({
        error: 'UPLOAD_ERROR',
        message: err instanceof Error ? err.message : 'Error interno al procesar la imagen.',
      });
    }
  });

  app.post('/api/admin/create-store', async (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    const caller = await verifyFirebaseIdToken(token);

    if (!caller) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Debés iniciar sesión para continuar.' });
      return;
    }

    if (!MASTER_ADMIN_EMAILS.has(caller.email) || !caller.emailVerified) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message:
          'Solo el administrador maestro verificado (nexodigitalposadas@gmail.com) puede dar de alta comercios.',
      });
      return;
    }

    const body = (req.body || {}) as {
      name?: string;
      slug?: string;
      email?: string;
      whatsapp?: string;
      tempPassword?: string;
    };

    const name = (body.name || '').trim();
    const requestedSlug = body.slug ? slugifyStoreName(body.slug) : '';
    const email = (body.email || '').trim().toLowerCase();
    const whatsapp = (body.whatsapp || '').replace(/[^\d]/g, '').trim();
    const tempPassword = body.tempPassword || '';

    if (name.length < 2 || name.length > 100) {
      res.status(400).json({ error: 'INVALID_NAME', message: 'El nombre del comercio debe tener entre 2 y 100 caracteres.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'INVALID_EMAIL', message: 'Ingresá un correo electrónico válido para el comercio.' });
      return;
    }
    if (whatsapp.length < 6 || whatsapp.length > 20) {
      res.status(400).json({ error: 'INVALID_WHATSAPP', message: 'Ingresá un número de WhatsApp válido (ej. 5493764000000).' });
      return;
    }
    if (tempPassword.length < 8) {
      res.status(400).json({ error: 'WEAK_PASSWORD', message: 'La contraseña temporal debe tener al menos 8 caracteres.' });
      return;
    }

    try {
      const signUpRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password: tempPassword,
            returnSecureToken: true,
          }),
        }
      );

      const signUpData = (await signUpRes.json()) as {
        localId?: string;
        idToken?: string;
        email?: string;
        error?: { message?: string };
      };

      if (!signUpRes.ok || !signUpData.localId) {
        const code = signUpData.error?.message || 'AUTH_CREATE_FAILED';
        if (code.includes('EMAIL_EXISTS')) {
          res.status(409).json({
            error: 'EMAIL_EXISTS',
            message: 'Ya existe una cuenta en Firebase Authentication con ese correo electrónico.',
          });
          return;
        }
        if (code.includes('OPERATION_NOT_ALLOWED')) {
          res.status(400).json({
            error: 'OPERATION_NOT_ALLOWED',
            message:
              'Habilitá el proveedor "Correo electrónico/contraseña" en Firebase Console > Authentication > Sign-in method para el proyecto nexo-tiendas-online.',
          });
          return;
        }
        res.status(400).json({
          error: code,
          message: `No se pudo crear la cuenta del comercio (${code}).`,
        });
        return;
      }

      if (signUpData.idToken) {
        await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idToken: signUpData.idToken,
              displayName: name,
              returnSecureToken: false,
            }),
          }
        ).catch(() => undefined);
      }

      const slug = requestedSlug.length >= 2 ? requestedSlug : slugifyStoreName(name);
      res.json({
        uid: signUpData.localId,
        email,
        name,
        whatsapp,
        slug,
        storeId: slug,
      });
    } catch (err) {
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: err instanceof Error ? err.message : 'Error interno al crear el comercio.',
      });
    }
  });

  app.get('/api/manifest/:slug', async (req: Request, res: Response) => {
    const rawSlug = String(req.params.slug || '').replace(/[^a-z0-9\-]/gi, '').toLowerCase();
    const store = rawSlug ? await fetchStoreForManifest(rawSlug) : null;

    const fallbackName = typeof req.query.name === 'string' && req.query.name.trim()
      ? req.query.name.trim().slice(0, 60)
      : 'NEXO+ Tienda';
    const fallbackIcon = typeof req.query.icon === 'string' && req.query.icon.startsWith('http')
      ? req.query.icon.trim()
      : '';
    const fallbackTheme = typeof req.query.theme === 'string' && /^#[0-9a-fA-F]{6}$/.test(req.query.theme)
      ? req.query.theme
      : '#0F172A';

    const name = store?.name || fallbackName;
    const shortName = name.slice(0, 12).trim() || 'Tienda';
    const description = store?.description || 'Catálogo digital y pedidos por WhatsApp.';
    const themeColor = store?.accentColor || fallbackTheme;
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
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({
      id: startUrl,
      name,
      short_name: shortName,
      description,
      start_url: startUrl,
      scope: '/',
      display: 'standalone',
      prefer_related_applications: false,
      theme_color: themeColor,
      background_color: '#FAFAFA',
      icons,
    });
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'API_NOT_FOUND',
      message: 'Endpoint de API no encontrado.',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`NEXO+ server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
