export type Undertone = 'cool' | 'warm' | 'neutral' | 'olive';
export type ContrastLevel = 'low' | 'medium' | 'high';
export type ChromaLevel = 'muted' | 'moderate' | 'bright';
export type ValueLevel = 'light' | 'medium' | 'dark';

export type AppLocale = 'de' | 'en';

export type WardrobeScopeTarget = 'womenswear' | 'menswear' | 'unisex';
export type WardrobeScope = 'womenswear' | 'menswear' | 'unisex' | 'all';

export type HaircutStyle = 
  | 'short_fade_structured_top' // Crisp sides, volume on top
  | 'buzz_very_short'           // Minimal hair framing
  | 'medium_textured_flow'      // Soft edges around ears/neck
  | 'long_hair';                // Covers neck/collar area

export type FacialHair = 'clean_shaven' | 'stubble' | 'short_beard' | 'full_beard';

export interface DefaultSizes {
  top?: string;
  bottom?: string;
  shoes?: string;
}

export interface BrandSizeRule {
  brand: string;
  size: string;
  categoryGroup?: 'all' | 'top' | 'bottom' | 'shoes' | 'accessory';
}

export interface BiometricProfile {
  id: string;
  undertone: Undertone;
  contrastLevel: ContrastLevel;
  chromaLevel: ChromaLevel;
  valueLevel: ValueLevel;
  skinHex: string;
  eyeColorName: string;
  eyeHex: string;
  hairColorName: string;
  hairHex: string;
  haircutStyle: HaircutStyle;
  facialHair: FacialHair;
  preferredFit: 'slim_tapered' | 'regular_tailored' | 'relaxed_boxy';
  wardrobeScope?: WardrobeScope;
  wardrobeScopes?: WardrobeScopeTarget[];
  defaultSizes?: DefaultSizes;
  brandSizeRules?: BrandSizeRule[];
  isDemoMode?: boolean;
  /**
   * Subcategories that automatically get marked as "In der Wäsche" (isClean = false)
   * when an outfit is logged as worn ("Heute anziehen").
   * Default: ['t_shirt', 'heavyweight_tee', 'longsleeve', 'polo', 'tank_camisole', 'crop_top', 'bodysuit', 'socks', 'socks_short']
   */
  autoLaundrySubcategories?: GarmentSubcategory[];
  customColors?: Array<{
    name: string;
    hex: string;
    group: 'Neutrals' | 'Earth & Olive' | 'Blue & Cool' | 'Accent';
  }>;
  customOccasions?: CustomOccasion[];
  defaultStylePreferences?: DefaultStylePreferences;
  favoriteOutfits?: FavoriteOutfitRecord[];
}

export type GarmentCategory = 'base_top' | 'mid_layer' | 'outerwear' | 'bottom' | 'footwear' | 'accessory';

export type GarmentSubcategory =
  // Base Tops (Menswear, Womenswear & Unisex)
  | 't_shirt' | 'heavyweight_tee' | 'polo' | 'longsleeve'
  | 'button_down_shirt' | 'short_sleeve_shirt'
  | 'blouse' | 'tank_camisole' | 'crop_top' | 'bodysuit'
  // Mid Layers
  | 'overshirt' | 'crewneck_sweater' | 'knit_sweater' | 'turtleneck' | 'hoodie' | 'cardigan'
  | 'blazer' | 'vest_gilet' | 'fleece_vest' | 'wrap_top'
  // Outerwear
  | 'light_jacket' | 'coat' | 'parka' | 'blouson'
  | 'trenchcoat' | 'leather_jacket' | 'puffer_jacket' | 'down_jacket' | 'fleece_jacket' | 'rain_jacket'
  // Bottoms & Skirts
  | 'chino' | 'denim' | 'trousers' | 'suit_trousers' | 'cargo' | 'shorts'
  | 'wide_leg_trousers' | 'midi_skirt' | 'mini_skirt'
  // Footwear
  | 'sneaker_clean' | 'sneaker_chunky' | 'boots' | 'loafer_derby' | 'runner'
  | 'heeled_ankle_boot' | 'ballet_flat' | 'sandal_strappy'
  // Accessories (Uhren, Brillen, Sonnenbrillen, Ketten, Armbänder, Gürtel, Taschen, Lange & Kurze Socken, Mütze, Cap etc.)
  | 'watch' | 'glasses' | 'sunglasses' | 'necklace' | 'bracelet' | 'belt' | 'bag_backpack' | 'scarf' | 'cap' | 'beanie' | 'cap_beanie' | 'socks' | 'socks_short';

export type FitType = 'slim' | 'regular' | 'relaxed' | 'boxy_oversized';
export type NecklineType = 'crewneck' | 'heavy_crewneck' | 'v_neck' | 'stand_collar' | 'shirt_collar' | 'turtleneck' | 'hooded' | 'none';
export type TextureType =
  | 'smooth_cotton'
  | 'heavy_jersey'
  | 'twill_chino'
  | 'denim'
  | 'chunky_knit'
  | 'fine_knit'
  | 'flannel_wool'
  | 'fleece'
  | 'down_quilted'
  | 'linen'
  | 'tech_waterproof'
  | 'leather_suede';

export type GarmentPattern =
  | 'solid'
  | 'checked'
  | 'pinstripe'
  | 'striped'
  | 'herringbone'
  | 'dotted';

export interface Garment {
  id: string;
  name: string;
  category: GarmentCategory;
  subcategory: GarmentSubcategory;
  colorName: string;
  colorHex: string;
  accentColorName?: string;         // Optional secondary/accent color name (e.g. colored stripes/heel tab on white sneakers or check/stripe color on trousers)
  accentColorHex?: string;          // Optional secondary/accent color hex (#RRGGBB)
  pattern?: GarmentPattern;         // Optional pattern (Uni, Kariert, Nadelstreifen, Gestreift, Fischgrät, Gepunktet)
  // Auto-calculated on save via Color Math utility:
  hsl: { h: number; s: number; l: number };
  colorTemp: 'warm' | 'cool' | 'neutral';
  fit: FitType;
  neckline: NecklineType;
  texture: TextureType;
  thermalRating: 1 | 2 | 3 | 4 | 5; // 1 = >24°C, 2 = 18-23°C, 3 = 12-17°C, 4 = 5-11°C, 5 = <5°C
  thermalRatings?: Array<1 | 2 | 3 | 4 | 5>; // Optional multi-select warmth levels
  formality: 1 | 2 | 3 | 4 | 5;     // 1 = Lounge/Sport, 2 = Casual, 3 = Smart Casual, 4 = Business/Chic, 5 = Formal
  formalities?: Array<1 | 2 | 3 | 4 | 5>;    // Optional multi-select occasion formalities
  waterResistant: boolean;
  windproof?: boolean;              // Winddicht tag
  rainproof?: boolean;              // Regenfest / Wasserdicht tag
  hasPrint?: boolean;               // Mit Print / Grafik-Motiv (T-Shirts, Pullover, Hoodies)
  hasLogo?: boolean;                // Mit sichtbarem Marken-Logo / Brust-Logo
  wornOpen?: boolean;               // Dynamically set by outfitGenerator for wearing recommendation (Offen vs. Geschlossen)
  targetScope?: WardrobeScopeTarget;
  isClean: boolean;
  brand?: string;                   // Optional brand tag (e.g. "Nike", "Adidas", "Levi's", "Zara")
  size?: string;                    // Optional garment size (e.g. "M", "L", "38", "W32/L32", "42")
  buyUrl?: string;                  // Optional product/brand shop URL
  isWishlistSandbox?: boolean;      // For testing hypothetical purchases
  imageDataUrl?: string;            // Optional user photo
  wearCount?: number;               // How many times this piece has been worn (0+)
  lastWornDate?: string;            // ISO date string when this piece was last worn
}

export type WeatherCondition = 'sunny_dry' | 'cloudy_windy' | 'rain_wet';
export type OccasionType =
  | 'homeoffice_lounge'
  | 'casual'
  | 'smart_casual_office'
  | 'city_cafe'
  | 'outdoor_walk'
  | 'beach_vacation'
  | 'active_sporty'
  | 'date_night'
  | 'formal_event';

export type OutfitModifier =
  | 'rainproof'
  | 'windproof'
  | 'layered_open'
  | 'extra_comfort'
  | 'clean_no_print'
  | 'monochrome_calm'
  | 'color_accent';

export interface CustomOccasion {
  id: string;
  name: string;
  formalities: Array<1 | 2 | 3 | 4 | 5>;
  defaultModifiers?: OutfitModifier[];
}

export interface DefaultStylePreferences {
  colorHarmony?: 'monochrome_calm' | 'balanced' | 'color_accent';
  preferredModifiers?: OutfitModifier[];
}

/**
 * Deterministic Style Direction / Aesthetic Vibe
 */
export type StyleVibe =
  | 'balanced'            // Default biometric & contextual balance
  | 'minimal_capsule'     // Quiet Luxury / Monochrome & tonal capsule purity
  | 'statement_editorial' // High-impact power color focal point + architectural silhouette
  | 'tailored_chic'       // Structured tailoring, blazers, trench, pleated/wide-leg, fine knits
  | 'street_relaxed';     // Relaxed/boxy cuts, overshirts, denim/cargo, sneakers/boots

export interface OutfitContext {
  temperatureC: number;
  weather: WeatherCondition;
  occasion: OccasionType;
  customOccasionId?: string;
  styleVibe?: StyleVibe;
  activeModifiers?: OutfitModifier[];
  lockedGarmentIds: string[];
  ignoreCleanStatus?: boolean;
  /**
   * Master toggle: whether accessories (socks, cap/beanie, bracelet, watch, etc.)
   * should be included in outfit suggestions (default: true).
   */
  includeAccessories?: boolean;
  /**
   * Specific accessory subcategories excluded from automatic outfit suggestions
   * (e.g. ['cap_beanie', 'bracelet', 'socks']).
   */
  excludedAccessorySubcategories?: GarmentSubcategory[];
  /**
   * Optional seed/offset incremented when the user clicks "Neue Outfits generieren"
   * to surface fresh valid outfit combinations.
   */
  variationSeed?: number;
}

export interface ColorSwatchSpec {
  name: string;
  hex: string;
  categoryHint?: string;
}

export interface SeasonPalette {
  seasonName: string;
  seasonSubtitle: string;
  description: string;
  powerColors: ColorSwatchSpec[]; // 12 curated Power Color Hexes
  coreNeutrals: ColorSwatchSpec[]; // 6 Core Neutral Hexes
  avoidColors: ColorSwatchSpec[]; // 6 Avoid Color Hexes
  recommendedNecklines: {
    neckline: NecklineType;
    label: string;
    reason: string;
  }[];
}

export interface BiometricScoreResult {
  score: number; // 0 - 100
  weightMultiplier: number; // 1.0 for upper body, 0.2 for bottom/footwear
  reasons: string[];
  breakdown: {
    baseScore: number;
    undertoneDelta: number;
    chromaDelta: number;
    eyeBonus: number;
    haircutNecklineDelta: number;
    textureFacialHairBonus: number;
  };
}

export interface GeneratedOutfit {
  id: string;
  items: Garment[];
  totalScore: number; // 0 - 100
  breakdown: {
    biometricBase: number;      // weighted out of 35
    contrastCalibration: number;// out of 20
    colorHarmony: number;       // out of 20
    silhouetteBalance: number;  // out of 15
    textureContrast: number;    // out of 10
    rawBiometricAvg: number;    // 0 - 100
    lightnessDelta: number;     // percentage delta
  };
  traces: string[];
}

export interface OrphanPieceAnalysis {
  garment: Garment;
  biometricScore: number;
  validOutfitCount: number;
  isolationReasons: string[];
}

export interface ContextBottleneck {
  id: string;
  label: string;
  temperatureC: number;
  tempLabel: string;
  occasion: OccasionType;
  occasionLabel: string;
  weather: WeatherCondition;
  validOutfitCount: number;
  isBottleneck: boolean;
  message?: string;
}

export interface ArchetypeRecommendation {
  archetypeId: string;
  virtualGarment: Garment;
  roiScore: number;
  newOutfitsUnlocked: number;
  orphansRescued: Garment[];
  unlockedCombinationsPreview: GeneratedOutfit[];
  rationale: string;
}

export interface GapAnalysisReport {
  totalValidOutfitsAcrossContexts: number;
  wardrobeHealthScore: number;
  contextMatrix: ContextBottleneck[];
  bottlenecks: ContextBottleneck[];
  orphanPieces: OrphanPieceAnalysis[];
  outfitCountsByGarmentId: Record<string, number>;
  recommendations: ArchetypeRecommendation[];
  recommendationsByCategory?: Partial<Record<GarmentCategory, ArchetypeRecommendation[]>>;
}

export interface WornOutfitRecord {
  id: string;
  wornDate: string; // ISO timestamp
  outfitTitle: string;
  garmentIds: string[];
  dirtyMarkedGarmentIds?: string[];
  garments: Garment[];
  contextSummary?: {
    temperatureC?: number;
    weather?: WeatherCondition;
    occasion?: OccasionType;
    styleVibe?: StyleVibe;
  };
  totalScore?: number;
}

export interface FavoriteOutfitRecord {
  id: string;
  title: string;
  garmentIds: string[];
  garments: Garment[];
  savedAt: string; // ISO timestamp
  totalScore?: number;
  occasion?: OccasionType;
  temperatureC?: number;
}
