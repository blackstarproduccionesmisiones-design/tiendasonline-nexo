import React, { useState } from 'react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, AlertCircle } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';

interface AuthViewProps {
  onBack: () => void;
}

function mapAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Correo o contraseña incorrectos.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Demasiados intentos fallidos. Esperá unos minutos e intentá nuevamente.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Cerraste la ventana de Google antes de completar el ingreso.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Habilitá el proveedor Correo/Contraseña en Firebase Console > Authentication > Sign-in method.';
  }
  return err instanceof Error ? err.message : 'No se pudo iniciar sesión.';
}

export const AuthView: React.FC<AuthViewProps> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setInfoMessage(null);
    setGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError('Ingresá tu correo electrónico primero para enviarte el enlace de recuperación.');
      return;
    }
    setError(null);
    setInfoMessage(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfoMessage('Te enviamos un correo para restablecer tu contraseña.');
    } catch (err) {
      setError(mapAuthError(err));
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] px-4 py-8 text-zinc-900 sm:px-6">
      <div className="mx-auto max-w-md">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Volver a tiendas</span>
        </button>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 sm:p-8">
          <div>
            <span className="font-display text-lg font-bold tracking-tight text-zinc-900">
              NEXO+
            </span>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-zinc-900">
              Acceso al panel de gestión
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
              Ingresá con tu cuenta de comercio o con tu cuenta de administrador maestro.
            </p>
          </div>

          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
              {infoMessage}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-800">
                Correo de acceso
              </label>
              <div className="relative mt-1.5">
                <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="comercio@correo.com"
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pr-3 pl-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-zinc-800">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-900 cursor-pointer"
                >
                  ¿Olvidaste tu clave?
                </button>
              </div>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pr-10 pl-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  aria-label="Mostrar u ocultar contraseña"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Ingresar con correo</span>
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200" />
            <span className="text-[11px] font-medium text-zinc-400">O continuar como administrador</span>
            <div className="h-px flex-1 bg-zinc-200" />
          </div>

          <button
            type="button"
            disabled={googleLoading}
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-zinc-300 bg-white py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-zinc-700" />
            )}
            <span>Ingresar con Google</span>
          </button>
        </div>
      </div>
    </div>
  );
};
