import {
   isSubcategoryAllowedForScope,
  normalizeWardrobeScopes,
  OCCASION_LABELS,
  OCCASION_LABELS_EN,
} from '../data/seedData';
import {
  BiometricProfile,
  Garment,
  GarmentCategory,
  GeneratedOutfit,
  OccasionType,
  OutfitContext,
  TravelDayOutfit,
  TravelLuggageSpace,
  TravelPackConfig,
  TravelPackedItemUsage,
  TravelPackPlan,
  TravelTripType,
} from '../types/wardrobe';
import { getShortOutfitTitle } from './brandSizeMatcher';
import { getHueDistance, isWardrobeNeutral, scoreGarmentBiometrics } from './colorMath';
import { generateOutfitsForContext, isGarmentWaterResistant } from './outfitGenerator';

export interface TravelTripTypeMetadata {
  id: TravelTripType;
  labelDe: string;
  labelEn: string;
  descDe: string;
  descEn: string;
  primaryOccasions: OccasionType[];
  eveningOccasion: OccasionType;
}

export const TRAVEL_TRIP_TYPE_META: Record<TravelTripType, TravelTripTypeMetadata> = {
  city_trip: {
    id: 'city_trip',
    labelDe: 'Städtetrip & Sightseeing',
    labelEn: 'City Trip & Sightseeing',
    descDe: 'Bequem für viele Schritte tagsüber, gepflegt für Café & Restaurant am Abend',
    descEn: 'Comfortable for walking all day, smart for cafés & dinner in the evening',
    primaryOccasions: ['city_cafe', 'casual'],
    eveningOccasion: 'date_night',
  },
  mixed_vacation: {
    id: 'mixed_vacation',
    labelDe: 'Urlaub & Freizeit (Mix)',
    labelEn: 'All-Round Vacation',
    descDe: 'Vielseitiger Mix aus entspannten Tages-Outfits und schönen Abend-Looks',
    descEn: 'Versatile mix of relaxed daytime outfits and smart evening looks',
    primaryOccasions: ['casual', 'city_cafe', 'outdoor_walk'],
    eveningOccasion: 'date_night',
  },
  beach_sun: {
    id: 'beach_sun',
    labelDe: 'Strand & Sommerurlaub',
    labelEn: 'Beach & Sun Vacation',
    descDe: 'Luftige Schnitte, leichte Stoffe und entspannte Urlaubs-Kombinationen',
    descEn: 'Breezy cuts, lightweight fabrics, and relaxed holiday combinations',
    primaryOccasions: ['beach_vacation', 'casual', 'city_cafe'],
    eveningOccasion: 'city_cafe',
  },
  business_trip: {
    id: 'business_trip',
    labelDe: 'Geschäftsreise & Büro',
    labelEn: 'Business & Work Trip',
    descDe: 'Seriöse, knitterarme Kombinationen für Termine, Büro und Geschäftsessen',
    descEn: 'Polished combinations for meetings, office days, and business dinners',
    primaryOccasions: ['smart_casual_office', 'city_cafe'],
    eveningOccasion: 'date_night',
  },
  outdoor_nature: {
    id: 'outdoor_nature',
    labelDe: 'Natur & Aktivurlaub',
    labelEn: 'Nature & Active Trip',
    descDe: 'Wetterfeste Schichten, praktische Hosen und bequeme Schuhe für draußen',
    descEn: 'Weather-ready layers, practical bottoms, and comfortable footwear',
    primaryOccasions: ['outdoor_walk', 'casual', 'active_sporty'],
    eveningOccasion: 'casual',
  },
};

export interface TravelLuggageSpaceMetadata {
  id: TravelLuggageSpace;
  labelDe: string;
  labelEn: string;
  descDe: string;
  descEn: string;
}

export const TRAVEL_LUGGAGE_SPACE_META: Record<
  TravelLuggageSpace,
  TravelLuggageSpaceMetadata
> = {
  minimal: {
    id: 'minimal',
    labelDe: 'Wenig Platz (Handgepäck)',
    labelEn: 'Minimal (Carry-On)',
    descDe: 'Minimale Teile-Anzahl, maximale Kombinierbarkeit (z. B. 2 Hosen für 7 Tage)',
    descEn: 'Minimum items, maximum mix-and-match (e.g. 2 bottoms for 7 days)',
  },
  balanced: {
    id: 'balanced',
    labelDe: 'Normal (Kompaktkoffer)',
    labelEn: 'Balanced (Standard)',
    descDe: 'Ideale Balance aus leichtem Gepäck und frischen Oberteilen für jeden Tag',
    descEn: 'Ideal balance of light packing and fresh tops for every day',
  },
  spacious: {
    id: 'spacious',
    labelDe: 'Viel Platz (Großer Koffer)',
    labelEn: 'Spacious (Large Suitcase)',
    descDe: 'Mehr Auswahl bei Hosen, Schuhen und Schichten für maximale Abwechslung',
    descEn: 'Extra variety in bottoms, shoes, and layers for maximum choice',
  },
};

export function computeTravelCategoryTargets(
  days: number,
  luggageSpace: TravelLuggageSpace,
  temperatureC: number,
  weather: OutfitContext['weather']
): TravelPackPlan['categoryTargets'] {
  const clampedDays = Math.max(2, Math.min(14, Math.round(days)));

  let bottoms = 2;
  let footwear = 2;
  let baseTops = clampedDays;
  let midLayers = 2;
  let outerwear = 1;

  if (luggageSpace === 'minimal') {
    bottoms = clampedDays <= 3 ? 1 : clampedDays <= 8 ? 2 : 3;
    footwear = clampedDays <= 4 ? 1 : 2;
    baseTops = Math.max(2, Math.min(clampedDays, Math.ceil(clampedDays * 0.75)));
    midLayers = temperatureC >= 24 ? 1 : clampedDays <= 4 ? 1 : 2;
    outerwear = temperatureC >= 23 && weather === 'sunny_dry' ? 0 : 1;
  } else if (luggageSpace === 'balanced') {
    bottoms = clampedDays <= 2 ? 1 : clampedDays <= 7 ? 2 : clampedDays <= 11 ? 3 : 4;
    footwear = clampedDays <= 2 ? 1 : 2;
    baseTops = clampedDays;
    midLayers = temperatureC >= 24 ? 1 : clampedDays <= 6 ? 2 : 3;
    outerwear =
      temperatureC >= 24 && weather === 'sunny_dry'
        ? 0
        : clampedDays >= 8 && temperatureC <= 14
        ? 2
        : 1;
  } else {
    // spacious
    bottoms = clampedDays <= 3 ? 2 : clampedDays <= 7 ? 3 : clampedDays <= 11 ? 4 : 5;
    footwear = clampedDays <= 4 ? 2 : 3;
    baseTops = Math.min(14, clampedDays + (clampedDays >= 5 ? 1 : 0));
    midLayers = temperatureC >= 24 ? 2 : clampedDays <= 5 ? 2 : 3;
    outerwear = temperatureC >= 24 && weather === 'sunny_dry' ? 1 : 2;
  }

  if (weather === 'rain_wet' && outerwear === 0) {
    outerwear = 1;
  }

  return {
    bottoms,
    footwear,
    baseTops,
    midLayers,
    outerwear,
  };
}

function scorePieceForTripCapsule(
  g: Garment,
  profile: BiometricProfile,
  config: TravelPackConfig,
  anchorColors: Garment[]
): number {
  const bio = scoreGarmentBiometrics(g, profile).score;
  let score = bio * 0.55;

  // Neutral pieces are the backbone of a travel capsule because they match everything
  if (isWardrobeNeutral(g.hsl, g.colorTemp)) {
    score += g.category === 'bottom' || g.category === 'footwear' || g.category === 'outerwear'
      ? 24
      : 14;
  }

  // Solid / subtle patterns are much easier to cross-combine across 7 days
  if (!g.pattern || g.pattern === 'solid') {
    score += 8;
  }
  if (!g.hasPrint) {
    score += 5;
  }

  // Temperature appropriateness
  const temp = config.temperatureC;
  const targetThermal =
    temp >= 23 ? 1 : temp >= 17 ? 2 : temp >= 11 ? 3 : temp >= 5 ? 4 : 5;
  const ratings =
    Array.isArray(g.thermalRatings) && g.thermalRatings.length > 0
      ? g.thermalRatings
      : [g.thermalRating];
  const minThermalDiff = Math.min(...ratings.map((r) => Math.abs(r - targetThermal)));
  score += Math.max(0, 16 - minThermalDiff * 7);

  // Weather appropriateness
  if (config.weather === 'rain_wet') {
    if (isGarmentWaterResistant(g)) score += 16;
    if (g.texture === 'leather_suede' && !g.waterResistant) score -= 12;
  } else if (config.weather === 'cloudy_windy') {
    if (g.windproof || g.rainproof || g.waterResistant) score += 10;
  }

  // Trip type alignment
  const formalities =
    Array.isArray(g.formalities) && g.formalities.length > 0
      ? g.formalities
      : [g.formality];

  if (config.tripType === 'business_trip') {
    if (formalities.some((f) => f >= 3 && f <= 4)) score += 18;
    if (
      g.subcategory === 'shorts' ||
      g.subcategory === 'hoodie' ||
      g.subcategory === 'cargo'
    ) {
      score -= 22;
    }
  } else if (config.tripType === 'beach_sun') {
    if (
      g.subcategory === 'shorts' ||
      g.subcategory === 't_shirt' ||
      g.subcategory === 'short_sleeve_shirt' ||
      g.subcategory === 'polo' ||
      g.texture === 'linen' ||
      g.texture === 'smooth_cotton'
    ) {
      score += 15;
    }
  } else if (config.tripType === 'outdoor_nature') {
    if (
      g.subcategory === 'cargo' ||
      g.subcategory === 'denim' ||
      g.subcategory === 'fleece_jacket' ||
      g.subcategory === 'rain_jacket' ||
      g.subcategory === 'boots' ||
      g.subcategory === 'runner' ||
      g.waterResistant ||
      g.windproof
    ) {
      score += 16;
    }
  } else if (config.tripType === 'city_trip' || config.tripType === 'mixed_vacation') {
    if (formalities.some((f) => f === 2 || f === 3)) score += 14;
    if (
      g.subcategory === 'chino' ||
      g.subcategory === 'denim' ||
      g.subcategory === 'trousers' ||
      g.subcategory === 'sneaker_clean' ||
      g.subcategory === 'loafer_derby' ||
      g.subcategory === 'overshirt' ||
      g.subcategory === 'cardigan'
    ) {
      score += 10;
    }
  }

  // Color harmony with already selected capsule anchor items (bottoms & shoes)
  if (anchorColors.length > 0) {
    let harmonySum = 0;
    for (const anchor of anchorColors) {
      if (
        isWardrobeNeutral(g.hsl, g.colorTemp) ||
        isWardrobeNeutral(anchor.hsl, anchor.colorTemp)
      ) {
        harmonySum += 10;
      } else {
        const hueDist = getHueDistance(g.hsl.h, anchor.hsl.h);
        if (hueDist <= 35 || (hueDist >= 145 && hueDist <= 215)) {
          harmonySum += 9;
        } else if (hueDist <= 65) {
          harmonySum += 4;
        } else {
          harmonySum -= 6;
        }
      }
    }
    score += harmonySum / anchorColors.length;
  }

  return score;
}

function selectTopDiverseGarments(
  candidates: Garment[],
  targetCount: number,
  lockedIds: Set<string>,
  profile: BiometricProfile,
  config: TravelPackConfig,
  anchorColors: Garment[],
  variationSeed: number
): Garment[] {
  if (targetCount <= 0 || candidates.length === 0) return [];

  const locked = candidates.filter((g) => lockedIds.has(g.id));
  const selected: Garment[] = [...locked.slice(0, targetCount)];
  const selectedIds = new Set(selected.map((g) => g.id));

  const remainingScored = candidates
    .filter((g) => !selectedIds.has(g.id))
    .map((g, idx) => {
      const baseScore = scorePieceForTripCapsule(g, profile, config, anchorColors);
      // Small deterministic variation offset so "Neu würfeln" explores top-tier alternatives
      const seedJitter =
        variationSeed > 0 ? (((idx * 7 + variationSeed * 13) % 9) - 4) * 1.4 : 0;
      return { garment: g, score: baseScore + seedJitter };
    })
    .sort((a, b) => b.score - a.score);

  while (selected.length < targetCount && remainingScored.length > 0) {
    // Prefer color & subcategory diversity among high-scoring candidates
    let bestIdx = 0;
    let bestAdjusted = -Infinity;

    for (let i = 0; i < remainingScored.length; i++) {
      const cand = remainingScored[i];
      let penalty = 0;
      for (const already of selected) {
        if (
          already.subcategory === cand.garment.subcategory &&
          already.colorHex.toLowerCase() === cand.garment.colorHex.toLowerCase()
        ) {
          penalty += 18;
        } else if (already.colorHex.toLowerCase() === cand.garment.colorHex.toLowerCase()) {
          penalty += 7;
        } else if (already.subcategory === cand.garment.subcategory) {
          penalty += 3;
        }
      }
      const adjusted = cand.score - penalty;
      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIdx = i;
      }
    }

    const [picked] = remainingScored.splice(bestIdx, 1);
    selected.push(picked.garment);
  }

  return selected;
}

/**
 * Generates a complete, cross-compatible Travel Capsule & Day-by-Day Outfit Plan.
 */
export function generateTravelCapsule(
  garments: Garment[],
  profile: BiometricProfile,
  config: TravelPackConfig
): TravelPackPlan {
  const days = Math.max(2, Math.min(14, Math.round(config.days || 7)));
  const variationSeed = config.variationSeed || 0;
  const lockedIds = new Set(config.lockedGarmentIds || []);
  const includeLaundry = config.includeLaundryItems !== false;
  const activeScopes = normalizeWardrobeScopes(profile);

  const eligible = garments.filter((g) => {
    if (lockedIds.has(g.id)) return true;
    if (!includeLaundry && !g.isClean) return false;
    if (!isSubcategoryAllowedForScope(g.subcategory, activeScopes)) {
      return false;
    }
    return true;
  });

  const categoryTargets = computeTravelCategoryTargets(
    days,
    config.luggageSpace,
    config.temperatureC,
    config.weather
  );

  const byCat: Record<GarmentCategory, Garment[]> = {
    bottom: eligible.filter((g) => g.category === 'bottom'),
    footwear: eligible.filter((g) => g.category === 'footwear'),
    base_top: eligible.filter((g) => g.category === 'base_top'),
    mid_layer: eligible.filter((g) => g.category === 'mid_layer'),
    outerwear: eligible.filter((g) => g.category === 'outerwear'),
    accessory: eligible.filter((g) => g.category === 'accessory'),
  };

  // Step 1: Select versatile anchor bottoms & footwear first
  const packedBottoms = selectTopDiverseGarments(
    byCat.bottom,
    categoryTargets.bottoms,
    lockedIds,
    profile,
    config,
    [],
    variationSeed
  );

  const packedFootwear = selectTopDiverseGarments(
    byCat.footwear,
    categoryTargets.footwear,
    lockedIds,
    profile,
    config,
    packedBottoms,
    variationSeed
  );

  const anchorPieces = [...packedBottoms, ...packedFootwear];

  // Step 2: Select outerwear & mid-layers that match ALL chosen bottoms & footwear
  const packedOuterwear = selectTopDiverseGarments(
    byCat.outerwear,
    categoryTargets.outerwear,
    lockedIds,
    profile,
    config,
    anchorPieces,
    variationSeed
  );

  const packedMidLayers = selectTopDiverseGarments(
    byCat.mid_layer,
    categoryTargets.midLayers,
    lockedIds,
    profile,
    config,
    [...anchorPieces, ...packedOuterwear],
    variationSeed
  );

  // Step 3: Select base tops that cross-combine with the bottoms, footwear & mid-layers
  const packedBaseTops = selectTopDiverseGarments(
    byCat.base_top,
    categoryTargets.baseTops,
    lockedIds,
    profile,
    config,
    [...anchorPieces, ...packedMidLayers],
    variationSeed
  );

  // Step 4: Select compact travel accessories (socks + watch/belt/sunglasses + weather headwear)
  const packedAccessories: Garment[] = [];
  const socks = byCat.accessory.filter(
    (a) => a.subcategory === 'socks' || a.subcategory === 'socks_short'
  );
  if (socks.length > 0) {
    packedAccessories.push(...socks.slice(0, Math.min(2, socks.length)));
  }
  const watchOrBelt = byCat.accessory.filter(
    (a) => a.subcategory === 'watch' || a.subcategory === 'belt'
  );
  if (watchOrBelt.length > 0) {
    packedAccessories.push(...watchOrBelt.slice(0, 2));
  }
  if (config.temperatureC >= 15 && config.weather !== 'rain_wet') {
    const sunAcc = byCat.accessory.filter(
      (a) => a.subcategory === 'sunglasses' || a.subcategory === 'cap'
    );
    packedAccessories.push(...sunAcc.slice(0, 2));
  } else if (config.temperatureC <= 11) {
    const coldAcc = byCat.accessory.filter(
      (a) => a.subcategory === 'beanie' || a.subcategory === 'scarf'
    );
    packedAccessories.push(...coldAcc.slice(0, 2));
  }

  const initialCapsulePool: Garment[] = [
    ...packedBottoms,
    ...packedFootwear,
    ...packedBaseTops,
    ...packedMidLayers,
    ...packedOuterwear,
    ...packedAccessories,
  ];

  // Ensure every item in the capsule pool is treated as clean for multi-day simulation
  const cleanCapsulePool = initialCapsulePool.map((g) => ({ ...g, isClean: true }));

  const tripMeta = TRAVEL_TRIP_TYPE_META[config.tripType] || TRAVEL_TRIP_TYPE_META.city_trip;
  const primaryOccasions = tripMeta.primaryOccasions;
  const eveningOccasion = tripMeta.eveningOccasion;

  // Pre-generate candidate outfits for each occasion from the capsule pool
  const poolByOccasion = new Map<OccasionType, GeneratedOutfit[]>();
  const allRelevantOccasions = Array.from(
    new Set<OccasionType>([...primaryOccasions, eveningOccasion, 'casual'])
  );

  for (const occ of allRelevantOccasions) {
    const ctx: OutfitContext = {
      temperatureC: config.temperatureC,
      weather: config.weather,
      occasion: occ,
      lockedGarmentIds: [],
      ignoreCleanStatus: true,
      variationSeed,
    };
    let generated = generateOutfitsForContext(cleanCapsulePool, profile, ctx, 24);
    // Fallback if strict occasion filter yielded 0 in a small capsule: relax to casual or full closet
    if (generated.length === 0) {
      generated = generateOutfitsForContext(
        cleanCapsulePool,
        profile,
        { ...ctx, occasion: 'casual' },
        24
      );
    }
    if (generated.length === 0 && eligible.length > 0) {
      generated = generateOutfitsForContext(
        eligible.map((g) => ({ ...g, isClean: true })),
        profile,
        { ...ctx, occasion: 'casual' },
        24
      );
    }
    poolByOccasion.set(occ, generated);
  }

  // Count total distinct valid combinations possible from the suitcase
  const distinctComboIds = new Set<string>();
  for (const list of poolByOccasion.values()) {
    for (const o of list) {
      distinctComboIds.add(o.id);
    }
  }

  // Step 5: Build Day-by-Day schedule (Day 1 .. Day N) with active rotation of bottoms & tops
  const dailyOutfits: TravelDayOutfit[] = [];
  const usedOutfitIds = new Set<string>();
  const topUsageCount = new Map<string, number>();
  const bottomUsageCount = new Map<string, number>();
  let prevBottomId: string | null = null;
  let prevTopId: string | null = null;

  for (let d = 1; d <= days; d++) {
    const isEveningDay =
      Boolean(config.includeEveningLook) &&
      days >= 3 &&
      (d === Math.min(days, 3) || (days >= 6 && d === days - 1));

    const dayOccasion: OccasionType = isEveningDay
      ? eveningOccasion
      : primaryOccasions[(d - 1 + variationSeed) % primaryOccasions.length];

    const candidates =
      poolByOccasion.get(dayOccasion) ||
      poolByOccasion.get(primaryOccasions[0]) ||
      poolByOccasion.get('casual') ||
      [];

    let chosenOutfit: GeneratedOutfit | undefined;
    let bestRotationScore = -Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      const topItem = cand.items.find((it) => it.category === 'base_top');
      const bottomItem = cand.items.find((it) => it.category === 'bottom');

      let rotScore = cand.totalScore;

      // Strongly prefer not repeating the exact same outfit
      if (!usedOutfitIds.has(cand.id)) {
        rotScore += 35;
      }

      // Rotate bottoms on consecutive days when 2+ bottoms are packed
      if (bottomItem) {
        if (packedBottoms.length > 1 && bottomItem.id === prevBottomId) {
          rotScore -= 22;
        }
        rotScore -= (bottomUsageCount.get(bottomItem.id) || 0) * 6;
      }

      // Rotate base tops so every packed top gets worn before repeating
      if (topItem) {
        if (packedBaseTops.length > 1 && topItem.id === prevTopId) {
          rotScore -= 30;
        }
        rotScore -= (topUsageCount.get(topItem.id) || 0) * 18;
      }

      if (rotScore > bestRotationScore) {
        bestRotationScore = rotScore;
        chosenOutfit = cand;
      }
    }

    if (!chosenOutfit && candidates.length > 0) {
      chosenOutfit = candidates[(d - 1) % candidates.length];
    }

    if (chosenOutfit) {
      usedOutfitIds.add(chosenOutfit.id);
      const topItem = chosenOutfit.items.find((it) => it.category === 'base_top');
      const bottomItem = chosenOutfit.items.find((it) => it.category === 'bottom');
      if (topItem) {
        prevTopId = topItem.id;
        topUsageCount.set(topItem.id, (topUsageCount.get(topItem.id) || 0) + 1);
      }
      if (bottomItem) {
        prevBottomId = bottomItem.id;
        bottomUsageCount.set(bottomItem.id, (bottomUsageCount.get(bottomItem.id) || 0) + 1);
      }

      dailyOutfits.push({
        dayNumber: d,
        dayLabelDe: `Tag ${d}`,
        dayLabelEn: `Day ${d}`,
        occasion: dayOccasion,
        occasionLabelDe: isEveningDay
          ? `${OCCASION_LABELS[dayOccasion]} (Abend-Highlight)`
          : OCCASION_LABELS[dayOccasion],
        occasionLabelEn: isEveningDay
          ? `${OCCASION_LABELS_EN[dayOccasion]} (Evening Highlight)`
          : OCCASION_LABELS_EN[dayOccasion],
        isEveningOrSpecial: isEveningDay,
        outfit: chosenOutfit,
        outfitTitle: getShortOutfitTitle(chosenOutfit.items),
      });
    }
  }

  // Step 6: Build final packing list and track exact days each garment is worn
  const daysByGarmentId = new Map<string, number[]>();
  const finalPackedMap = new Map<string, Garment>();

  // Include all garments actually used in dailyOutfits + locked garments
  for (const dayEntry of dailyOutfits) {
    for (const item of dayEntry.outfit.items) {
      finalPackedMap.set(item.id, item);
      const list = daysByGarmentId.get(item.id) || [];
      if (!list.includes(dayEntry.dayNumber)) {
        list.push(dayEntry.dayNumber);
      }
      daysByGarmentId.set(item.id, list);
    }
  }

  // Also ensure the planned capsule core items are in the packing list even if a backup top wasn't used yet
  for (const item of initialCapsulePool) {
    if (!finalPackedMap.has(item.id)) {
      finalPackedMap.set(item.id, item);
      daysByGarmentId.set(item.id, []);
    }
  }

  const packedGarments = Array.from(finalPackedMap.values());

  const packedByCategory: Record<GarmentCategory, TravelPackedItemUsage[]> = {
    bottom: [],
    footwear: [],
    base_top: [],
    mid_layer: [],
    outerwear: [],
    accessory: [],
  };

  for (const g of packedGarments) {
    const wornOnDays = (daysByGarmentId.get(g.id) || []).sort((a, b) => a - b);
    packedByCategory[g.category].push({
      garment: g,
      wornOnDays,
      wearCountOnTrip: wornOnDays.length,
    });
  }

  for (const cat of Object.keys(packedByCategory) as GarmentCategory[]) {
    packedByCategory[cat].sort((a, b) => b.wearCountOnTrip - a.wearCountOnTrip);
  }

  const coreGarmentCount = packedGarments.filter((g) => g.category !== 'accessory').length;
  const totalPossibleCombinations = Math.max(dailyOutfits.length, distinctComboIds.size);

  const avgDailyScore =
    dailyOutfits.length > 0
      ? Math.round(
          dailyOutfits.reduce((sum, d) => sum + d.outfit.totalScore, 0) /
            dailyOutfits.length
        )
      : 85;

  const bottomCount = packedByCategory.bottom.length;
  const shoeCount = packedByCategory.footwear.length;
  const topCount = packedByCategory.base_top.length;

  const summaryNotesDe = [
    `${days} Tage mit nur ${coreGarmentCount} Kleidungsstücken (${bottomCount} ${
      bottomCount === 1 ? 'Hose/Rock' : 'Hosen/Röcke'
    }, ${topCount} ${topCount === 1 ? 'Oberteil' : 'Oberteile'}, ${shoeCount} Paar Schuhe).`,
    `Alle eingepackten Teile sind farblich aufeinander abgestimmt und ergeben bis zu ${totalPossibleCombinations} mögliche Kombinationen.`,
  ];

  const summaryNotesEn = [
    `${days} days with just ${coreGarmentCount} core garments (${bottomCount} ${
      bottomCount === 1 ? 'bottom' : 'bottoms'
    }, ${topCount} ${topCount === 1 ? 'top' : 'tops'}, ${shoeCount} pairs of shoes).`,
    `All packed pieces are color-coordinated and unlock up to ${totalPossibleCombinations} outfit combinations.`,
  ];

  return {
    config: {
      ...config,
      days,
    },
    packedGarments,
    packedByCategory,
    dailyOutfits,
    totalGarmentCount: packedGarments.length,
    coreGarmentCount,
    totalPossibleCombinations,
    crossCompatibilityScore: avgDailyScore,
    categoryTargets,
    summaryNotesDe,
    summaryNotesEn,
  };
}
