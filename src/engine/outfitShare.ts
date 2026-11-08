import { hexToHsl, classifyColorTemp } from './colorMath';
import {
  BiometricProfile,
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
import { SUBCATEGORY_LABELS } from '../data/seedData';

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

export function isExampleGarment(
  garment: Pick<Garment, 'id' | 'buyUrl' | 'isWishlistSandbox'>
): boolean {
  if (garment.buyUrl && /^https?:\/\//i.test(garment.buyUrl.trim())) return true;
  if (garment.isWishlistSandbox) return true;
  return (
    garment.id.startsWith('seed_') ||
    garment.id.startsWith('fem_') ||
    garment.id.startsWith('uni_') ||
    garment.id.startsWith('arch_') ||
    garment.id.startsWith('sandbox_') ||
    garment.id.startsWith('shared_')
  );
}

function getRuntimeEnvVar(key: string): string | undefined {
  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    typeof (import.meta.env as Record<string, unknown>)[key] === 'string'
  ) {
    return (import.meta.env as Record<string, string>)[key];
  }
  if (
    typeof process !== 'undefined' &&
    process.env &&
    typeof process.env[key] === 'string'
  ) {
    return process.env[key];
  }
  return undefined;
}

export function appendAffiliateParam(url: string, param?: string): string {
  if (!param || !param.trim()) return url;
  let clean = param.trim().replace(/^[?&]+/, '');
  if (!clean) return url;
  // Support shorthand Amazon PartnerNet tag (e.g. "dein-tag-21" -> "tag=dein-tag-21")
  if (!clean.includes('=')) {
    clean = `tag=${clean}`;
  }
  const paramKey = clean.split('=')[0];
  if (url.includes(`?${paramKey}=`) || url.includes(`&${paramKey}=`)) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${clean}`;
}

const WOMENSWEAR_SUBCATEGORIES = new Set<GarmentSubcategory>([
  'blouse',
  'tank_camisole',
  'crop_top',
  'bodysuit',
  'wrap_top',
  'wide_leg_trousers',
  'midi_skirt',
  'mini_skirt',
  'heeled_ankle_boot',
  'ballet_flat',
  'sandal_strappy',
]);

const TEXTURE_SEARCH_KEYWORDS: Partial<Record<TextureType, string>> = {
  chunky_knit: 'Grobstrick',
  fine_knit: 'Feinstrick',
  flannel_wool: 'Wolle',
  fleece: 'Fleece',
  down_quilted: 'Daune',
  linen: 'Leinen',
  leather_suede: 'Leder',
};

export function resolveGarmentAudienceKeyword(
  garment: { id?: string; subcategory: GarmentSubcategory },
  profile?: Pick<BiometricProfile, 'wardrobeScope' | 'wardrobeScopes'>
): 'Damen' | 'Herren' | '' {
  const id = garment.id || '';
  if (
    id.startsWith('fem_') ||
    id.startsWith('arch_fem_') ||
    WOMENSWEAR_SUBCATEGORIES.has(garment.subcategory)
  ) {
    return 'Damen';
  }
  if (id.startsWith('seed_') || (id.startsWith('arch_') && !id.startsWith('arch_uni_'))) {
    return 'Herren';
  }
  if (profile?.wardrobeScopes && profile.wardrobeScopes.length > 0) {
    const hasWomen = profile.wardrobeScopes.includes('womenswear');
    const hasMen = profile.wardrobeScopes.includes('menswear');
    if (hasWomen && !hasMen) return 'Damen';
    if (hasMen && !hasWomen) return 'Herren';
  }
  if (profile?.wardrobeScope === 'womenswear') return 'Damen';
  if (profile?.wardrobeScope === 'menswear') return 'Herren';
  return '';
}

export function isAmazonShopActive(configOverride?: { baseUrl?: string }): boolean {
  const rawBase = configOverride?.baseUrl ?? getRuntimeEnvVar('VITE_SHOP_BASE_URL');
  if (!rawBase || !rawBase.trim()) return true; // Amazon.de is the default
  return /amazon\./i.test(rawBase);
}

export function hasAffiliateParamConfigured(): boolean {
  const rawParam = getRuntimeEnvVar('VITE_SHOP_AFFILIATE_PARAM');
  return Boolean(rawParam && rawParam.trim().length > 0);
}

export function buildBrandOrShopUrl(
  garment: Pick<Garment, 'name' | 'brand' | 'colorName' | 'subcategory' | 'texture' | 'buyUrl'> & {
    id?: string;
    fit?: FitType;
    category?: GarmentCategory;
  },
  configOverride?: {
    baseUrl?: string;
    affiliateParam?: string;
    profile?: Pick<BiometricProfile, 'wardrobeScope' | 'wardrobeScopes'>;
  }
): string {
  const affiliateParam =
    configOverride?.affiliateParam ?? getRuntimeEnvVar('VITE_SHOP_AFFILIATE_PARAM');

  if (garment.buyUrl && /^https?:\/\//i.test(garment.buyUrl.trim())) {
    return appendAffiliateParam(garment.buyUrl.trim(), affiliateParam);
  }

  const rawSubLabel = SUBCATEGORY_LABELS[garment.subcategory]?.split(' (')[0] || '';
  const cleanSubLabel = rawSubLabel.split(' / ')[0].trim();
  const cleanColor = (garment.colorName || '')
    .replace(/\s*\(Test\)/gi, '')
    .split(' / ')[0]
    .trim();

  const fitKeyword =
    garment.category === 'accessory' || garment.category === 'footwear'
      ? ''
      : garment.fit === 'slim'
      ? 'Slim Fit'
      : garment.fit === 'boxy_oversized'
      ? 'Oversized'
      : '';

  const texKeyword = TEXTURE_SEARCH_KEYWORDS[garment.texture] || '';
  const audienceKeyword = resolveGarmentAudienceKeyword(garment, configOverride?.profile);

  const rawParts = [
    garment.brand || '',
    cleanSubLabel || garment.name,
    cleanColor,
    fitKeyword,
    texKeyword,
    audienceKeyword,
  ];

  // Deduplicate tokens case-insensitively while preserving order
  const seenTokens = new Set<string>();
  const finalTokens: string[] = [];
  for (const part of rawParts) {
    for (const token of part.split(/\s+/)) {
      const cleaned = token.replace(/^[(),.-]+|[(),.-]+$/g, '').trim();
      if (!cleaned) continue;
      const lower = cleaned.toLowerCase();
      if (!seenTokens.has(lower)) {
        seenTokens.add(lower);
        finalTokens.push(cleaned);
      }
    }
  }

  const query = encodeURIComponent(finalTokens.join(' '));

  const rawBase = configOverride?.baseUrl ?? getRuntimeEnvVar('VITE_SHOP_BASE_URL');
  let targetUrl: string;

  if (rawBase && rawBase.trim()) {
    const base = rawBase.trim();
    if (base.includes('{query}')) {
      targetUrl = base.replace('{query}', query);
    } else {
      const sep = base.includes('?') ? '&' : '?';
      targetUrl = `${base}${sep}k=${query}`;
    }
  } else {
    targetUrl = `https://www.amazon.de/s?k=${query}`;
  }

  return appendAffiliateParam(targetUrl, affiliateParam);
}
