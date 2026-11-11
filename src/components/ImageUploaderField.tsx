import React, { useRef, useState } from 'react';
import { Upload, Link2, Loader2, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { uploadImageToCloudinary } from '../lib/cloudinary';
import { ResilientImage } from './ResilientImage';

interface ImageUploaderFieldProps {
  label: string;
  helperText?: string;
  value: string;
  onChange: (url: string) => void;
  folder: string;
  squareSize?: number;
  previewAspect?: 'square' | 'wide' | 'product';
}

export const ImageUploaderField: React.FC<ImageUploaderFieldProps> = ({
  label,
  helperText,
  value,
  onChange,
  folder,
  squareSize,
  previewAspect = 'product',
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadSuccess(false);
    setUploading(true);

    try {
      const secureUrl = await uploadImageToCloudinary(
        file,
        folder,
        squareSize ? { squareSize } : undefined
      );
      onChange(secureUrl);
      setUploadSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir la imagen.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const previewFrameClass =
    previewAspect === 'wide'
      ? 'h-32 w-full'
      : previewAspect === 'square'
        ? 'h-24 w-24'
        : 'h-32 w-44';

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-xs font-semibold text-zinc-800">{label}</label>
        <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'upload'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Upload className="h-3 w-3" />
            <span>Subir foto</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'url'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Link2 className="h-3 w-3" />
            <span>Pegar URL</span>
          </button>
        </div>
      </div>

      {helperText && <p className="text-xs text-zinc-500">{helperText}</p>}

      {mode === 'upload' ? (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 transition-colors cursor-pointer"
          >
            {uploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-600" />
                <span>Subiendo a Cloudinary...</span>
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5 text-zinc-600" />
                <span>Elegir imagen del dispositivo</span>
              </>
            )}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setUploadSuccess(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Quitar</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setError(null);
            }}
            placeholder="https://res.cloudinary.com/..."
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 cursor-pointer"
              title="Limpiar URL"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {uploadSuccess && !error && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Imagen alojada en Cloudinary</span>
        </div>
      )}

      {value && (
        <div
          className={`overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 ${previewFrameClass}`}
        >
          <ResilientImage
            src={value}
            alt={label}
            className="h-full w-full object-cover"
            fallbackLabel="Vista previa"
          />
        </div>
      )}
    </div>
  );
};
