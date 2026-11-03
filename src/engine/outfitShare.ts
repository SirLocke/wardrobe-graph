import { hexToHsl, classifyColorTemp } from './colorMath';
import {
  FitType,
  Garment,
  GarmentCategory,
  GarmentPattern,
  GarmentSubcategory,
  GeneratedOutfit,
  NecklineType,
  OccasionType,
  OutfitContext,
  TextureType,
  WeatherCondition,
} from '../types/wardrobe';
import { SUBCATEGORY_LABELS, TEXTURE_LABELS } from '../data/seedData';

export interface SharedOutfitItemCompact {
  n: string; // name
  c: GarmentCategory;
  s: GarmentSubcategory;
  cn: string; // colorName
  ch: string; // colorHex
  ach?: string; // accentColorHex
  p?: GarmentPattern;
  t: TextureType;
  nk?: NecklineType;
  f: FitType;
  b?: string; // brand
  sz?: string; // size
  wo?: boolean; // wornOpen
  url?: string; // optional buyUrl
}

export interface SharedOutfitPayload {
  v: 1;
  title: string;
  score: number;
  tempC: number;
  weather: WeatherCondition;
  occasion: OccasionType;
  customOccasionName?: string;
  items: SharedOutfitItemCompact[];
}

function toBase64Url(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64url: string): string {
  const base64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '==='.slice((base64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function encodeSharedOutfit(
  outfit: GeneratedOutfit,
  title: string,
  context: OutfitContext,
  customOccasionName?: string
): string {
  const payload: SharedOutfitPayload = {
    v: 1,
    title,
    score: outfit.totalScore,
    tempC: context.temperatureC,
    weather: context.weather,
    occasion: context.occasion,
    customOccasionName,
    items: outfit.items.map((item) => ({
      n: item.name,
      c: item.category,
      s: item.subcategory,
      cn: item.colorName,
      ch: item.colorHex,
      ach: item.accentColorHex,
      p: item.pattern && item.pattern !== 'solid' ? item.pattern : undefined,
      t: item.texture,
      nk: item.neckline && item.neckline !== 'none' ? item.neckline : undefined,
      f: item.fit,
      b: item.brand,
      sz: item.size,
      wo: item.wornOpen,
      url: item.buyUrl,
    })),
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodeSharedOutfit(encoded: string): {
  title: string;
  score: number;
  tempC: number;
  weather: WeatherCondition;
  occasion: OccasionType;
  customOccasionName?: string;
  garments: Garment[];
} | null {
  try {
    if (!encoded || encoded.trim().length === 0) return null;
    const raw = fromBase64Url(encoded.trim());
    const parsed = JSON.parse(raw) as SharedOutfitPayload;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      return null;
    }

    const garments: Garment[] = parsed.items.map((it, idx) => {
      const hex = it.ch && it.ch.startsWith('#') ? it.ch : '#2B2D42';
      const hsl = hexToHsl(hex);
      return {
        id: `shared_item_${idx}_${Date.now().toString(36)}`,
        name: it.n || 'Kleidungsstück',
        category: it.c || 'base_top',
        subcategory: it.s || 't_shirt',
        colorName: it.cn || 'Neutral',
        colorHex: hex,
        accentColorHex: it.ach,
        hsl,
        colorTemp: classifyColorTemp(hsl),
        fit: it.f || 'regular',
        neckline: it.nk || 'none',
        pattern: it.p || 'solid',
        texture: it.t || 'smooth_cotton',
        thermalRating: 3,
        formality: 3,
        waterResistant: false,
        isClean: true,
        brand: it.b,
        size: it.sz,
        wornOpen: it.wo,
        buyUrl: it.url,
      };
    });

    return {
      title: parsed.title || 'Geteilter Look',
      score: typeof parsed.score === 'number' ? parsed.score : 90,
      tempC: typeof parsed.tempC === 'number' ? parsed.tempC : 18,
      weather: parsed.weather || 'sunny_dry',
      occasion: parsed.occasion || 'casual',
      customOccasionName: parsed.customOccasionName,
      garments,
    };
  } catch {
    return null;
  }
}

export function buildBrandOrShopUrl(garment: Pick<Garment, 'name' | 'brand' | 'colorName' | 'subcategory' | 'texture' | 'buyUrl'>): string {
  if (garment.buyUrl && /^https?:\/\//i.test(garment.buyUrl.trim())) {
    return garment.buyUrl.trim();
  }
  const subLabel = SUBCATEGORY_LABELS[garment.subcategory]?.split(' (')[0] || '';
  const texLabel = TEXTURE_LABELS[garment.texture]?.split(' (')[0] || '';
  const parts = [
    garment.brand || '',
    subLabel || garment.name,
    garment.colorName,
    texLabel,
  ]
    .map((p) => p.trim())
    .filter(Boolean);
  const query = encodeURIComponent(parts.join(' '));
  return `https://www.google.com/search?tbm=shop&q=${query}`;
}
