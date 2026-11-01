import { classifyColorTemp, hexToHsl } from '../engine/colorMath';
import {
  BiometricProfile,
  FitType,
  Garment,
  GarmentCategory,
  GarmentSubcategory,
  NecklineType,
  OccasionType,
  StyleVibe,
  TextureType,
  WardrobeScope,
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
  base_top: 'T-Shirts, Tops & Blusen',
  mid_layer: 'Pullover, Hoodies & Strickjacken',
  outerwear: 'Jacken & Mäntel',
  bottom: 'Hosen & Röcke',
  footwear: 'Schuhe',
};

export const CATEGORY_LABELS_EN: Record<GarmentCategory, string> = {
  base_top: 'T-Shirts, Tops & Blouses',
  mid_layer: 'Sweaters, Hoodies & Cardigans',
  outerwear: 'Jackets & Coats',
  bottom: 'Trousers, Jeans & Skirts',
  footwear: 'Shoes',
};

export const SUBCATEGORY_LABELS: Record<GarmentSubcategory, string> = {
  // Base Tops
  t_shirt: 'Klassisches T-Shirt',
  heavyweight_tee: 'Dickes Baumwoll-T-Shirt',
  polo: 'Poloshirt',
  longsleeve: 'Langarmshirt',
  blouse: 'Bluse / Hemdbluse',
  tank_camisole: 'Top / Trägertop',
  crop_top: 'Kurzes Shirt',
  bodysuit: 'Figurbetontes Langarmshirt',
  // Mid Layers
  overshirt: 'Hemdjacke (Overshirt)',
  button_down_shirt: 'Klassisches Hemd',
  crewneck_sweater: 'Sweatshirt',
  knit_sweater: 'Strickpullover',
  turtleneck: 'Rollkragenpullover',
  hoodie: 'Hoodie (Kapuzenpullover)',
  cardigan: 'Strickjacke (Cardigan)',
  blazer: 'Blazer / Sakko',
  vest_gilet: 'Pullunder / Strickweste',
  wrap_top: 'Feinstrick-Jacke',
  // Outerwear
  light_jacket: 'Übergangsjacke',
  coat: 'Wollmantel',
  parka: 'Regenjacke / Parka',
  blouson: 'Leichte Jacke / Blouson',
  trenchcoat: 'Trenchcoat',
  leather_jacket: 'Lederjacke',
  puffer_jacket: 'Winter- / Steppjacke',
  // Bottoms & Skirts
  chino: 'Chino-Hose',
  denim: 'Jeans',
  trousers: 'Stoffhose',
  cargo: 'Cargohose',
  shorts: 'Kurze Hose / Shorts',
  wide_leg_trousers: 'Weite Stoffhose',
  midi_skirt: 'Midi-Rock',
  mini_skirt: 'Kurzer Rock',
  // Footwear
  sneaker_clean: 'Schlichte Sneaker',
  sneaker_chunky: 'Sportliche Sneaker',
  boots: 'Stiefel / Boots',
  loafer_derby: 'Loafer / Halbschuhe',
  runner: 'Laufschuhe / Sportschuhe',
  heeled_ankle_boot: 'Stiefeletten (Ankle Boots)',
  ballet_flat: 'Ballerinas / Flache Schuhe',
  sandal_strappy: 'Sandalen / Sommerschuhe',
};

export const SUBCATEGORIES_BY_CATEGORY: Record<GarmentCategory, GarmentSubcategory[]> = {
  base_top: [
    't_shirt',
    'longsleeve',
    'blouse',
    'tank_camisole',
    'polo',
    'heavyweight_tee',
    'crop_top',
    'bodysuit',
  ],
  mid_layer: [
    'hoodie',
    'knit_sweater',
    'crewneck_sweater',
    'cardigan',
    'blazer',
    'button_down_shirt',
    'overshirt',
    'turtleneck',
    'vest_gilet',
    'wrap_top',
  ],
  outerwear: [
    'light_jacket',
    'trenchcoat',
    'coat',
    'parka',
    'puffer_jacket',
    'leather_jacket',
    'blouson',
  ],
  bottom: [
    'denim',
    'chino',
    'trousers',
    'wide_leg_trousers',
    'midi_skirt',
    'mini_skirt',
    'cargo',
    'shorts',
  ],
  footwear: [
    'sneaker_clean',
    'boots',
    'heeled_ankle_boot',
    'loafer_derby',
    'ballet_flat',
    'sneaker_chunky',
    'runner',
    'sandal_strappy',
  ],
};

export const FIT_LABELS: Record<FitType, string> = {
  slim: 'Schmal / Figurbetont',
  regular: 'Normal geschnitten',
  relaxed: 'Locker / Bequem',
  boxy_oversized: 'Weit / Oversized',
};

export const NECKLINE_LABELS: Record<NecklineType, string> = {
  crewneck: 'Rundhals-Ausschnitt',
  heavy_crewneck: 'Rundhals (dickes Bündchen)',
  v_neck: 'V-Ausschnitt',
  stand_collar: 'Stehkragen',
  shirt_collar: 'Hemdkragen / Revers',
  turtleneck: 'Rollkragen',
  hooded: 'Mit Kapuze',
  none: 'Kein Kragen (Hose / Rock / Schuhe)',
};

export const TEXTURE_LABELS: Record<TextureType, string> = {
  smooth_cotton: 'Glatte Baumwolle',
  heavy_jersey: 'Dicker Baumwollstoff (Sweat/Jersey)',
  twill_chino: 'Fester Hosenstoff (Chino/Twill)',
  denim: 'Jeansstoff (Denim)',
  chunky_knit: 'Grobstrick',
  fine_knit: 'Feinstrick',
  flannel_wool: 'Wollstoff / Flanell',
  linen: 'Leinen',
  tech_waterproof: 'Wasserabweisender Funktionsstoff',
  leather_suede: 'Leder / Wildleder',
};

export const OCCASION_LABELS: Record<OccasionType, string> = {
  casual: 'Alltag & Freizeit',
  smart_casual_office: 'Büro & Alltag schick',
  active_sporty: 'Sportlich & Unterwegs',
  date_night: 'Abendessen & Ausgehen',
  formal_event: 'Festlich & Besonderer Anlass',
};

export const OCCASION_LABELS_EN: Record<OccasionType, string> = {
  casual: 'Everyday & Casual',
  smart_casual_office: 'Office & Smart Casual',
  active_sporty: 'Active & On the Go',
  date_night: 'Dinner & Date Night',
  formal_event: 'Formal & Special Event',
};

export const WEATHER_LABELS: Record<WeatherCondition, string> = {
  sunny_dry: 'Trocken & Schön',
  cloudy_windy: 'Bewölkt & Windig',
  rain_wet: 'Regen & Nass',
};

export interface StyleVibeMetadata {
  id: StyleVibe;
  labelDe: string;
  labelEn: string;
  subtitleDe: string;
  subtitleEn: string;
}

export const STYLE_VIBE_META: Record<StyleVibe, StyleVibeMetadata> = {
  balanced: {
    id: 'balanced',
    labelDe: 'Ausgewogen (Alltag)',
    labelEn: 'Everyday Balanced',
    subtitleDe: 'Harmonischer Mix aus deinen besten Farben und bequemen Schnitten',
    subtitleEn: 'Balanced mix of your best colors and comfortable everyday cuts',
  },
  minimal_capsule: {
    id: 'minimal_capsule',
    labelDe: 'Schlicht & Zeitlos (Capsule)',
    labelEn: 'Minimal Capsule',
    subtitleDe: 'Ruhige Basisfarben (Beige, Weiß, Dunkelblau, Grau) mit maximal einer Akzentfarbe',
    subtitleEn: 'Calm neutral colors with at most one subtle accent color',
  },
  statement_editorial: {
    id: 'statement_editorial',
    labelDe: 'Auffälliger Hingucker (Statement)',
    labelEn: 'Statement Look',
    subtitleDe: 'Starke Lieblingsfarbe im Fokus kombiniert mit spannenden Stoffen',
    subtitleEn: 'Bold favorite color focal point paired with rich fabrics',
  },
  tailored_chic: {
    id: 'tailored_chic',
    labelDe: 'Schick & Gepflegt (Büro / Chic)',
    labelEn: 'Smart & Chic',
    subtitleDe: 'Blazer, Hemd/Bluse, Trenchcoat, Stoffhose oder Rock und schicke Schuhe',
    subtitleEn: 'Blazers, shirts/blouses, trenchcoat, tailored trousers or skirt & smart shoes',
  },
  street_relaxed: {
    id: 'street_relaxed',
    labelDe: 'Locker & Bequem (Casual)',
    labelEn: 'Relaxed & Casual',
    subtitleDe: 'Hoodies, Sweatshirts, T-Shirts, Jeans und bequeme Sneaker',
    subtitleEn: 'Hoodies, sweatshirts, tees, jeans and comfortable sneakers',
  },
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
  eyeColorName: 'Grün-Braun (Haselnuss)',
  eyeHex: '#6E7D4E',
  hairColorName: 'Dunkelblond / Braun',
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
 * PRESET 1: Menswear Everyday Wardrobe (14 normal everyday items + 2 deliberate "Schrankleichen")
 */
export const SEED_WARDROBE_GARMENTS: Garment[] = [
  // --- BASE TOPS (4) ---
  makeSeedGarment({
    id: 'seed_top_1',
    name: 'T-Shirt Salbeigrün',
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
    name: 'Weißes T-Shirt',
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
    name: 'Dunkelgraues T-Shirt',
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
    name: 'Langarmshirt Dunkelbraun',
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
    name: 'Hemdjacke (Overshirt) Olivgrün',
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
    name: 'Klassisches Hemd Beige',
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
    name: 'Strickpullover Dunkelblau',
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
  makeSeedGarment({
    id: 'seed_orphan_1',
    name: 'Feiner Rollkragenpullover Weinrot',
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
    name: 'Regenjacke / Parka Olivgrün',
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
  makeSeedGarment({
    id: 'seed_orphan_2',
    name: 'Wildleder-Jacke Tannengrün',
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
    name: 'Beige Chino-Hose',
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
    name: 'Dunkelblaue Jeans',
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
    name: 'Weiße Leder-Sneaker',
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
    name: 'Dunkelbraune Leder-Boots',
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

/**
 * PRESET 2: Womenswear Everyday Wardrobe (19 realistic everyday items: T-Shirts, Bluse, Hoodie, Strickjacke, Pullover, Blazer, Trenchcoat, Jeans, Stoffhose, Rock, Sneaker, Stiefeletten)
 */
export const SEED_WOMENSWEAR_GARMENTS: Garment[] = [
  // --- BASE TOPS (5) ---
  makeSeedGarment({
    id: 'fem_top_1',
    name: 'Leichte Hemdbluse Salbeigrün',
    category: 'base_top',
    subcategory: 'blouse',
    colorName: 'Salbeigrün',
    colorHex: '#8F9779',
    fit: 'relaxed',
    neckline: 'v_neck',
    texture: 'smooth_cotton',
    thermalRating: 2,
    formality: 3,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'fem_top_2',
    name: 'Schlichtes Top Cremeweiß',
    category: 'base_top',
    subcategory: 'tank_camisole',
    colorName: 'Off-White',
    colorHex: '#F4F1EA',
    fit: 'slim',
    neckline: 'crewneck',
    texture: 'fine_knit',
    thermalRating: 1,
    formality: 2,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'fem_top_3',
    name: 'Langarmshirt Dunkelbraun',
    category: 'base_top',
    subcategory: 'longsleeve',
    colorName: 'Espresso',
    colorHex: '#3B2F2F',
    fit: 'slim',
    neckline: 'heavy_crewneck',
    texture: 'fine_knit',
    thermalRating: 2,
    formality: 3,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'fem_top_4',
    name: 'Dunkelgraues T-Shirt',
    category: 'base_top',
    subcategory: 't_shirt',
    colorName: 'Anthrazit',
    colorHex: '#2B2D42',
    fit: 'relaxed',
    neckline: 'crewneck',
    texture: 'smooth_cotton',
    thermalRating: 1,
    formality: 2,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'fem_top_5',
    name: 'Klassisches Weißes T-Shirt',
    category: 'base_top',
    subcategory: 't_shirt',
    colorName: 'Off-White',
    colorHex: '#F4F1EA',
    fit: 'regular',
    neckline: 'crewneck',
    texture: 'smooth_cotton',
    thermalRating: 1,
    formality: 2,
    waterResistant: false,
    isClean: true,
  }),

  // --- MID-LAYERS (6, including Hoodie, Cardigan, Pullover, Blazer & Orphan #1) ---
  makeSeedGarment({
    id: 'fem_mid_1',
    name: 'Klassischer Blazer Beige',
    category: 'mid_layer',
    subcategory: 'blazer',
    colorName: 'Sand / Beige',
    colorHex: '#D5C7B8',
    fit: 'relaxed',
    neckline: 'shirt_collar',
    texture: 'flannel_wool',
    thermalRating: 3,
    formality: 3,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'fem_mid_2',
    name: 'Weiche Strickjacke (Cardigan) Olivgrün',
    category: 'mid_layer',
    subcategory: 'cardigan',
    colorName: 'Dunkel-Oliv',
    colorHex: '#4B5320',
    fit: 'regular',
    neckline: 'v_neck',
    texture: 'fine_knit',
    thermalRating: 3,
    formality: 3,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'fem_mid_3',
    name: 'Kuscheliger Strickpullover Kamel',
    category: 'mid_layer',
    subcategory: 'knit_sweater',
    colorName: 'Kamel',
    colorHex: '#C19A6B',
    fit: 'relaxed',
    neckline: 'heavy_crewneck',
    texture: 'chunky_knit',
    thermalRating: 3,
    formality: 3,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'fem_mid_4',
    name: 'Gemütlicher Hoodie Salbeigrün',
    category: 'mid_layer',
    subcategory: 'hoodie',
    colorName: 'Salbeigrün',
    colorHex: '#8F9779',
    fit: 'relaxed',
    neckline: 'hooded',
    texture: 'heavy_jersey',
    thermalRating: 3,
    formality: 2,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'fem_mid_5',
    name: 'Bequemes Sweatshirt Dunkelgrau',
    category: 'mid_layer',
    subcategory: 'crewneck_sweater',
    colorName: 'Anthrazit',
    colorHex: '#2B2D42',
    fit: 'relaxed',
    neckline: 'crewneck',
    texture: 'heavy_jersey',
    thermalRating: 3,
    formality: 2,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'fem_orphan_1',
    name: 'Feiner Rollkragenpullover Weinrot',
    category: 'mid_layer',
    subcategory: 'turtleneck',
    colorName: 'Burgunder',
    colorHex: '#5E2129',
    fit: 'slim',
    neckline: 'turtleneck',
    texture: 'fine_knit',
    thermalRating: 4,
    formality: 5,
    waterResistant: false,
    isClean: true,
  }),

  // --- OUTERWEAR (2, including Orphan #2) ---
  makeSeedGarment({
    id: 'fem_out_1',
    name: 'Klassischer Trenchcoat Olivgrün',
    category: 'outerwear',
    subcategory: 'trenchcoat',
    colorName: 'Dunkel-Oliv',
    colorHex: '#4B5320',
    fit: 'relaxed',
    neckline: 'shirt_collar',
    texture: 'tech_waterproof',
    thermalRating: 4,
    formality: 3,
    waterResistant: true,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'fem_orphan_2',
    name: 'Wildleder-Jacke Tannengrün',
    category: 'outerwear',
    subcategory: 'leather_jacket',
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

  // --- BOTTOMS & SKIRTS (3) ---
  makeSeedGarment({
    id: 'fem_bot_1',
    name: 'Weite Stoffhose Beige',
    category: 'bottom',
    subcategory: 'wide_leg_trousers',
    colorName: 'Sand / Beige',
    colorHex: '#D5C7B8',
    fit: 'relaxed',
    neckline: 'none',
    texture: 'twill_chino',
    thermalRating: 2,
    formality: 3,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'fem_bot_2',
    name: 'Midi-Rock Dunkelbraun',
    category: 'bottom',
    subcategory: 'midi_skirt',
    colorName: 'Espresso',
    colorHex: '#3B2F2F',
    fit: 'relaxed',
    neckline: 'none',
    texture: 'smooth_cotton',
    thermalRating: 2,
    formality: 3,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'fem_bot_3',
    name: 'Klassische Blaue Jeans',
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

  // --- FOOTWEAR (3) ---
  makeSeedGarment({
    id: 'fem_shoe_1',
    name: 'Dunkelbraune Stiefeletten (Ankle Boots)',
    category: 'footwear',
    subcategory: 'heeled_ankle_boot',
    colorName: 'Espresso',
    colorHex: '#3B2F2F',
    fit: 'regular',
    neckline: 'none',
    texture: 'leather_suede',
    thermalRating: 3,
    formality: 3,
    waterResistant: true,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'fem_shoe_2',
    name: 'Schwarze Loafer / Ballerinas',
    category: 'footwear',
    subcategory: 'ballet_flat',
    colorName: 'Schwarz',
    colorHex: '#141414',
    fit: 'regular',
    neckline: 'none',
    texture: 'leather_suede',
    thermalRating: 2,
    formality: 3,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'fem_shoe_3',
    name: 'Weiße Leder-Sneaker',
    category: 'footwear',
    subcategory: 'sneaker_clean',
    colorName: 'Off-White',
    colorHex: '#F4F1EA',
    fit: 'regular',
    neckline: 'none',
    texture: 'leather_suede',
    thermalRating: 2,
    formality: 2,
    waterResistant: true,
    isClean: true,
  }),
];

/**
 * PRESET 3: Unisex Essentials (Hoodies, Tees, Sweaters, Overshirts, Jeans, Stoffhose, Sneakers)
 */
export const SEED_UNISEX_GARMENTS: Garment[] = [
  ...SEED_WARDROBE_GARMENTS,
  makeSeedGarment({
    id: 'uni_mid_hoodie',
    name: 'Gemütlicher Hoodie Salbeigrün',
    category: 'mid_layer',
    subcategory: 'hoodie',
    colorName: 'Salbeigrün',
    colorHex: '#8F9779',
    fit: 'relaxed',
    neckline: 'hooded',
    texture: 'heavy_jersey',
    thermalRating: 3,
    formality: 2,
    waterResistant: false,
    isClean: true,
  }),
  makeSeedGarment({
    id: 'uni_bot_wide',
    name: 'Bequeme Stoffhose Dunkelgrau',
    category: 'bottom',
    subcategory: 'wide_leg_trousers',
    colorName: 'Anthrazit',
    colorHex: '#2B2D42',
    fit: 'relaxed',
    neckline: 'none',
    texture: 'twill_chino',
    thermalRating: 2,
    formality: 3,
    waterResistant: false,
    isClean: true,
  }),
];

export type WardrobePresetKey =
  | 'womenswear_capsule'
  | 'menswear_unisex'
  | 'unisex_essentials'
  | 'combined_atelier';

export const WARDROBE_PRESETS: Record<
  WardrobePresetKey,
  {
    id: WardrobePresetKey;
    scope: WardrobeScope;
    labelDe: string;
    labelEn: string;
    descriptionDe: string;
    descriptionEn: string;
    garments: Garment[];
  }
> = {
  womenswear_capsule: {
    id: 'womenswear_capsule',
    scope: 'womenswear',
    labelDe: 'Frauen-Kleiderschrank (19 normale Alltagsteile)',
    labelEn: 'Women’s Everyday Closet (19 items)',
    descriptionDe: 'Weiße & graue T-Shirts, Bluse, Hoodie, Strickjacke, Pullover, Blazer, Trenchcoat, Jeans, Stoffhose, Rock, Sneaker & Stiefeletten',
    descriptionEn: 'White & grey tees, blouse, hoodie, cardigan, sweater, blazer, trenchcoat, jeans, trousers, skirt, sneakers & ankle boots',
    garments: SEED_WOMENSWEAR_GARMENTS,
  },
  menswear_unisex: {
    id: 'menswear_unisex',
    scope: 'menswear',
    labelDe: 'Männer-Kleiderschrank (14 normale Alltagsteile)',
    labelEn: 'Men’s Everyday Closet (14 items)',
    descriptionDe: 'T-Shirts, Langarmshirt, Strickpullover, Hemd, Hemdjacke, Regenjacke, Chino, Jeans, weiße Sneaker & Leder-Boots',
    descriptionEn: 'Tees, longsleeve, knit sweater, shirt, overshirt, rain parka, chino, jeans, white sneakers & leather boots',
    garments: SEED_WARDROBE_GARMENTS,
  },
  unisex_essentials: {
    id: 'unisex_essentials',
    scope: 'unisex',
    labelDe: 'Unisex-Basics (16 zeitlose Alltagsteile)',
    labelEn: 'Unisex Basics (16 everyday items)',
    descriptionDe: 'Bequeme Basics für jeden Tag: Hoodie, T-Shirts, Pullover, Hemdjacke, Jeans, Stoffhose & Sneaker',
    descriptionEn: 'Comfortable everyday basics: hoodie, tees, sweaters, overshirt, jeans, trousers & sneakers',
    garments: SEED_UNISEX_GARMENTS,
  },
  combined_atelier: {
    id: 'combined_atelier',
    scope: 'all',
    labelDe: 'Beides / Komplette Auswahl (31 Teile)',
    labelEn: 'Both / Complete Selection (31 items)',
    descriptionDe: 'Kombiniert alle Damen-, Herren- und Unisex-Kleidungsstücke zum freien Ausprobieren',
    descriptionEn: 'Combines all women’s, men’s and unisex garments for full exploration',
    garments: [
      ...SEED_WARDROBE_GARMENTS,
      ...SEED_WOMENSWEAR_GARMENTS.filter(
        (f) => f.id !== 'fem_orphan_1' && f.id !== 'fem_shoe_3'
      ),
    ],
  },
};

export const WARDROBE_SCOPE_META: Record<
  WardrobeScope,
  {
    labelDe: string;
    labelEn: string;
    shortDe: string;
    shortEn: string;
    descDe: string;
    descEn: string;
    defaultPreset: WardrobePresetKey;
  }
> = {
  womenswear: {
    labelDe: 'Frauen (inkl. Hoodies & Basics)',
    labelEn: 'Women (incl. Hoodies & Basics)',
    shortDe: 'Frauen',
    shortEn: 'Women',
    descDe: 'Normale Alltagskleidung für Frauen: T-Shirts, Hoodies, Pullover, Strickjacken, Blusen, Blazer, Jeans, Stoffhosen, Röcke, Sneaker & Stiefeletten.',
    descEn: 'Everyday clothes for women: tees, hoodies, sweaters, cardigans, blouses, blazers, jeans, trousers, skirts, sneakers & ankle boots.',
    defaultPreset: 'womenswear_capsule',
  },
  menswear: {
    labelDe: 'Männer (inkl. Hoodies & Basics)',
    labelEn: 'Men (incl. Hoodies & Basics)',
    shortDe: 'Männer',
    shortEn: 'Men',
    descDe: 'Normale Alltagskleidung für Männer: T-Shirts, Hoodies, Pullover, Hemden, Jacken, Chinos, Jeans, Sneaker & Boots (ohne Röcke/Blusen).',
    descEn: 'Everyday clothes for men: tees, hoodies, sweaters, shirts, jackets, chinos, jeans, sneakers & boots (no skirts/blouses).',
    defaultPreset: 'menswear_unisex',
  },
  unisex: {
    labelDe: 'Unisex (Bequeme Basics für alle)',
    labelEn: 'Unisex (Everyday Basics)',
    shortDe: 'Unisex',
    shortEn: 'Unisex',
    descDe: 'Zeitlose Klassiker wie Hoodies, T-Shirts, Sweatshirts, Pullover, Jeans, weite Stoffhosen und Sneaker.',
    descEn: 'Timeless classics like hoodies, tees, sweatshirts, sweaters, jeans, relaxed trousers and sneakers.',
    defaultPreset: 'unisex_essentials',
  },
  all: {
    labelDe: 'Beides (Alle Kleidungsstücke)',
    labelEn: 'Both (All Clothing Types)',
    shortDe: 'Beides',
    shortEn: 'Both',
    descDe: 'Alle Kleidungsstücke für Frauen, Männer und Unisex gemeinsam verfügbar.',
    descEn: 'All clothing types for women, men, and unisex available together.',
    defaultPreset: 'combined_atelier',
  },
};

export const FEMININE_ONLY_SUBCATEGORIES: GarmentSubcategory[] = [
  'blouse',
  'tank_camisole',
  'crop_top',
  'bodysuit',
  'wrap_top',
  'midi_skirt',
  'mini_skirt',
  'heeled_ankle_boot',
  'ballet_flat',
  'sandal_strappy',
];

/**
 * Checks whether a garment subcategory should be offered/recommended for the selected WardrobeScope.
 * Note: 'womenswear' includes ALL unisex items (hoodies, tees, sneakers, etc.) + womenswear items!
 */
export function isSubcategoryAllowedForScope(
  subcategory: GarmentSubcategory,
  scope: WardrobeScope = 'all'
): boolean {
  if (scope === 'all' || scope === 'womenswear') {
    return true;
  }
  // For 'menswear' and 'unisex', exclude strictly feminine silhouettes
  return !FEMININE_ONLY_SUBCATEGORIES.includes(subcategory);
}

/**
 * Smart automatic defaults for every subcategory so users don't have to configure technical fields.
 */
export const SMART_SUBCATEGORY_DEFAULTS: Record<
  GarmentSubcategory,
  {
    category: GarmentCategory;
    fit: FitType;
    neckline: NecklineType;
    texture: TextureType;
    thermalRating: 1 | 2 | 3 | 4 | 5;
    formality: 1 | 2 | 3 | 4 | 5;
    waterResistant: boolean;
  }
> = {
  // Base Tops
  t_shirt: { category: 'base_top', fit: 'regular', neckline: 'crewneck', texture: 'smooth_cotton', thermalRating: 1, formality: 2, waterResistant: false },
  heavyweight_tee: { category: 'base_top', fit: 'relaxed', neckline: 'heavy_crewneck', texture: 'heavy_jersey', thermalRating: 2, formality: 2, waterResistant: false },
  polo: { category: 'base_top', fit: 'regular', neckline: 'shirt_collar', texture: 'smooth_cotton', thermalRating: 1, formality: 3, waterResistant: false },
  longsleeve: { category: 'base_top', fit: 'regular', neckline: 'crewneck', texture: 'heavy_jersey', thermalRating: 2, formality: 2, waterResistant: false },
  blouse: { category: 'base_top', fit: 'relaxed', neckline: 'v_neck', texture: 'smooth_cotton', thermalRating: 2, formality: 3, waterResistant: false },
  tank_camisole: { category: 'base_top', fit: 'slim', neckline: 'crewneck', texture: 'fine_knit', thermalRating: 1, formality: 2, waterResistant: false },
  crop_top: { category: 'base_top', fit: 'boxy_oversized', neckline: 'crewneck', texture: 'heavy_jersey', thermalRating: 1, formality: 2, waterResistant: false },
  bodysuit: { category: 'base_top', fit: 'slim', neckline: 'crewneck', texture: 'fine_knit', thermalRating: 2, formality: 3, waterResistant: false },
  // Mid Layers
  hoodie: { category: 'mid_layer', fit: 'relaxed', neckline: 'hooded', texture: 'heavy_jersey', thermalRating: 3, formality: 2, waterResistant: false },
  crewneck_sweater: { category: 'mid_layer', fit: 'relaxed', neckline: 'crewneck', texture: 'heavy_jersey', thermalRating: 3, formality: 2, waterResistant: false },
  knit_sweater: { category: 'mid_layer', fit: 'regular', neckline: 'heavy_crewneck', texture: 'chunky_knit', thermalRating: 3, formality: 3, waterResistant: false },
  overshirt: { category: 'mid_layer', fit: 'relaxed', neckline: 'stand_collar', texture: 'twill_chino', thermalRating: 3, formality: 3, waterResistant: false },
  button_down_shirt: { category: 'mid_layer', fit: 'regular', neckline: 'shirt_collar', texture: 'smooth_cotton', thermalRating: 2, formality: 3, waterResistant: false },
  turtleneck: { category: 'mid_layer', fit: 'slim', neckline: 'turtleneck', texture: 'fine_knit', thermalRating: 3, formality: 4, waterResistant: false },
  cardigan: { category: 'mid_layer', fit: 'relaxed', neckline: 'v_neck', texture: 'chunky_knit', thermalRating: 3, formality: 3, waterResistant: false },
  blazer: { category: 'mid_layer', fit: 'relaxed', neckline: 'shirt_collar', texture: 'flannel_wool', thermalRating: 3, formality: 4, waterResistant: false },
  vest_gilet: { category: 'mid_layer', fit: 'relaxed', neckline: 'v_neck', texture: 'chunky_knit', thermalRating: 2, formality: 3, waterResistant: false },
  wrap_top: { category: 'mid_layer', fit: 'regular', neckline: 'v_neck', texture: 'fine_knit', thermalRating: 3, formality: 3, waterResistant: false },
  // Outerwear
  light_jacket: { category: 'outerwear', fit: 'regular', neckline: 'stand_collar', texture: 'tech_waterproof', thermalRating: 3, formality: 3, waterResistant: true },
  trenchcoat: { category: 'outerwear', fit: 'relaxed', neckline: 'shirt_collar', texture: 'tech_waterproof', thermalRating: 3, formality: 4, waterResistant: true },
  coat: { category: 'outerwear', fit: 'regular', neckline: 'shirt_collar', texture: 'flannel_wool', thermalRating: 4, formality: 4, waterResistant: true },
  parka: { category: 'outerwear', fit: 'relaxed', neckline: 'hooded', texture: 'tech_waterproof', thermalRating: 4, formality: 3, waterResistant: true },
  blouson: { category: 'outerwear', fit: 'regular', neckline: 'stand_collar', texture: 'leather_suede', thermalRating: 3, formality: 3, waterResistant: false },
  leather_jacket: { category: 'outerwear', fit: 'regular', neckline: 'stand_collar', texture: 'leather_suede', thermalRating: 3, formality: 3, waterResistant: false },
  puffer_jacket: { category: 'outerwear', fit: 'boxy_oversized', neckline: 'stand_collar', texture: 'tech_waterproof', thermalRating: 4, formality: 2, waterResistant: true },
  // Bottoms
  denim: { category: 'bottom', fit: 'regular', neckline: 'none', texture: 'denim', thermalRating: 3, formality: 2, waterResistant: false },
  chino: { category: 'bottom', fit: 'regular', neckline: 'none', texture: 'twill_chino', thermalRating: 2, formality: 3, waterResistant: false },
  trousers: { category: 'bottom', fit: 'regular', neckline: 'none', texture: 'flannel_wool', thermalRating: 3, formality: 4, waterResistant: false },
  wide_leg_trousers: { category: 'bottom', fit: 'relaxed', neckline: 'none', texture: 'twill_chino', thermalRating: 2, formality: 3, waterResistant: false },
  midi_skirt: { category: 'bottom', fit: 'relaxed', neckline: 'none', texture: 'smooth_cotton', thermalRating: 2, formality: 3, waterResistant: false },
  mini_skirt: { category: 'bottom', fit: 'regular', neckline: 'none', texture: 'twill_chino', thermalRating: 1, formality: 2, waterResistant: false },
  cargo: { category: 'bottom', fit: 'relaxed', neckline: 'none', texture: 'twill_chino', thermalRating: 2, formality: 2, waterResistant: false },
  shorts: { category: 'bottom', fit: 'regular', neckline: 'none', texture: 'twill_chino', thermalRating: 1, formality: 2, waterResistant: false },
  // Footwear
  sneaker_clean: { category: 'footwear', fit: 'regular', neckline: 'none', texture: 'leather_suede', thermalRating: 2, formality: 2, waterResistant: true },
  sneaker_chunky: { category: 'footwear', fit: 'regular', neckline: 'none', texture: 'leather_suede', thermalRating: 2, formality: 2, waterResistant: true },
  boots: { category: 'footwear', fit: 'regular', neckline: 'none', texture: 'leather_suede', thermalRating: 3, formality: 3, waterResistant: true },
  heeled_ankle_boot: { category: 'footwear', fit: 'regular', neckline: 'none', texture: 'leather_suede', thermalRating: 3, formality: 3, waterResistant: true },
  loafer_derby: { category: 'footwear', fit: 'regular', neckline: 'none', texture: 'leather_suede', thermalRating: 2, formality: 4, waterResistant: false },
  ballet_flat: { category: 'footwear', fit: 'regular', neckline: 'none', texture: 'leather_suede', thermalRating: 2, formality: 3, waterResistant: false },
  runner: { category: 'footwear', fit: 'regular', neckline: 'none', texture: 'tech_waterproof', thermalRating: 2, formality: 1, waterResistant: false },
  sandal_strappy: { category: 'footwear', fit: 'regular', neckline: 'none', texture: 'leather_suede', thermalRating: 1, formality: 2, waterResistant: false },
};

const CUSTOM_COLORS_STORAGE_KEY = 'atelier_custom_colors_v1';

export function loadCustomColors(): TextileColorPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomColors(colors: TextileColorPreset[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CUSTOM_COLORS_STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // ignore storage errors
  }
}

export function getAllColorPresets(): TextileColorPreset[] {
  return [...loadCustomColors(), ...TEXTILE_COLOR_PRESETS];
}

