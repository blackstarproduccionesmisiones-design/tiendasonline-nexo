import React, { useState } from 'react';
import { Download, Share, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  storeName?: string;
  variant?: 'solid' | 'outline';
  accentColor?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  storeName,
  variant = 'outline',
  accentColor,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const label = storeName ? 'Instalar App' : 'Instalar NEXO+';

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuideModal(true);
  };

  const buttonClasses =
    variant === 'solid'
      ? 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-transform active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer'
      : 'inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer';

  const style =
    variant === 'solid'
      ? { backgroundColor: accentColor || '#0F172A' }
      : undefined;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={buttonClasses}
        style={style}
        title={isInstallable ? 'Instalar aplicación en este dispositivo' : 'Cómo instalar la app'}
      >
        <Download className="h-3.5 w-3.5" />
        <span>{label}</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-zinc-900">
                    Instalar {storeName || 'NEXO+'}
                  </h3>
                  <p className="text-xs text-zinc-500">Acceso directo en tu pantalla de inicio</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="mt-4 space-y-2.5 text-sm text-zinc-600">
                <p>En iPhone o iPad con Safari:</p>
                <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-zinc-700">
                  <li>
                    Tocá el botón <strong className="inline-flex items-center gap-1 font-semibold text-zinc-900"><Share className="h-3.5 w-3.5" /> Compartir</strong> en la barra de Safari.
                  </li>
                  <li>
                    Deslizá hacia abajo y elegí <strong className="font-semibold text-zinc-900">Agregar a inicio</strong>.
                  </li>
                  <li>Confirmá tocando <strong className="font-semibold text-zinc-900">Agregar</strong>.</li>
                </ol>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5 text-sm text-zinc-600">
                <p className="text-xs leading-relaxed text-zinc-700">
                  Para instalar esta tienda como aplicación en tu dispositivo:
                </p>
                <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-zinc-700">
                  <li>Abrí el menú del navegador (Chrome o Edge).</li>
                  <li>Seleccioná <strong className="font-semibold text-zinc-900">Instalar aplicación</strong> o <strong className="font-semibold text-zinc-900">Agregar a la pantalla principal</strong>.</li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-lg bg-zinc-900 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
