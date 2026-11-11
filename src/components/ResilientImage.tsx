import React, { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

interface ResilientImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  aspectClass?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = 'h-full w-full object-cover',
  fallbackLabel,
  aspectClass = '',
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-zinc-100 via-zinc-50 to-zinc-200/80 text-zinc-400 select-none ${aspectClass} ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageIcon className="h-7 w-7 stroke-[1.5]" />
        {fallbackLabel && (
          <span className="mt-1.5 max-w-[80%] truncate px-2 text-[11px] font-medium text-zinc-500">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
      loading="lazy"
    />
  );
};
