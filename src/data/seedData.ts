import { classifyColorTemp, hexToHsl } from '../engine/colorMath';
import {
  BiometricProfile,
  FitType,
  Garment,
  GarmentCategory,
  GarmentSubcategory,
  NecklineType,
  OccasionType,
  TextureType,
  WeatherCondition,
} from '../types/wardrobe';

export interface TextileColorPreset {
  name: string;
  hex: string;
  group: 'Neutrals' | 'Earth & Olive' | 'Blue & Cool' | 'Accent';
}

/**
 * 24 realistic textile color presets for fast manual entry
 */
export const TEXTILE_COLOR_PRESETS: TextileColorPreset[] = [
  { name: 'Salbeigrün', hex: '#8F9779', group: 'Earth & Olive' },
  { name: 'Dunkel-Oliv', hex: '#4B5320', group: 'Earth & Olive' },
  { name: 'Navy', hex: '#1B263B', group: 'Blue & Cool' },
  { name: 'Anthrazit', hex: '#2B2D42', group: 'Neutrals' },
  { name: 'Off-White', hex: '#F4F1EA', group: 'Neutrals' },
  { name: 'Sand / Beige', hex: '#D5C7B8', group: 'Neutrals' },
  { name: 'Burgunder', hex: '#5E2129', group: 'Accent' },
  { name: 'Espresso', hex: '#3B2F2F', group: 'Neutrals' },
  { name: 'Schwarz', hex: '#141414', group: 'Neutrals' },
  { name: 'Moosgrün', hex: '#5E6B3C', group: 'Earth & Olive' },
  { name: 'Waldkiefer', hex: '#2D4A3E', group: 'Earth & Olive' },
  { name: 'Terrakotta', hex: '#A85A44', group: 'Accent' },
  { name: 'Rostbraun', hex: '#7C3F2C', group: 'Earth & Olive' },
  { name: 'Ocker-Senf', hex: '#B88B4A', group: 'Accent' },
  { name: 'Kamel', hex: '#C19A6B', group: 'Neutrals' },
  { name: 'Warmes Taupe', hex: '#8A7E72', group: 'Neutrals' },
  { name: 'Steingrau', hex: '#7D8491', group: 'Neutrals' },
  { name: 'Petrol-Teal', hex: '#355C67', group: 'Blue & Cool' },
  { name: 'Taubenblau', hex: '#5B758E', group: 'Blue & Cool' },
  { name: 'Raw Indigo', hex: '#24344D', group: 'Blue & Cool' },
  { name: 'Pflaume Gedämpft', hex: '#583A4E', group: 'Accent' },
  { name: 'Eukalyptus', hex: '#6F8578', group: 'Earth & Olive' },
  { name: 'Eisrosa (Test)', hex: '#F7C6DB', group: 'Accent' },
  { name: 'Neon-Magenta (Test)', hex: '#FF1493', group: 'Accent' },
];

export const CATEGORY_LABELS: Record<GarmentCategory, string> = {
  base_top: 'Base-Top (1. Schicht)',
  mid_layer: 'Mid-Layer (2. Schicht)',
  outerwear: 'Outerwear / Jacken',
  bottom: 'Hosen / Bottoms',
  footwear: 'Schuhwerk',
};

export const SUBCATEGORY_LABELS: Record<GarmentSubcategory, string> = {
  t_shirt: 'T-Shirt (Klassisch)',
  heavyweight_tee: 'Heavyweight Tee',
  polo: 'Polohemd',
  longsleeve: 'Longsleeve',
  overshirt: 'Overshirt',
  button_down_shirt: 'Button-Down Hemd',
  crewneck_sweater: 'Sweatshirt (Crewneck)',
  knit_sweater: 'Strickpullover',
  turtleneck: 'Rollkragen / Turtleneck',
  hoodie: 'Hoodie',
  cardigan: 'Cardigan',
  light_jacket: 'Leichte Jacke / Field-Jacket',
  coat: 'Wollmantel / Coat',
  parka: 'Winter-Parka',
  blouson: 'Blouson',
  chino: 'Chino',
  denim: 'Denim / Jeans',
  trousers: 'Tuchhose / Trousers',
  cargo: 'Cargo-Hose',
  shorts: 'Shorts',
  sneaker_clean: 'Clean Sneaker',
  sneaker_chunky: 'Chunky / Retro Sneaker',
  boots: 'Boots / Chelsea-Boots',
  loafer_derby: 'Loafer / Derby',
  runner: 'Tech-Runner',
};

export const SUBCATEGORIES_BY_CATEGORY: Record<GarmentCategory, GarmentSubcategory[]> = {
  base_top: ['heavyweight_tee', 't_shirt', 'polo', 'longsleeve'],
  mid_layer: [
    'overshirt',
    'button_down_shirt',
    'knit_sweater',
    'crewneck_sweater',
    'turtleneck',
    'cardigan',
    'hoodie',
  ],
  outerwear: ['blouson', 'light_jacket', 'coat', 'parka'],
  bottom: ['chino', 'denim', 'trousers', 'cargo', 'shorts'],
  footwear: ['sneaker_clean', 'boots', 'loafer_derby', 'sneaker_chunky', 'runner'],
};

export const FIT_LABELS: Record<FitType, string> = {
  slim: 'Slim / Körpernah',
  regular: 'Regular / Tailored',
  relaxed: 'Relaxed / Entspannt',
  boxy_oversized: 'Boxy / Oversized',
};

export const NECKLINE_LABELS: Record<NecklineType, string> = {
  crewneck: 'Klassischer Rundhals (Crewneck)',
  heavy_crewneck: 'Heavyweight Crewneck (Enges Bündchen)',
  v_neck: 'V-Ausschnitt',
  stand_collar: 'Stehkragen / Overshirt-Kragen',
  shirt_collar: 'Hemdkragen (Button-Down)',
  turtleneck: 'Rollkragen / Mock-Neck',
  hooded: 'Kapuze (Hooded)',
  none: 'Kein Kragen (Hose / Schuhe)',
};

export const TEXTURE_LABELS: Record<TextureType, string> = {
  smooth_cotton: 'Glatte Baumwolle / Popeline',
  heavy_jersey: 'Heavyweight Jersey (260g+)',
  twill_chino: 'Baumwoll-Twill / Gabardine',
  denim: 'Selvedge / Raw Denim',
  chunky_knit: 'Grobstrick / Waffelstrick',
  fine_knit: 'Merino-Feinstrick',
  flannel_wool: 'Wollflanell / Tuchwolle',
  linen: 'Leinen-Struktur',
  tech_waterproof: '3-Lagen Tech-Membran',
  leather_suede: 'Glattleder / Rauleder (Suede)',
};

export const OCCASION_LABELS: Record<OccasionType, string> = {
  casual: 'Alltag / Casual',
  smart_casual_office: 'Büro / Smart Casual',
  active_sporty: 'Sportlich / Aktiv',
  date_night: 'Date / Abend',
  formal_event: 'Schick / Formal',
};

export const WEATHER_LABELS: Record<WeatherCondition, string> = {
  sunny_dry: 'Trocken & Klar',
  cloudy_windy: 'Bewölkt & Wind',
  rain_wet: 'Regen & Nässe',
};

/**
 * Default Biometric Profile:
 * Olive/Warm-Neutral undertone, Medium contrast, Muted chroma, Green-Hazel eyes,
 * Dark blonde/Ash brown hair with Short Fade + Structured Top & Stubble.
 */
export const DEFAULT_BIOMETRIC_PROFILE: BiometricProfile = {
  id: 'default_profile',
  undertone: 'olive',
  contrastLevel: 'medium',
  chromaLevel: 'muted',
  valueLevel: 'medium',
  skinHex: '#C8A98E',
  eyeColorName: 'Grün-Haselnuss (Green-Hazel)',
  eyeHex: '#6E7D4E',
  hairColorName: 'Dunkelblond / Aschbraun',
  hairHex: '#5A4D41',
  haircutStyle: 'short_fade_structured_top',
  facialHair: 'stubble',
  preferredFit: 'regular_tailored',
};

function makeSeedGarment(
  raw: Omit<Garment, 'hsl' | 'colorTemp'>
): Garment {
  const hsl = hexToHsl(raw.colorHex);
  const colorTemp = classifyColorTemp(hsl);
  return {
    ...raw,
    hsl,
    colorTemp,
  };
}

/**
 * 14-item starter wardrobe including 2 deliberate "Orphan Pieces":
 * - Orphan #1: `seed_orphan_1` ("Merino Rollkragen Burgunder", formality 4, thermal 4) -> Biometric Score ~95%,
 *   but has <= 1 valid outfit in the 3 core contexts because the user lacks a formal/smart-casual Wool Coat or tailored Trousers/Chelsea Boots in the right formality/temperature window.
 * - Orphan #2: `seed_orphan_2` ("Suede Blouson Waldkiefer", formality 4, thermal 3, waterResistant: false) -> Biometric Score ~95%,
 *   but isolated in Cold/Wet (not water-resistant) and lacks smart-casual bottom/shoe partners in Transition Smart Casual.
 */
export const SEED_WARDROBE_GARMENTS: Garment[] = [
  // --- BASE TOPS (4) ---
  makeSeedGarment({
    id: 'seed_top_1',
    name: 'Heavyweight Tee Salbeigrün',
    category: 'base_top',
    subcategory: 'heavyweight_tee',
    colorName: 'Salbeigrün',
    colorHex: '#8F9779',
    fit: 'relaxed',
    neckline: 'heavy_crewneck',
    texture: 'heavy_jersey',
    thermalRating: 2,
    formality: 2,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'seed_top_2',
    name: 'Heavyweight Tee Off-White',
    category: 'base_top',
    subcategory: 'heavyweight_tee',
    colorName: 'Off-White',
    colorHex: '#F4F1EA',
    fit: 'regular',
    neckline: 'heavy_crewneck',
    texture: 'heavy_jersey',
    thermalRating: 2,
    formality: 3,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'seed_top_3',
    name: 'Supima T-Shirt Anthrazit',
    category: 'base_top',
    subcategory: 't_shirt',
    colorName: 'Anthrazit',
    colorHex: '#2B2D42',
    fit: 'regular',
    neckline: 'crewneck',
    texture: 'smooth_cotton',
    thermalRating: 1,
    formality: 2,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'seed_top_4',
    name: 'Struktur-Longsleeve Espresso',
    category: 'base_top',
    subcategory: 'longsleeve',
    colorName: 'Espresso',
    colorHex: '#3B2F2F',
    fit: 'regular',
    neckline: 'heavy_crewneck',
    texture: 'heavy_jersey',
    thermalRating: 3,
    formality: 3,
    waterResistant: false,
    isClean: true,
  }),

  // --- MID-LAYERS (4, including Orphan #1) ---
  makeSeedGarment({
    id: 'seed_mid_1',
    name: 'Twill Overshirt Dunkel-Oliv',
    category: 'mid_layer',
    subcategory: 'overshirt',
    colorName: 'Dunkel-Oliv',
    colorHex: '#4B5320',
    fit: 'relaxed',
    neckline: 'stand_collar',
    texture: 'twill_chino',
    thermalRating: 3,
    formality: 3,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'seed_mid_2',
    name: 'Oxford Hemd Sand-Beige',
    category: 'mid_layer',
    subcategory: 'button_down_shirt',
    colorName: 'Sand / Beige',
    colorHex: '#D5C7B8',
    fit: 'regular',
    neckline: 'shirt_collar',
    texture: 'smooth_cotton',
    thermalRating: 2,
    formality: 3,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'seed_mid_3',
    name: 'Waffelstrick Crewneck Navy',
    category: 'mid_layer',
    subcategory: 'knit_sweater',
    colorName: 'Navy',
    colorHex: '#1B263B',
    fit: 'relaxed',
    neckline: 'heavy_crewneck',
    texture: 'chunky_knit',
    thermalRating: 3,
    formality: 3,
    waterResistant: false,
    isClean: true,
  }),
  // DELIBERATE ORPHAN PIECE #1: High biometric score (Burgunder complementary to Green-Hazel eyes + turtleneck for short fade),
  // but formality 5 & thermal 4 makes it isolated in everyday casual & smart-casual office without formal coat/trousers.
  makeSeedGarment({
    id: 'seed_orphan_1',
    name: 'Feinstrick Rollkragen Burgunder',
    category: 'mid_layer',
    subcategory: 'turtleneck',
    colorName: 'Burgunder',
    colorHex: '#5E2129',
    fit: 'slim',
    neckline: 'turtleneck',
    texture: 'fine_knit',
    thermalRating: 4,
    formality: 4,
    waterResistant: false,
    isClean: true,
  }),

  // --- OUTERWEAR (2, including Orphan #2) ---
  makeSeedGarment({
    id: 'seed_out_1',
    name: '3-Lagen Tech-Parka Dunkel-Oliv',
    category: 'outerwear',
    subcategory: 'parka',
    colorName: 'Dunkel-Oliv',
    colorHex: '#4B5320',
    fit: 'relaxed',
    neckline: 'stand_collar',
    texture: 'tech_waterproof',
    thermalRating: 4,
    formality: 3,
    waterResistant: true,
    isClean: true,
  }),
  // DELIBERATE ORPHAN PIECE #2: High biometric score (Waldkiefer #2D4A3E stand_collar suede blouson),
  // but waterResistant === false (excluded in Cold/Wet 6°C) and formality 4 (isolated until smart-casual trousers are added).
  makeSeedGarment({
    id: 'seed_orphan_2',
    name: 'Suede-Leder Blouson Waldkiefer',
    category: 'outerwear',
    subcategory: 'blouson',
    colorName: 'Waldkiefer',
    colorHex: '#2D4A3E',
    fit: 'regular',
    neckline: 'stand_collar',
    texture: 'leather_suede',
    thermalRating: 3,
    formality: 4,
    waterResistant: false,
    isClean: true,
  }),

  // --- BOTTOMS (2) ---
  makeSeedGarment({
    id: 'seed_bot_1',
    name: 'Tapered Chino Sand-Beige',
    category: 'bottom',
    subcategory: 'chino',
    colorName: 'Sand / Beige',
    colorHex: '#D5C7B8',
    fit: 'regular',
    neckline: 'none',
    texture: 'twill_chino',
    thermalRating: 2,
    formality: 3,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'seed_bot_2',
    name: 'Selvedge Denim Raw Indigo',
    category: 'bottom',
    subcategory: 'denim',
    colorName: 'Raw Indigo',
    colorHex: '#24344D',
    fit: 'regular',
    neckline: 'none',
    texture: 'denim',
    thermalRating: 3,
    formality: 2,
    waterResistant: false,
    isClean: true,
  }),

  // --- FOOTWEAR (2) ---
  makeSeedGarment({
    id: 'seed_shoe_1',
    name: 'Minimalistischer Leder-Sneaker Off-White',
    category: 'footwear',
    subcategory: 'sneaker_clean',
    colorName: 'Off-White',
    colorHex: '#F4F1EA',
    fit: 'regular',
    neckline: 'none',
    texture: 'leather_suede',
    thermalRating: 2,
    formality: 3,
    waterResistant: true,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'seed_shoe_2',
    name: 'Suede Desert-Boot Espresso',
    category: 'footwear',
    subcategory: 'boots',
    colorName: 'Espresso',
    colorHex: '#3B2F2F',
    fit: 'regular',
    neckline: 'none',
    texture: 'leather_suede',
    thermalRating: 3,
    formality: 3,
    waterResistant: false,
    isClean: true,
  }),
];
