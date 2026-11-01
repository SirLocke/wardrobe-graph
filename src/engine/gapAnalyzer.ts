import {
  ArchetypeRecommendation,
  BiometricProfile,
  ContextBottleneck,
  GapAnalysisReport,
  Garment,
  GeneratedOutfit,
  OccasionType,
  OrphanPieceAnalysis,
  OutfitContext,
  WeatherCondition,
} from '../types/wardrobe';
import { instantiateCandidateArchetypes } from './archetypes';
import { getHslDistance, scoreGarmentBiometrics } from './colorMath';
import { generateOutfitsForContext } from './outfitGenerator';

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

  if (!garment.waterResistant && (garment.category === 'footwear' || garment.category === 'outerwear')) {
    reasons.push(
      'Nicht wasserabweisend: Fällt bei Regen-/Nässe-Szenarien automatisch aus der Wertung.'
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      'Dir fehlt ein passendes Bindeglied (Mid-Layer, Hose oder Schuhwerk) in kompatibler Farbtemperatur und Formalität, um dieses Teil in mehr als 2 Top-Outfits einzubinden.'
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
  // 1. Evaluate Core Compatibility Graph
  const baseGraph = evaluateCoreCompatibilityGraph(garments, profile);
  const { countsByGarmentId } = baseGraph;

  // 2. Evaluate full Context Matrix across all temperature & occasion buckets
  const contextMatrix: ContextBottleneck[] = EVALUATION_BUCKETS.map((bucket) => {
    const ctx: OutfitContext = {
      temperatureC: bucket.temperatureC,
      weather: bucket.weather,
      occasion: bucket.occasion,
      lockedGarmentIds: [],
      ignoreCleanStatus: true,
    };
    const outfits = generateOutfitsForContext(garments, profile, ctx, 0);
    const validCount = outfits.filter((o) => o.totalScore >= VALID_OUTFIT_THRESHOLD).length;
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

  // 3. Detect "Orphan Pieces" (Schrankleichen): biometricScore >= 70 AND validOutfitCount <= 2
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

  // 4. Virtual Archetype Simulation ("What to Buy" Calculator)
  const candidates = instantiateCandidateArchetypes(profile);

  // Filter out archetypes that duplicate items the user already owns (same subcategory + similar color ΔHSL < 22)
  const nonDuplicateCandidates = candidates.filter(({ garment: cand }) => {
    return !garments.some(
      (existing) =>
        existing.subcategory === cand.subcategory &&
        getHslDistance(existing.hsl, cand.hsl) < 22
    );
  });

  const recommendations: ArchetypeRecommendation[] = [];

  for (const { archetypeId, garment: virtualGarment, rationale } of nonDuplicateCandidates) {
    const simulatedCloset = [...garments, virtualGarment];
    const simGraph = evaluateCoreCompatibilityGraph(simulatedCloset, profile);

    const newOutfitsUnlocked = Math.max(
      0,
      simGraph.validOutfits.length - baseGraph.validOutfits.length
    );

    if (newOutfitsUnlocked === 0) continue;

    // Orphans rescued: existing Orphan Pieces that now cross the > 2 outfits threshold
    const orphansRescued = orphanPieces
      .filter((orphan) => (simGraph.countsByGarmentId[orphan.garment.id] || 0) > 2)
      .map((o) => o.garment);

    // Top 3 concrete outfit combinations combining this virtual item with the user's existing items
    const unlockedCombinationsPreview = simGraph.validOutfits
      .filter((o) => o.items.some((i) => i.id === virtualGarment.id))
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

  const healthyBuckets = contextMatrix.filter((c) => !c.isBottleneck).length;
  const wardrobeHealthScore = Math.min(
    100,
    Math.round(
      (healthyBuckets / contextMatrix.length) * 65 +
        Math.min(35, baseGraph.validOutfits.length * 2.2)
    )
  );

  return {
    totalValidOutfitsAcrossContexts: baseGraph.validOutfits.length,
    wardrobeHealthScore,
    contextMatrix,
    bottlenecks,
    orphanPieces,
    outfitCountsByGarmentId: countsByGarmentId,
    recommendations: diverseTop5,
  };
}
