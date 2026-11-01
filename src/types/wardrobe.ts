export type Undertone = 'cool' | 'warm' | 'neutral' | 'olive';
export type ContrastLevel = 'low' | 'medium' | 'high';
export type ChromaLevel = 'muted' | 'moderate' | 'bright';
export type ValueLevel = 'light' | 'medium' | 'dark';

export type HaircutStyle = 
  | 'short_fade_structured_top' // Crisp sides, volume on top
  | 'buzz_very_short'           // Minimal hair framing
  | 'medium_textured_flow'      // Soft edges around ears/neck
  | 'long_hair';                // Covers neck/collar area

export type FacialHair = 'clean_shaven' | 'stubble' | 'short_beard' | 'full_beard';

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
}

export type GarmentCategory = 'base_top' | 'mid_layer' | 'outerwear' | 'bottom' | 'footwear';

export type GarmentSubcategory =
  | 't_shirt' | 'heavyweight_tee' | 'polo' | 'longsleeve'
  | 'overshirt' | 'button_down_shirt' | 'crewneck_sweater' | 'knit_sweater' | 'turtleneck' | 'hoodie' | 'cardigan'
  | 'light_jacket' | 'coat' | 'parka' | 'blouson'
  | 'chino' | 'denim' | 'trousers' | 'cargo' | 'shorts'
  | 'sneaker_clean' | 'sneaker_chunky' | 'boots' | 'loafer_derby' | 'runner';

export type FitType = 'slim' | 'regular' | 'relaxed' | 'boxy_oversized';
export type NecklineType = 'crewneck' | 'heavy_crewneck' | 'v_neck' | 'stand_collar' | 'shirt_collar' | 'turtleneck' | 'hooded' | 'none';
export type TextureType = 'smooth_cotton' | 'heavy_jersey' | 'twill_chino' | 'denim' | 'chunky_knit' | 'fine_knit' | 'flannel_wool' | 'linen' | 'tech_waterproof' | 'leather_suede';

export interface Garment {
  id: string;
  name: string;
  category: GarmentCategory;
  subcategory: GarmentSubcategory;
  colorName: string;
  colorHex: string;
  // Auto-calculated on save via Color Math utility:
  hsl: { h: number; s: number; l: number };
  colorTemp: 'warm' | 'cool' | 'neutral';
  fit: FitType;
  neckline: NecklineType;
  texture: TextureType;
  thermalRating: 1 | 2 | 3 | 4 | 5; // 1 = >24°C, 2 = 18-23°C, 3 = 12-17°C, 4 = 5-11°C, 5 = <5°C
  formality: 1 | 2 | 3 | 4 | 5;     // 1 = Lounge/Sport, 2 = Casual, 3 = Smart Casual, 4 = Business/Chic, 5 = Formal
  waterResistant: boolean;
  isClean: boolean;
  isWishlistSandbox?: boolean;      // For testing hypothetical purchases
  imageDataUrl?: string;            // Optional user photo
}

export type WeatherCondition = 'sunny_dry' | 'cloudy_windy' | 'rain_wet';
export type OccasionType = 'casual' | 'smart_casual_office' | 'active_sporty' | 'date_night' | 'formal_event';

export interface OutfitContext {
  temperatureC: number;
  weather: WeatherCondition;
  occasion: OccasionType;
  lockedGarmentIds: string[];
  ignoreCleanStatus?: boolean;
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
}
