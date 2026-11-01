import { SUBCATEGORY_LABELS } from '../data/seedData';
import {
  BiometricProfile,
  BrandSizeRule,
  Garment,
  GarmentCategory,
} from '../types/wardrobe';

export const POPULAR_BRANDS: string[] = [
  'Nike',
  'Adidas',
  "Levi's",
  'Zara',
  'H&M',
  'Uniqlo',
  'COS',
  'Carhartt',
  'New Balance',
  'Mango',
  'Puma',
  'Birkenstock',
];

export const COMMON_SIZE_SUGGESTIONS: Record<'top' | 'bottom' | 'shoes', string[]> = {
  top: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '34', '36', '38', '40', '42'],
  bottom: ['XS', 'S', 'M', 'L', 'XL', '34', '36', '38', '40', '42', 'W28', 'W30', 'W32', 'W34'],
  shoes: ['37', '38', '39', '40', '41', '42', '42.5', '43', '44', '45', '46'],
};

/**
 * Normalizes a brand string and resolves common everyday spelling variations
 * (e.g. "addidas" -> "adidas", "levis" -> "levis", "h & m" -> "hm").
 */
export function normalizeBrandKey(raw?: string): string {
  if (!raw) return '';
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/['’`´]/g, '')
    .replace(/\s+/g, ' ');

  if (cleaned === 'addidas' || cleaned === 'adiadas' || cleaned === 'adiddas') {
    return 'adidas';
  }
  if (cleaned === 'levis' || cleaned === 'levi' || cleaned === 'levi strauss') {
    return 'levis';
  }
  if (cleaned === 'h&m' || cleaned === 'h & m' || cleaned === 'hm' || cleaned === 'h und m') {
    return 'hm';
  }
  if (cleaned === 'carhart' || cleaned === 'carhartt wip') {
    return 'carhartt';
  }
  if (cleaned === 'newbalance' || cleaned === 'nb') {
    return 'new balance';
  }
  return cleaned;
}

export function getCategorySizeGroup(category: GarmentCategory): 'top' | 'bottom' | 'shoes' {
  if (category === 'bottom') return 'bottom';
  if (category === 'footwear') return 'shoes';
  return 'top';
}

export interface SizeSuggestionResult {
  suggestedSize: string;
  source: 'brand_rule' | 'category_default' | 'none';
  reasonDe: string;
  reasonEn: string;
}

/**
 * Suggests the best size for a garment based on saved Brand-Size rules
 * ("Bei Nike habe ich immer L") or category default sizes.
 */
export function suggestSizeForGarment(
  category: GarmentCategory,
  brand: string | undefined,
  profile: BiometricProfile
): SizeSuggestionResult {
  const group = getCategorySizeGroup(category);
  const normBrand = normalizeBrandKey(brand);

  if (normBrand && profile.brandSizeRules && profile.brandSizeRules.length > 0) {
    // 1. Check exact categoryGroup match for this brand first
    const specificMatch = profile.brandSizeRules.find(
      (r) =>
        normalizeBrandKey(r.brand) === normBrand &&
        r.categoryGroup &&
        r.categoryGroup === group &&
        r.size.trim().length > 0
    );
    if (specificMatch) {
      return {
        suggestedSize: specificMatch.size,
        source: 'brand_rule',
        reasonDe: `Gespeichert für ${specificMatch.brand}: Größe ${specificMatch.size}`,
        reasonEn: `Saved for ${specificMatch.brand}: Size ${specificMatch.size}`,
      };
    }

    // 2. Check general ('all' or unspecified) match for this brand
    const generalMatch = profile.brandSizeRules.find(
      (r) =>
        normalizeBrandKey(r.brand) === normBrand &&
        (!r.categoryGroup || r.categoryGroup === 'all') &&
        r.size.trim().length > 0
    );
    if (generalMatch) {
      return {
        suggestedSize: generalMatch.size,
        source: 'brand_rule',
        reasonDe: `Gespeichert: Bei ${generalMatch.brand} trägst du Größe ${generalMatch.size}`,
        reasonEn: `Saved: You wear size ${generalMatch.size} in ${generalMatch.brand}`,
      };
    }
  }

  // 3. Fallback to standard size for this category group
  const defaultSize = profile.defaultSizes?.[group]?.trim();
  if (defaultSize) {
    const groupLabelDe =
      group === 'top' ? 'Oberteile' : group === 'bottom' ? 'Hosen/Röcke' : 'Schuhe';
    return {
      suggestedSize: defaultSize,
      source: 'category_default',
      reasonDe: `Deine Standard-Größe für ${groupLabelDe}: ${defaultSize}`,
      reasonEn: `Your default size for ${group}: ${defaultSize}`,
    };
  }

  return {
    suggestedSize: '',
    source: 'none',
    reasonDe: '',
    reasonEn: '',
  };
}

/**
 * Adds or updates a BrandSizeRule inside a BiometricProfile.
 */
export function upsertBrandSizeRule(
  existingRules: BrandSizeRule[] | undefined,
  newRule: BrandSizeRule
): BrandSizeRule[] {
  const list = existingRules ? [...existingRules] : [];
  const normNew = normalizeBrandKey(newRule.brand);
  const targetGroup = newRule.categoryGroup || 'all';
  if (!normNew || !newRule.size.trim()) return list;

  const filtered = list.filter(
    (r) =>
      !(
        normalizeBrandKey(r.brand) === normNew &&
        (r.categoryGroup || 'all') === targetGroup
      )
  );

  return [
    {
      brand: newRule.brand.trim(),
      size: newRule.size.trim(),
      categoryGroup: targetGroup,
    },
    ...filtered,
  ];
}

export function removeBrandSizeRule(
  existingRules: BrandSizeRule[] | undefined,
  brandToRemove: string,
  categoryGroup: 'top' | 'bottom' | 'shoes' | 'all' = 'all'
): BrandSizeRule[] {
  const list = existingRules ? [...existingRules] : [];
  const normTarget = normalizeBrandKey(brandToRemove);
  return list.filter(
    (r) =>
      !(
        normalizeBrandKey(r.brand) === normTarget &&
        (r.categoryGroup || 'all') === categoryGroup
      )
  );
}

/**
 * Search matcher for SmartClosetView supporting typo-tolerant brand names ("addidas" -> "Adidas")
 * and size queries ("Gr. L", "42", etc.).
 */
export function matchesGarmentSearch(
  garment: Garment,
  rawQuery: string,
  subcategoryLabel?: string
): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;

  const matchName = garment.name.toLowerCase().includes(q);
  const matchColor = garment.colorName.toLowerCase().includes(q);
  const subLabel = subcategoryLabel || SUBCATEGORY_LABELS[garment.subcategory] || '';
  const matchSub = subLabel.toLowerCase().includes(q);
  const matchSize = garment.size
    ? garment.size.toLowerCase().includes(q.replace(/^gr\.?\s*/i, ''))
    : false;

  const normQueryBrand = normalizeBrandKey(q);
  const normGarmentBrand = normalizeBrandKey(garment.brand);
  const matchBrand = Boolean(
    garment.brand &&
      (garment.brand.toLowerCase().includes(q) ||
        (normQueryBrand.length >= 2 && normGarmentBrand.includes(normQueryBrand)))
  );

  return matchName || matchColor || matchSub || matchSize || matchBrand;
}

/**
 * Generates a short, natural 2-3 word title for an outfit (e.g. "Strickjacke & Weite Stoffhose")
 * without verbose numbering, vibe tags, or 4-item concatenation.
 */
export function getShortOutfitTitle(items: Garment[]): string {
  const outer = items.find((i) => i.category === 'outerwear');
  const mid = items.find((i) => i.category === 'mid_layer');
  const top = items.find((i) => i.category === 'base_top');
  const bottom = items.find((i) => i.category === 'bottom');

  const leadItem = outer || mid || top;
  const leadLabel = leadItem
    ? SUBCATEGORY_LABELS[leadItem.subcategory].split(' (')[0].split(' / ')[0]
    : 'Look';
  const bottomLabel = bottom
    ? SUBCATEGORY_LABELS[bottom.subcategory].split(' (')[0].split(' / ')[0]
    : '';

  if (leadLabel && bottomLabel) {
    return `${leadLabel} & ${bottomLabel}`;
  }
  return leadLabel;
}
