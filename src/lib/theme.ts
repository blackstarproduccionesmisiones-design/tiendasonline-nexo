import type React from 'react';
import type { BackgroundTexture } from '../types';

export interface BackgroundColorPreset {
  id: string;
  label: string;
  hex: string;
  tone: 'light' | 'dark';
}

export interface BackgroundTexturePreset {
  id: BackgroundTexture;
  label: string;
  description: string;
}

export const BACKGROUND_COLOR_PRESETS: BackgroundColorPreset[] = [
  { id: 'snow', label: 'Claro Nítido', hex: '#FAFAFA', tone: 'light' },
  { id: 'paper', label: 'Papel Cálido', hex: '#F4F1EA', tone: 'light' },
  { id: 'obsidian', label: 'Negro Obsidiana', hex: '#09090B', tone: 'dark' },
  { id: 'graphite', label: 'Grafito Oscuro', hex: '#18181B', tone: 'dark' },
  { id: 'midnight', label: 'Azul Noche', hex: '#0F172A', tone: 'dark' },
  { id: 'forest', label: 'Verde Bosque', hex: '#071A15', tone: 'dark' },
  { id: 'burgundy', label: 'Borgoña Oscuro', hex: '#1E0D14', tone: 'dark' },
];

export const BACKGROUND_TEXTURE_PRESETS: BackgroundTexturePreset[] = [
  { id: 'none', label: 'Liso', description: 'Fondo sólido sin trama' },
  { id: 'dots', label: 'Puntos', description: 'Trama micro-punteada' },
  { id: 'grid', label: 'Grilla', description: 'Cuadrícula arquitectónica' },
  { id: 'diagonal', label: 'Diagonal', description: 'Líneas finas en diagonal' },
  { id: 'grain', label: 'Texturado', description: 'Acabado mate tipo papel/piedra' },
  { id: 'carbon', label: 'Fibra', description: 'Entramado geométrico oscuro' },
];

function parseHexRgb(hex?: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const clean = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}

function getRelativeLuminance(hex?: string): number {
  const rgb = parseHexRgb(hex);
  if (!rgb) return 0.96;
  const toLinear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

export function isDarkHexColor(hex?: string): boolean {
  return getRelativeLuminance(hex) < 0.36;
}

export function getContrastTextColor(hex?: string): string {
  return getRelativeLuminance(hex) < 0.45 ? '#FFFFFF' : '#09090B';
}

export function getStoreBackgroundStyle(params: {
  backgroundColor?: string;
  backgroundTexture?: BackgroundTexture | string;
  backgroundImageUrl?: string;
}): {
  style: React.CSSProperties;
  isDark: boolean;
  resolvedColor: string;
  resolvedTexture: BackgroundTexture;
} {
  const resolvedColor = /^#[0-9a-fA-F]{3,6}$/.test((params.backgroundColor || '').trim())
    ? params.backgroundColor!.trim()
    : '#FAFAFA';
  const validTextures: BackgroundTexture[] = ['none', 'dots', 'grid', 'diagonal', 'grain', 'carbon'];
  const resolvedTexture: BackgroundTexture = validTextures.includes(
    params.backgroundTexture as BackgroundTexture
  )
    ? (params.backgroundTexture as BackgroundTexture)
    : 'none';
  const customImage = (params.backgroundImageUrl || '').trim();
  const isDark = isDarkHexColor(resolvedColor) || Boolean(customImage);

  const ink = isDark ? 'rgba(255,255,255,0.075)' : 'rgba(9,9,11,0.06)';
  const inkSoft = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(9,9,11,0.035)';

  if (customImage) {
    const scrim = isDark
      ? 'linear-gradient(rgba(9,9,11,0.62), rgba(9,9,11,0.68))'
      : 'linear-gradient(rgba(250,250,250,0.72), rgba(250,250,250,0.78))';
    return {
      isDark: isDarkHexColor(resolvedColor) || true,
      resolvedColor,
      resolvedTexture,
      style: {
        backgroundColor: resolvedColor,
        backgroundImage: `${scrim}, url("${customImage.replace(/"/g, '\\"')}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      },
    };
  }

  let backgroundImage: string | undefined;
  let backgroundSize: string | undefined;

  switch (resolvedTexture) {
    case 'dots':
      backgroundImage = `radial-gradient(${ink} 1.25px, transparent 1.25px)`;
      backgroundSize = '20px 20px';
      break;
    case 'grid':
      backgroundImage = `linear-gradient(to right, ${inkSoft} 1px, transparent 1px), linear-gradient(to bottom, ${inkSoft} 1px, transparent 1px)`;
      backgroundSize = '28px 28px';
      break;
    case 'diagonal':
      backgroundImage = `repeating-linear-gradient(-45deg, ${inkSoft} 0, ${inkSoft} 1px, transparent 1px, transparent 14px)`;
      break;
    case 'grain': {
      const stroke = isDark ? '%23ffffff' : '%2309090b';
      const opacity = isDark ? '0.07' : '0.055';
      const noiseSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='140' height='140' filter='url(%23n)' opacity='${opacity}' fill='${stroke}'/></svg>`;
      backgroundImage = `url("data:image/svg+xml,${noiseSvg}")`;
      backgroundSize = '140px 140px';
      break;
    }
    case 'carbon':
      backgroundImage = `linear-gradient(27deg, ${inkSoft} 5px, transparent 5px), linear-gradient(207deg, ${inkSoft} 5px, transparent 5px), linear-gradient(27deg, ${ink} 5px, transparent 5px), linear-gradient(207deg, ${ink} 5px, transparent 5px)`;
      backgroundSize = '16px 16px';
      break;
    case 'none':
    default:
      break;
  }

  return {
    isDark: isDarkHexColor(resolvedColor),
    resolvedColor,
    resolvedTexture,
    style: {
      backgroundColor: resolvedColor,
      ...(backgroundImage ? { backgroundImage } : {}),
      ...(backgroundSize ? { backgroundSize } : {}),
    },
  };
}
