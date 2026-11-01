import {
  ContrastLevel,
  FacialHair,
  FitType,
  HaircutStyle,
  NecklineType,
  OccasionType,
  TextureType,
} from '../types/wardrobe';

/**
 * ============================================================================
 * MODULAR RULE MATRICES (`src/engine/styleRules.ts`)
 * ============================================================================
 * This file centralizes the declarative styling tables used by the deterministic
 * engine (`colorMath.ts` & `outfitGenerator.ts`).
 *
 * Open-Source Contributors:
 * - Adjust silhouette balance scores in `FIT_PROPORTION_MATRIX`
 * - Adjust temperature layering thresholds in `THERMAL_ARCHITECTURE_RULES`
 * - Adjust haircut/beard neckline framing in `HAIRCUT_NECKLINE_RULES`
 * ============================================================================
 */

/**
 * 1. Thermal Layering Architecture
 * Maps ambient temperature (°C) to required garment thermal ratings (1..5)
 * and layer counts.
 */
export const THERMAL_ARCHITECTURE_RULES = {
  summerHotThresholdC: 21, // >= 21°C: Base-Top + Bottom + Footwear (no outerwear/mid-layer)
  mildTransitionThresholdC: 14, // 14..20°C: Base-Top + Mid-Layer + Bottom + Footwear
  coldWeatherBelowC: 14, // < 14°C: 3-layer support (Base-Top + Mid-Layer + Outerwear)
} as const;

/**
 * 2. Occasion Formality Bounds (1 = Lounge/Sport .. 5 = Formal)
 */
export const OCCASION_FORMALITY_BOUNDS: Record<
  OccasionType,
  { min: number; max: number; maxInternalSpread: number }
> = {
  active_sporty: { min: 1, max: 2, maxInternalSpread: 1 },
  casual: { min: 2, max: 3, maxInternalSpread: 1 },
  smart_casual_office: { min: 3, max: 4, maxInternalSpread: 1 },
  date_night: { min: 3, max: 5, maxInternalSpread: 1 },
  formal_event: { min: 4, max: 5, maxInternalSpread: 1 },
};

/**
 * 3. Fit & Silhouette Proportion Matrix (Top Fit vs. Bottom Fit -> 0..15 pts)
 * Rewards architectural balance (e.g., relaxed/boxy top with regular/slim bottom,
 * or tailored regular-on-regular) and penalizes extreme top-to-bottom mismatch.
 */
export const FIT_PROPORTION_MATRIX: Record<FitType, Record<FitType, number>> = {
  slim: {
    slim: 13,
    regular: 15,
    relaxed: 14,
    boxy_oversized: 7,
  },
  regular: {
    slim: 14,
    regular: 15,
    relaxed: 14,
    boxy_oversized: 11,
  },
  relaxed: {
    slim: 14,
    regular: 15,
    relaxed: 12,
    boxy_oversized: 9,
  },
  boxy_oversized: {
    slim: 6, // Penalty: extreme carrot silhouette
    regular: 14,
    relaxed: 13,
    boxy_oversized: 5, // Penalty: lacks structural anchor
  },
};

/**
 * 4. Texture Categorization for Tactile Depth Scoring
 */
export const STRUCTURED_TEXTURES: readonly TextureType[] = [
  'chunky_knit',
  'fine_knit',
  'flannel_wool',
  'twill_chino',
  'denim',
  'linen',
  'leather_suede',
  'heavy_jersey',
] as const;

/**
 * 5. Biometric Contrast Targets (Lightness Delta ΔL% between Top and Bottom)
 */
export const BIOMETRIC_CONTRAST_TARGETS: Record<
  ContrastLevel,
  { idealMinDelta: number; idealMaxDelta: number; description: string }
> = {
  low: {
    idealMinDelta: 8,
    idealMaxDelta: 28,
    description: 'Tone-on-tone low lightness delta (10–25% ΔL)',
  },
  medium: {
    idealMinDelta: 25,
    idealMaxDelta: 55,
    description: 'Balanced mid lightness delta (25–55% ΔL)',
  },
  high: {
    idealMinDelta: 50,
    idealMaxDelta: 90,
    description: 'Crisp high lightness delta (>50% ΔL)',
  },
};

/**
 * 6. Haircut & Facial Hair Framing Rules for Upper-Body Necklines
 */
export const HAIRCUT_NECKLINE_RULES: Record<
  HaircutStyle,
  { favoredNecklines: NecklineType[]; favoredTextures: TextureType[]; bonusPts: number }
> = {
  short_fade_structured_top: {
    favoredNecklines: ['heavy_crewneck', 'stand_collar', 'shirt_collar', 'turtleneck'],
    favoredTextures: ['heavy_jersey', 'twill_chino', 'chunky_knit', 'flannel_wool'],
    bonusPts: 10,
  },
  buzz_very_short: {
    favoredNecklines: ['heavy_crewneck', 'turtleneck', 'hooded', 'stand_collar'],
    favoredTextures: ['heavy_jersey', 'chunky_knit', 'tech_waterproof'],
    bonusPts: 10,
  },
  medium_textured_flow: {
    favoredNecklines: ['shirt_collar', 'crewneck', 'v_neck', 'stand_collar'],
    favoredTextures: ['fine_knit', 'linen', 'flannel_wool', 'leather_suede'],
    bonusPts: 9,
  },
  long_hair: {
    favoredNecklines: ['v_neck', 'shirt_collar', 'crewneck'],
    favoredTextures: ['smooth_cotton', 'denim', 'leather_suede', 'linen'],
    bonusPts: 8,
  },
};

export const FACIAL_HAIR_TEXTURE_BONUS: Record<FacialHair, TextureType[]> = {
  clean_shaven: ['smooth_cotton', 'fine_knit', 'tech_waterproof'],
  stubble: ['heavy_jersey', 'twill_chino', 'fine_knit', 'denim'],
  short_beard: ['chunky_knit', 'flannel_wool', 'twill_chino', 'leather_suede'],
  full_beard: ['chunky_knit', 'flannel_wool', 'denim', 'leather_suede'],
};
