import {
  ArchetypeRecommendation,
  BiometricProfile,
  ContextBottleneck,
  GapAnalysisReport,
  Garment,
  GarmentCategory,
  GeneratedOutfit,
  OccasionType,
  OrphanPieceAnalysis,
  OutfitContext,
  WeatherCondition,
} from '../types/wardrobe';
import { instantiateCandidateArchetypes } from './archetypes';
import { getHslDistance, scoreGarmentBiometrics } from './colorMath';
import { generateOutfitsForContext, isGarmentWaterResistant } from './outfitGenerator';

export const VALID_OUTFIT_THRESHOLD = 76;

interface StandardEvaluationBucket {
  id: string;
  label: string;
  temperatureC: number;
  tempLabel: string;
  occasion: OccasionType;
  occasionLabel: string;
  weather: WeatherCondition;
  isCoreGraphContext: boolean;
}

/**
 * Standard evaluation contexts:
 * Includes the 3 core compatibility graph contexts from the spec:
 * 1. Mild Casual (18°C)
 * 2. Transition Smart Casual (13°C)
 * 3. Cold/Wet Everyday (6°C)
 * Plus additional cells for the Wardrobe Health & Context Matrix heatmap.
 */
export const EVALUATION_BUCKETS: StandardEvaluationBucket[] = [
  {
    id: 'mild_casual',
    label: 'Mild Casual (18°C)',
    temperatureC: 18,
    tempLabel: 'Mild (16–21°C)',
    occasion: 'casual',
    occasionLabel: 'Alltag / Casual',
    weather: 'sunny_dry',
    isCoreGraphContext: true,
  },
  {
    id: 'transition_smart_casual',
    label: 'Übergang Smart Casual (13°C)',
    temperatureC: 13,
    tempLabel: 'Übergang (9–15°C)',
    occasion: 'smart_casual_office',
    occasionLabel: 'Büro / Smart Casual',
    weather: 'cloudy_windy',
    isCoreGraphContext: true,
  },
  {
    id: 'cold_dry_everyday',
    label: 'Kalt & Trocken Alltag (4°C)',
    temperatureC: 4,
    tempLabel: 'Winter / Kalt (<8°C)',
    occasion: 'casual',
    occasionLabel: 'Alltag / Casual (Trocken)',
    weather: 'cloudy_windy',
    isCoreGraphContext: true,
  },
  {
    id: 'cold_wet_everyday',
    label: 'Kalt & Nass Alltag (6°C)',
    temperatureC: 6,
    tempLabel: 'Kalt (<8°C)',
    occasion: 'casual',
    occasionLabel: 'Alltag / Casual (Regen)',
    weather: 'rain_wet',
    isCoreGraphContext: true,
  },
  {
    id: 'warm_casual',
    label: 'Warm Casual (24°C)',
    temperatureC: 24,
    tempLabel: 'Warm (>22°C)',
    occasion: 'casual',
    occasionLabel: 'Alltag / Casual',
    weather: 'sunny_dry',
    isCoreGraphContext: false,
  },
  {
    id: 'warm_smart_casual',
    label: 'Warm Smart Casual (23°C)',
    temperatureC: 23,
    tempLabel: 'Warm (>22°C)',
    occasion: 'smart_casual_office',
    occasionLabel: 'Büro / Smart Casual',
    weather: 'sunny_dry',
    isCoreGraphContext: false,
  },
  {
    id: 'mild_smart_casual',
    label: 'Mild Smart Casual (18°C)',
    temperatureC: 18,
    tempLabel: 'Mild (16–21°C)',
    occasion: 'smart_casual_office',
    occasionLabel: 'Büro / Smart Casual',
    weather: 'sunny_dry',
    isCoreGraphContext: false,
  },
  {
    id: 'mild_date_night',
    label: 'Mild Date Night (17°C)',
    temperatureC: 17,
    tempLabel: 'Mild (16–21°C)',
    occasion: 'date_night',
    occasionLabel: 'Date / Abend',
    weather: 'sunny_dry',
    isCoreGraphContext: false,
  },
  {
    id: 'transition_date_night',
    label: 'Übergang Date Night (12°C)',
    temperatureC: 12,
    tempLabel: 'Übergang (9–15°C)',
    occasion: 'date_night',
    occasionLabel: 'Date / Abend',
    weather: 'cloudy_windy',
    isCoreGraphContext: false,
  },
  {
    id: 'cold_smart_casual',
    label: 'Kalt Smart Casual (5°C)',
    temperatureC: 5,
    tempLabel: 'Kalt (<8°C)',
    occasion: 'smart_casual_office',
    occasionLabel: 'Büro / Smart Casual',
    weather: 'cloudy_windy',
    isCoreGraphContext: false,
  },
];

/**
 * Evaluates the compatibility graph across the 3 core contexts (Mild Casual 18°C, Transition Smart Casual 13°C, Cold/Wet Everyday 6°C)
 */
function evaluateCoreCompatibilityGraph(
  garments: Garment[],
  profile: BiometricProfile
): {
  validOutfits: GeneratedOutfit[];
  countsByGarmentId: Record<string, number>;
} {
  const countsByGarmentId: Record<string, number> = {};
  for (const g of garments) {
    countsByGarmentId[g.id] = 0;
  }

  const coreBuckets = EVALUATION_BUCKETS.filter((b) => b.isCoreGraphContext);
  const allValidMap = new Map<string, GeneratedOutfit>();

  for (const bucket of coreBuckets) {
    const ctx: OutfitContext = {
      temperatureC: bucket.temperatureC,
      weather: bucket.weather,
      occasion: bucket.occasion,
      lockedGarmentIds: [],
      ignoreCleanStatus: true, // Graph evaluates full wardrobe structural compatibility
    };

    const outfits = generateOutfitsForContext(garments, profile, ctx, 0);
    const validInBucket = outfits.filter((o) => o.totalScore >= VALID_OUTFIT_THRESHOLD);

    for (const outfit of validInBucket) {
      if (!allValidMap.has(outfit.id)) {
        allValidMap.set(outfit.id, outfit);
        for (const item of outfit.items) {
          countsByGarmentId[item.id] = (countsByGarmentId[item.id] || 0) + 1;
        }
      }
    }
  }

  return {
    validOutfits: Array.from(allValidMap.values()),
    countsByGarmentId,
  };
}

/**
 * Explains deterministically why a biometrically strong garment is isolated in the closet.
 */
function diagnoseOrphanIsolation(
  garment: Garment,
  allGarments: Garment[],
  profile: BiometricProfile
): string[] {
  const reasons: string[] = [];

  if (garment.formality >= 4) {
    const formalBottoms = allGarments.filter(
      (g) => g.category === 'bottom' && g.formality >= 3 && g.id !== garment.id
    );
    const formalShoes = allGarments.filter(
      (g) => g.category === 'footwear' && g.formality >= 4 && g.id !== garment.id
    );
    if (formalBottoms.length === 0 || formalShoes.length === 0) {
      reasons.push(
        'Hoher Formalitätsgrad (Stufe 4–5): Dir fehlt eine passende Tuchhose oder ein eleganter Lederschuh/Boot auf gleichem Niveau.'
      );
    }
  }

  if (garment.category === 'base_top') {
    const compatibleMidLayers = allGarments.filter(
      (g) =>
        g.category === 'mid_layer' &&
        Math.abs(g.formality - garment.formality) <= 1 &&
        Math.abs(g.hsl.l - garment.hsl.l) >= 22
    );
    if (compatibleMidLayers.length <= 1) {
      reasons.push(
        'Dir fehlt ein passendes Mid-Layer (Overshirt oder Feinstrick) mit ausreichendem Hell-Dunkel-Kontrast für deinen Kontrast-Typ.'
      );
    }
  }

  if (garment.category === 'mid_layer' || garment.category === 'outerwear') {
    const matchingBottoms = allGarments.filter(
      (g) =>
        g.category === 'bottom' &&
        Math.abs(g.formality - garment.formality) <= 1 &&
        Math.abs(g.hsl.l - garment.hsl.l) >= (profile.contrastLevel === 'low' ? 5 : 25)
    );
    if (matchingBottoms.length <= 1) {
      reasons.push(
        'Dir fehlt eine Hose in kompatibler Formalität und Kontraststufe, um dieses Oberteil über 76% Outfit-Score zu heben.'
      );
    }
  }

  if (garment.thermalRating >= 4) {
    const warmBottoms = allGarments.filter(
      (g) =>
        g.category === 'bottom' &&
        (g.thermalRatings ? g.thermalRatings.some((t) => t >= 3) : g.thermalRating >= 3)
    );
    const warmMidLayers = allGarments.filter(
      (g) =>
        g.category === 'mid_layer' &&
        (g.thermalRatings ? g.thermalRatings.some((t) => t >= 3) : g.thermalRating >= 3)
    );
    if (warmBottoms.length === 0 || warmMidLayers.length === 0) {
      reasons.push(
        'Winter-Kleidungsstück (Wärmestufe 4–5): Für komplette Winter-Outfits brauchst du mindestens einen warmen Pullover/Mid-Layer und eine lange Hose (Wärmestufe 3+).'
      );
    }
  }

  if (
    !isGarmentWaterResistant(garment) &&
    (garment.category === 'footwear' || garment.category === 'outerwear') &&
    reasons.length > 0
  ) {
    reasons.push(
      'Hinweis für Regentage: Da nicht als „Regenfest / Wasserabweisend“ markiert, wird dieses Teil nur bei trockenem oder bewölktem Wetter eingeplant.'
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      'Dir fehlt ein passendes Bindeglied (Mid-Layer, Hose oder Schuhwerk) in kompatibler Farbtemperatur, Kontraststufe und Formalität, um dieses Teil vielseitiger zu kombinieren.'
    );
  }

  return reasons;
}

/**
 * Runs the complete combinatorial Wardrobe Gap-Analyzer & Virtual Archetype Simulator.
 */
export function analyzeWardrobeGaps(
  garments: Garment[],
  profile: BiometricProfile
): GapAnalysisReport {
  // 1. Evaluate Core Compatibility Graph & Context Matrix in a unified pass
  const countsByGarmentId: Record<string, number> = {};
  for (const g of garments) {
    countsByGarmentId[g.id] = 0;
  }

  const allValidCoreOutfitsMap = new Map<string, GeneratedOutfit>();
  const coreBuckets = EVALUATION_BUCKETS.filter((b) => b.isCoreGraphContext);

  const contextMatrix: ContextBottleneck[] = EVALUATION_BUCKETS.map((bucket) => {
    const ctx: OutfitContext = {
      temperatureC: bucket.temperatureC,
      weather: bucket.weather,
      occasion: bucket.occasion,
      lockedGarmentIds: [],
      ignoreCleanStatus: true,
    };
    const outfits = generateOutfitsForContext(garments, profile, ctx, 0);
    const validInBucket = outfits.filter((o) => o.totalScore >= VALID_OUTFIT_THRESHOLD);

    if (bucket.isCoreGraphContext) {
      for (const outfit of validInBucket) {
        if (!allValidCoreOutfitsMap.has(outfit.id)) {
          allValidCoreOutfitsMap.set(outfit.id, outfit);
          for (const item of outfit.items) {
            countsByGarmentId[item.id] = (countsByGarmentId[item.id] || 0) + 1;
          }
        }
      }
    }

    const validCount = validInBucket.length;
    const isBottleneck = validCount < 3;

    return {
      id: bucket.id,
      label: bucket.label,
      temperatureC: bucket.temperatureC,
      tempLabel: bucket.tempLabel,
      occasion: bucket.occasion,
      occasionLabel: bucket.occasionLabel,
      weather: bucket.weather,
      validOutfitCount: validCount,
      isBottleneck,
      message: isBottleneck
        ? `Engpass: Nur ${validCount} ${validCount === 1 ? 'Outfit' : 'Outfits'} für ${bucket.occasionLabel} bei ${bucket.tempLabel} verfügbar`
        : undefined,
    };
  });

  const bottlenecks = contextMatrix.filter((c) => c.isBottleneck);

  // 2. Detect "Orphan Pieces" (Schrankleichen): biometricScore >= 70 AND validOutfitCount <= 2
  const orphanPieces: OrphanPieceAnalysis[] = [];
  for (const garment of garments) {
    const bio = scoreGarmentBiometrics(garment, profile);
    const validOutfitCount = countsByGarmentId[garment.id] || 0;
    if (bio.score >= 70 && validOutfitCount <= 2) {
      orphanPieces.push({
        garment,
        biometricScore: bio.score,
        validOutfitCount,
        isolationReasons: diagnoseOrphanIsolation(garment, garments, profile),
      });
    }
  }

  // Sort orphans by highest biometric potential first
  orphanPieces.sort((a, b) => b.biometricScore - a.biometricScore);

  // 3. Detect Worn / Aging Garments ("Ersetzen-Liste") and calculate their outfit restoration impact
  const currentYear = new Date().getFullYear();
  const replacementCandidates: import('../types/wardrobe').ReplacementCandidate[] = [];

  // Going-out & everyday evaluation buckets where worn items are excluded or penalized
  const goingOutBuckets = EVALUATION_BUCKETS.filter(
    (b) =>
      b.occasion === 'smart_casual_office' ||
      b.occasion === 'date_night' ||
      b.occasion === 'casual'
  );

  for (const garment of garments) {
    if (garment.isWishlistSandbox) continue;
    const isReplaceSoon = garment.condition === 'replace_soon';
    const isWornCasual = garment.condition === 'worn_casual';
    const ageYears =
      garment.purchaseYear && garment.purchaseYear <= currentYear
        ? currentYear - garment.purchaseYear
        : undefined;
    const wearCount = garment.wearCount || 0;
    const isAgedHighWear =
      !isReplaceSoon &&
      !isWornCasual &&
      ((ageYears !== undefined && ageYears >= 4 && wearCount >= 15) ||
        (ageYears !== undefined && ageYears >= 6) ||
        wearCount >= 35);

    if (!isReplaceSoon && !isWornCasual && !isAgedHighWear) {
      continue;
    }

    const replacementGarment: Garment = {
      ...garment,
      condition: 'good',
      isClean: true,
    };

    // Simulate how many valid outfits across going-out & core buckets involve this garment when in 'good' condition vs current condition
    const simulatedCloset = garments.map((g) =>
      g.id === garment.id ? replacementGarment : g
    );
    let goodOutfitsWithItem = 0;
    let currentOutfitsWithItem = 0;

    for (const bucket of goingOutBuckets) {
      const ctxLocked: OutfitContext = {
        temperatureC: bucket.temperatureC,
        weather: bucket.weather,
        occasion: bucket.occasion,
        lockedGarmentIds: [],
        ignoreCleanStatus: true,
      };
      const goodList = generateOutfitsForContext(simulatedCloset, profile, ctxLocked, 0);
      goodOutfitsWithItem += goodList.filter(
        (o) =>
          o.totalScore >= VALID_OUTFIT_THRESHOLD &&
          o.items.some((i) => i.id === garment.id)
      ).length;

      const curList = generateOutfitsForContext(garments, profile, ctxLocked, 0);
      currentOutfitsWithItem += curList.filter(
        (o) =>
          o.totalScore >= VALID_OUTFIT_THRESHOLD &&
          o.items.some((i) => i.id === garment.id)
      ).length;
    }

    const restoredOutfitsCount = Math.max(
      1,
      goodOutfitsWithItem - currentOutfitsWithItem || goodOutfitsWithItem
    );

    const urgency: 'high' | 'medium' = isReplaceSoon ? 'high' : 'medium';
    const ageSuffixDe =
      ageYears !== undefined && ageYears > 0
        ? ` (${ageYears} ${ageYears === 1 ? 'Jahr' : 'Jahre'} alt${
            wearCount > 0 ? `, ${wearCount}× getragen` : ''
          })`
        : wearCount > 0
        ? ` (${wearCount}× getragen)`
        : '';
    const ageSuffixEn =
      ageYears !== undefined && ageYears > 0
        ? ` (${ageYears} ${ageYears === 1 ? 'year' : 'years'} old${
            wearCount > 0 ? `, worn ${wearCount}×` : ''
          })`
        : wearCount > 0
        ? ` (worn ${wearCount}×)`
        : '';

    const reasonDe = isReplaceSoon
      ? `Als „Ersetzen“ markiert${ageSuffixDe} – fällt aktuell für Alltag & Ausgehen weg. Ein frischer Ersatz stellt ${restoredOutfitsCount} ${
          restoredOutfitsCount === 1 ? 'Outfit' : 'Outfits'
        } wieder her.`
      : isWornCasual
      ? `Abgetragen / nur noch für Zuhause & Freizeit${ageSuffixDe} – fehlt als ausgehtaugliches Teil für Büro, Café & Abend (${restoredOutfitsCount} ${
          restoredOutfitsCount === 1 ? 'Ausgeh-Outfit' : 'Ausgeh-Outfits'
        }).`
      : `Vielgetragenes Bestandsteil${ageSuffixDe} – rechtzeitig Nachfolger sichern, da ${restoredOutfitsCount} ${
          restoredOutfitsCount === 1 ? 'Outfit' : 'Outfits'
        } darauf aufbauen.`;

    const reasonEn = isReplaceSoon
      ? `Marked "Replace soon"${ageSuffixEn} – excluded from everyday & going-out looks. Replacing it restores ${restoredOutfitsCount} ${
          restoredOutfitsCount === 1 ? 'outfit' : 'outfits'
        }.`
      : isWornCasual
      ? `Worn / home & casual only${ageSuffixEn} – no longer suitable for office, café or evening (${restoredOutfitsCount} going-out ${
          restoredOutfitsCount === 1 ? 'outfit' : 'outfits'
        }).`
      : `Heavily worn staple${ageSuffixEn} – consider a fresh replacement (${restoredOutfitsCount} ${
          restoredOutfitsCount === 1 ? 'outfit depends' : 'outfits depend'
        } on it).`;

    replacementCandidates.push({
      garment,
      replacementGarment,
      urgency,
      reasonDe,
      reasonEn,
      restoredOutfitsCount,
      ageYears,
    });
  }

  replacementCandidates.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === 'high' ? -1 : 1;
    return b.restoredOutfitsCount - a.restoredOutfitsCount;
  });

  // 4. Virtual Archetype Simulation ("What to Buy" Calculator)
  // Targeted evaluation: only generates combinations involving the virtual archetype,
  // drastically reducing runtime without loss of precision.
  const candidates = instantiateCandidateArchetypes(profile);

  // Filter out archetypes that duplicate items the user already owns in GOOD condition (same subcategory + similar color ΔHSL < 22)
  // Note: If an existing garment is marked 'worn_casual' or 'replace_soon', do NOT treat it as a duplicate blocker.
  const nonDuplicateCandidates = candidates.filter(({ garment: cand }) => {
    return !garments.some(
      (existing) =>
        (!existing.condition || existing.condition === 'good') &&
        existing.subcategory === cand.subcategory &&
        getHslDistance(existing.hsl, cand.hsl) < 22
    );
  });

  const recommendations: ArchetypeRecommendation[] = [];

  for (const { archetypeId, garment: virtualGarment, rationale } of nonDuplicateCandidates) {
    const simulatedCloset = [...garments, virtualGarment];
    const unlockedMap = new Map<string, GeneratedOutfit>();

    for (const bucket of coreBuckets) {
      const ctx: OutfitContext = {
        temperatureC: bucket.temperatureC,
        weather: bucket.weather,
        occasion: bucket.occasion,
        lockedGarmentIds: [virtualGarment.id],
        ignoreCleanStatus: true,
      };
      const outfits = generateOutfitsForContext(simulatedCloset, profile, ctx, 0);
      for (const outfit of outfits) {
        if (outfit.totalScore >= VALID_OUTFIT_THRESHOLD) {
          unlockedMap.set(outfit.id, outfit);
        }
      }
    }

    const newOutfitsUnlocked = unlockedMap.size;
    if (newOutfitsUnlocked === 0) continue;

    const newlyUnlockedList = Array.from(unlockedMap.values());

    // Orphans rescued: existing Orphan Pieces that now cross the > 2 outfits threshold
    const orphansRescued = orphanPieces
      .filter((orphan) => {
        const extraOutfits = newlyUnlockedList.filter((o) =>
          o.items.some((i) => i.id === orphan.garment.id)
        ).length;
        return (countsByGarmentId[orphan.garment.id] || 0) + extraOutfits > 2;
      })
      .map((o) => o.garment);

    // Top 3 concrete outfit combinations combining this virtual item with the user's existing items
    const unlockedCombinationsPreview = newlyUnlockedList
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 3);

    const roiScore = newOutfitsUnlocked * 2 + orphansRescued.length * 5;

    recommendations.push({
      archetypeId,
      virtualGarment,
      roiScore,
      newOutfitsUnlocked,
      orphansRescued,
      unlockedCombinationsPreview,
      rationale,
    });
  }

  // Sort by (newOutfitsUnlocked * 2 + orphansRescued.length * 5), tie-breaking by top preview score
  recommendations.sort((a, b) => {
    if (b.roiScore !== a.roiScore) return b.roiScore - a.roiScore;
    const aTop = a.unlockedCombinationsPreview[0]?.totalScore || 0;
    const bTop = b.unlockedCombinationsPreview[0]?.totalScore || 0;
    return bTop - aTop;
  });

  // Deduplicate recommendations by subcategory so the Top 5 covers varied high-impact pieces
  const diverseTop5: ArchetypeRecommendation[] = [];
  const usedSubcategories = new Set<string>();
  for (const rec of recommendations) {
    if (diverseTop5.length >= 5) break;
    if (!usedSubcategories.has(rec.virtualGarment.subcategory)) {
      diverseTop5.push(rec);
      usedSubcategories.add(rec.virtualGarment.subcategory);
    }
  }
  for (const rec of recommendations) {
    if (diverseTop5.length >= 5) break;
    if (!diverseTop5.some((r) => r.archetypeId === rec.archetypeId)) {
      diverseTop5.push(rec);
    }
  }

  // Build category-specific recommendations (up to 4 diverse pieces per category)
  const recommendationsByCategory: Partial<Record<GarmentCategory, ArchetypeRecommendation[]>> = {};
  const coreCategories: GarmentCategory[] = [
    'base_top',
    'mid_layer',
    'outerwear',
    'bottom',
    'footwear',
  ];
  for (const cat of coreCategories) {
    const inCat = recommendations.filter((r) => r.virtualGarment.category === cat);
    const picked: ArchetypeRecommendation[] = [];
    const seenSubs = new Set<string>();
    for (const rec of inCat) {
      if (picked.length >= 4) break;
      if (!seenSubs.has(rec.virtualGarment.subcategory)) {
        picked.push(rec);
        seenSubs.add(rec.virtualGarment.subcategory);
      }
    }
    for (const rec of inCat) {
      if (picked.length >= 4) break;
      if (!picked.some((p) => p.archetypeId === rec.archetypeId)) {
        picked.push(rec);
      }
    }
    recommendationsByCategory[cat] = picked;
  }

  // 5. Build Unified Prioritized Shopping List (combining Worn/Replace candidates + High-ROI Missing Pieces)
  const rawShoppingItems: Array<Omit<import('../types/wardrobe').PrioritizedShoppingItem, 'rank'>> = [];

  for (const rep of replacementCandidates) {
    const priorityScore =
      (rep.urgency === 'high' ? 50 : 28) +
      rep.restoredOutfitsCount * 3 +
      Math.min(15, Math.round((rep.garment.wearCount || 0) / 3));
    rawShoppingItems.push({
      id: `replace_${rep.garment.id}`,
      type: 'replacement',
      priorityLevel: rep.urgency === 'high' ? 'high' : 'medium',
      priorityScore,
      titleDe: `${rep.garment.name} ersetzen`,
      titleEn: `Replace ${rep.garment.name}`,
      reasonDe: rep.reasonDe,
      reasonEn: rep.reasonEn,
      targetGarment: rep.replacementGarment,
      replacesGarment: rep.garment,
      outfitsImpact: rep.restoredOutfitsCount,
    });
  }

  for (const rec of diverseTop5) {
    // Avoid adding a virtual recommendation if it already matches a replacement candidate of the same subcategory & similar color
    const alreadyCoveredByReplacement = replacementCandidates.some(
      (rep) =>
        rep.garment.subcategory === rec.virtualGarment.subcategory &&
        getHslDistance(rep.garment.hsl, rec.virtualGarment.hsl) < 25
    );
    if (alreadyCoveredByReplacement) continue;

    const isMissingCategory = !garments.some(
      (g) =>
        g.category === rec.virtualGarment.category &&
        g.isClean &&
        g.condition !== 'replace_soon'
    );
    const priorityScore =
      (isMissingCategory ? 45 : 0) +
      rec.roiScore +
      (rec.orphansRescued.length > 0 ? 8 : 0);
    const priorityLevel: 'high' | 'medium' | 'normal' =
      isMissingCategory || rec.roiScore >= 30
        ? 'high'
        : rec.roiScore >= 16
        ? 'medium'
        : 'normal';

    rawShoppingItems.push({
      id: `add_${rec.archetypeId}`,
      type: 'new_addition',
      priorityLevel,
      priorityScore,
      titleDe: rec.virtualGarment.name,
      titleEn: rec.virtualGarment.name,
      reasonDe: rec.rationale,
      reasonEn: rec.rationale,
      targetGarment: rec.virtualGarment,
      recommendation: rec,
      outfitsImpact: rec.newOutfitsUnlocked,
    });
  }

  rawShoppingItems.sort((a, b) => b.priorityScore - a.priorityScore);
  const prioritizedShoppingList: import('../types/wardrobe').PrioritizedShoppingItem[] =
    rawShoppingItems.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  const totalCoreOutfits = allValidCoreOutfitsMap.size;
  const healthyBuckets = contextMatrix.filter((c) => !c.isBottleneck).length;
  const wardrobeHealthScore = Math.min(
    100,
    Math.round(
      (healthyBuckets / contextMatrix.length) * 65 +
        Math.min(35, totalCoreOutfits * 2.2)
    )
  );

  return {
    totalValidOutfitsAcrossContexts: totalCoreOutfits,
    wardrobeHealthScore,
    contextMatrix,
    bottlenecks,
    orphanPieces,
    outfitCountsByGarmentId: countsByGarmentId,
    recommendations: diverseTop5,
    recommendationsByCategory,
    replacementCandidates,
    prioritizedShoppingList,
  };
}
