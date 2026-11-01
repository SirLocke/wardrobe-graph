import {
  BiometricProfile,
  ContrastLevel,
  Garment,
  GarmentSubcategory,
  GeneratedOutfit,
  OccasionType,
  OutfitContext,
  TextureType,
} from '../types/wardrobe';
import { getHueDistance, isWardrobeNeutral, scoreGarmentBiometrics } from './colorMath';

const FORMALITY_WINDOWS: Record<OccasionType, [number, number]> = {
  casual: [1, 3],
  smart_casual_office: [3, 4],
  active_sporty: [1, 2],
  date_night: [3, 4],
  formal_event: [4, 5],
};

const OFFICE_EXCLUDED_SUBCATEGORIES: GarmentSubcategory[] = [
  'hoodie',
  'shorts',
  'runner',
  'crop_top',
  'mini_skirt',
];

const CONTRAST_LABELS: Record<ContrastLevel, string> = {
  low: 'niedrigen',
  medium: 'mittleren',
  high: 'hohen',
};

const TEXTURE_LABELS: Record<TextureType, string> = {
  smooth_cotton: 'glatter Baumwolle/Seide',
  heavy_jersey: 'schwerem Jersey',
  twill_chino: 'Twill',
  denim: 'Denim',
  chunky_knit: 'Grobstrick',
  fine_knit: 'Feinstrick',
  flannel_wool: 'Flanell/Wolle',
  linen: 'Leinen',
  tech_waterproof: 'Tech-Membran',
  leather_suede: 'Leder/Suede',
};

const SMOOTH_TEXTURES: TextureType[] = ['smooth_cotton', 'fine_knit', 'tech_waterproof'];
const STRUCTURED_TEXTURES: TextureType[] = [
  'heavy_jersey',
  'twill_chino',
  'denim',
  'chunky_knit',
  'flannel_wool',
  'linen',
  'leather_suede',
];

const TAILORED_SUBCATEGORIES: GarmentSubcategory[] = [
  'blazer',
  'trenchcoat',
  'coat',
  'button_down_shirt',
  'blouse',
  'turtleneck',
  'trousers',
  'wide_leg_trousers',
  'midi_skirt',
  'loafer_derby',
  'heeled_ankle_boot',
  'ballet_flat',
];

const STREET_RELAXED_SUBCATEGORIES: GarmentSubcategory[] = [
  'heavyweight_tee',
  'crop_top',
  'overshirt',
  'hoodie',
  'crewneck_sweater',
  'leather_jacket',
  'puffer_jacket',
  'blouson',
  'denim',
  'cargo',
  'wide_leg_trousers',
  'sneaker_clean',
  'sneaker_chunky',
  'boots',
];

/**
 * Checks if a single garment passes hard context filters (cleanliness, rain resistance, formality, temperature slot).
 */
export function passesHardContextFilter(
  garment: Garment,
  context: OutfitContext,
  isLocked: boolean = false
): boolean {
  // 1. Cleanliness filter
  if (!context.ignoreCleanStatus && !isLocked && !garment.isClean) {
    return false;
  }

  // 2. Weather filter (Rain/Wet)
  if (context.weather === 'rain_wet' && !isLocked) {
    if (
      (garment.category === 'footwear' || garment.category === 'outerwear') &&
      !garment.waterResistant
    ) {
      return false;
    }
    if (garment.texture === 'linen') {
      return false;
    }
    if (
      garment.category === 'bottom' &&
      garment.fit === 'boxy_oversized' &&
      garment.hsl.l > 70
    ) {
      return false;
    }
  }

  // 3. Occasion Formality Window
  if (!isLocked) {
    const [minFormality, maxFormality] = FORMALITY_WINDOWS[context.occasion] ?? [2, 4];
    const effectiveMin =
      garment.category === 'base_top' && context.temperatureC <= 20
        ? Math.max(1, minFormality - 1)
        : minFormality;

    if (garment.formality < effectiveMin || garment.formality > maxFormality) {
      return false;
    }

    if (
      context.occasion === 'smart_casual_office' &&
      OFFICE_EXCLUDED_SUBCATEGORIES.includes(garment.subcategory)
    ) {
      return false;
    }
  }

  // 4. Temperature Thermal Rating filter per slot
  if (!isLocked) {
    const temp = context.temperatureC;
    if (temp >= 21) {
      if (garment.category === 'base_top' && garment.thermalRating > 2) return false;
      if (garment.category === 'bottom' && garment.thermalRating > 2) return false;
    } else if (temp >= 14 && temp <= 20) {
      if (garment.category === 'base_top' && garment.thermalRating > 3) return false;
      if (garment.category === 'mid_layer' && (garment.thermalRating < 2 || garment.thermalRating > 3)) {
        return false;
      }
      if (garment.category === 'bottom' && (garment.thermalRating < 2 || garment.thermalRating > 3)) {
        return false;
      }
    } else {
      if (garment.category === 'outerwear' && garment.thermalRating < 3) return false;
      if (garment.category === 'bottom' && garment.thermalRating < 3) return false;
      if (garment.subcategory === 'shorts' || garment.subcategory === 'mini_skirt' || garment.subcategory === 'sandal_strappy') {
        return false;
      }
    }
  }

  return true;
}

/**
 * Multi-Garment Synergy Scoring: evaluates a complete outfit combination (0-100 + German traces[]).
 */
export function scoreOutfitCombination(
  items: Garment[],
  profile: BiometricProfile,
  context: OutfitContext
): GeneratedOutfit {
  const traces: string[] = [];

  const upperItems = items.filter(
    (i) => i.category === 'base_top' || i.category === 'mid_layer' || i.category === 'outerwear'
  );
  const bottomItem = items.find((i) => i.category === 'bottom');
  const baseTop = items.find((i) => i.category === 'base_top');
  const midLayer = items.find((i) => i.category === 'mid_layer');
  const outerwear = items.find((i) => i.category === 'outerwear');

  // 1. Biometric Base (35% weight)
  let weightedBioSum = 0;
  let weightTotal = 0;
  const bioTracesAdded = new Set<string>();

  for (const item of upperItems) {
    const bio = scoreGarmentBiometrics(item, profile);
    const layerWeight = item.category === 'mid_layer' ? 1.2 : item.category === 'base_top' ? 1.1 : 1.0;
    weightedBioSum += bio.score * layerWeight;
    weightTotal += layerWeight;

    for (const r of bio.reasons) {
      if (
        (r.includes('Augenfarbe') ||
          r.includes('Kragen') ||
          r.includes('Hautunterton') ||
          r.includes('Barttextur')) &&
        bioTracesAdded.size < 2
      ) {
        bioTracesAdded.add(`${item.name}: ${r}`);
      }
    }
  }

  const rawBiometricAvg = weightTotal > 0 ? weightedBioSum / weightTotal : 75;
  const biometricBase = Math.round((rawBiometricAvg / 100) * 35 * 10) / 10;
  traces.push(...Array.from(bioTracesAdded));

  // 2. Contrast Level Calibration (20% weight)
  const primaryTop = midLayer || baseTop || outerwear || upperItems[0];
  let lightnessDelta = 30;
  if (primaryTop && bottomItem) {
    const deltaTopBottom = Math.abs(primaryTop.hsl.l - bottomItem.hsl.l);
    const deltaBaseMid =
      baseTop && midLayer ? Math.abs(baseTop.hsl.l - midLayer.hsl.l) : deltaTopBottom;
    lightnessDelta = Math.round(Math.max(deltaTopBottom, deltaBaseMid));
  }

  let contrastCalibration = 10;
  if (profile.contrastLevel === 'low') {
    if (lightnessDelta < 25) {
      contrastCalibration = 20;
      traces.push(
        `Hell-Dunkel-Kontrast (${lightnessDelta}%) passt exakt zu deinem ${CONTRAST_LABELS[profile.contrastLevel]} Kontrast-Typ`
      );
    } else if (lightnessDelta <= 45) {
      contrastCalibration = 13;
    } else {
      contrastCalibration = 6;
    }
  } else if (profile.contrastLevel === 'medium') {
    if (lightnessDelta >= 25 && lightnessDelta <= 55) {
      contrastCalibration = 20;
      traces.push(
        `Hell-Dunkel-Kontrast (${lightnessDelta}%) passt exakt zu deinem ${CONTRAST_LABELS[profile.contrastLevel]} Kontrast-Typ`
      );
    } else if (lightnessDelta >= 15 && lightnessDelta <= 68) {
      contrastCalibration = 12;
    } else {
      contrastCalibration = 5;
    }
  } else {
    if (lightnessDelta > 55) {
      contrastCalibration = 20;
      traces.push(
        `Hell-Dunkel-Kontrast (${lightnessDelta}%) passt exakt zu deinem ${CONTRAST_LABELS[profile.contrastLevel]} Kontrast-Typ`
      );
    } else if (lightnessDelta >= 38) {
      contrastCalibration = 13;
    } else {
      contrastCalibration = 5;
    }
  }

  // 3. Color Harmony Rule (20% weight, or -35 penalty for 3+ competing non-neutral hues)
  const nonNeutralItems = items.filter((item) => !isWardrobeNeutral(item.hsl, item.colorTemp));
  const distinctNonNeutralHues: Garment[] = [];
  for (const item of nonNeutralItems) {
    const alreadyRepresented = distinctNonNeutralHues.some(
      (existing) => getHueDistance(existing.hsl.h, item.hsl.h) < 18
    );
    if (!alreadyRepresented) {
      distinctNonNeutralHues.push(item);
    }
  }

  let colorHarmony = 16;
  if (distinctNonNeutralHues.length === 1) {
    colorHarmony = 20;
    traces.push(
      `Farbharmonie: ${distinctNonNeutralHues[0].colorName} als fokussierter Statement-Akzent auf ruhiger Neutral-Basis`
    );
  } else if (distinctNonNeutralHues.length === 0) {
    colorHarmony = 18;
    traces.push('Souveräne Neutral-Palette mit ruhiger, zeitloser Farbwirkung');
  } else if (distinctNonNeutralHues.length === 2) {
    const [c1, c2] = distinctNonNeutralHues;
    const hueDist = getHueDistance(c1.hsl.h, c2.hsl.h);
    const bothMuted = c1.hsl.s <= 60 && c2.hsl.s <= 60;
    const isAnalogous = hueDist <= 50;
    const isComplementary = hueDist >= 150 && hueDist <= 210;

    if (bothMuted && (isAnalogous || isComplementary)) {
      colorHarmony = 19;
      traces.push(
        isAnalogous
          ? `Analoge Farbharmonie (${c1.colorName} & ${c2.colorName}) in gedämpfter Sättigung`
          : `Gedeckte Komplementär-Spannung zwischen ${c1.colorName} und ${c2.colorName}`
      );
    } else {
      colorHarmony = 6;
    }
  } else {
    colorHarmony = -15;
    traces.push('Zu viele konkurrierende Buntfarben im Outfit (-35 Pkt. Farbharmonie-Abzug)');
  }

  // Check formality coherence across visible items
  const visibleFormalities = items
    .filter((i) => i.category !== 'base_top' || items.length === 3)
    .map((i) => i.formality);
  const formalitySpread =
    Math.max(...visibleFormalities) - Math.min(...visibleFormalities);
  let formalityPenalty = 0;
  if (formalitySpread >= 2) {
    formalityPenalty = -14;
    traces.push('Stilbruch: Zu großer Formalitäts-Abstand zwischen Edelschicht und Casual-Komponenten');
  }

  // 4. Silhouette Balance Matrix (15% weight)
  let silhouetteBalance = 10;
  const effectiveTop = outerwear || midLayer || baseTop;
  if (effectiveTop && bottomItem) {
    const topRelaxed = effectiveTop.fit === 'relaxed' || effectiveTop.fit === 'boxy_oversized';
    const bottomSlimReg = bottomItem.fit === 'slim' || bottomItem.fit === 'regular';
    const topSlimReg = effectiveTop.fit === 'slim' || effectiveTop.fit === 'regular';
    const bottomRelaxed =
      bottomItem.fit === 'relaxed' ||
      bottomItem.fit === 'boxy_oversized' ||
      bottomItem.subcategory === 'wide_leg_trousers' ||
      bottomItem.subcategory === 'midi_skirt';

    if (topRelaxed && bottomSlimReg) {
      silhouetteBalance = 15;
      traces.push('Ausgewogene Silhouette: Relaxed Top zu schmalerer Beinlinie');
    } else if (topSlimReg && bottomRelaxed) {
      silhouetteBalance = 15;
      traces.push('Moderne Proportion: Körpernahes Oberteil zu fließender Wide-Leg-/Rock-Linie');
    } else if (
      effectiveTop.fit === 'boxy_oversized' &&
      bottomItem.fit === 'boxy_oversized'
    ) {
      if (context.occasion === 'casual' || context.styleVibe === 'street_relaxed') {
        silhouetteBalance = 11;
      } else {
        silhouetteBalance = -15;
        traces.push('Proportionaler Konflikt: Doppel-Oversized staucht die Silhouette');
      }
    } else {
      silhouetteBalance = 12;
      traces.push('Klassisch-ausbalancierte Tailored-Silhouette');
    }
  }

  // 5. Texture Contrast Bonus (10% weight)
  let textureContrast = 5;
  const uniqueTextures = Array.from(new Set(items.map((i) => i.texture)));
  const hasSmooth = items.some((i) => SMOOTH_TEXTURES.includes(i.texture));
  const hasStructured = items.some((i) => STRUCTURED_TEXTURES.includes(i.texture));

  if (hasSmooth && hasStructured && uniqueTextures.length >= 3) {
    textureContrast = 10;
    const texNames = uniqueTextures
      .slice(0, 3)
      .map((t) => TEXTURE_LABELS[t])
      .join(', ');
    traces.push(`Spannender Materialmix aus ${texNames}`);
  } else if (uniqueTextures.length >= 2) {
    textureContrast = 8;
  }

  // 6. Deterministic Style Direction (StyleVibe) Modifier
  const vibe = context.styleVibe || 'balanced';
  let styleVibeBonus = 0;

  if (vibe === 'minimal_capsule') {
    if (distinctNonNeutralHues.length <= 1 && items.every((i) => i.hsl.s <= 45)) {
      styleVibeBonus += 8;
      traces.push(
        'Stil-Fokus [Minimal Capsule]: Tonal-ruhige Quiet-Luxury-Komposition ohne laute Farbbrüche'
      );
    } else if (distinctNonNeutralHues.length >= 2) {
      styleVibeBonus -= 8;
    }
  } else if (vibe === 'statement_editorial') {
    const hasRichTexture = items.some(
      (i) =>
        i.texture === 'leather_suede' ||
        i.texture === 'chunky_knit' ||
        i.subcategory === 'trenchcoat' ||
        i.subcategory === 'blazer' ||
        i.subcategory === 'midi_skirt' ||
        i.subcategory === 'wide_leg_trousers'
    );
    if (distinctNonNeutralHues.length >= 1 && (hasRichTexture || silhouetteBalance === 15)) {
      styleVibeBonus += 9;
      traces.push(
        'Stil-Fokus [Statement / Editorial]: Architektonischer Silhouetten- & Power-Color-Akzent'
      );
    } else if (distinctNonNeutralHues.length === 0) {
      styleVibeBonus -= 6;
    }
  } else if (vibe === 'tailored_chic') {
    const tailoredMatches = items.filter((i) =>
      TAILORED_SUBCATEGORIES.includes(i.subcategory)
    ).length;
    if (tailoredMatches >= 2) {
      styleVibeBonus += 9;
      traces.push(
        `Stil-Fokus [Tailored Chic]: ${tailoredMatches} klassisch-geschnittene Atelier-Komponenten kombiniert`
      );
    } else {
      styleVibeBonus -= 5;
    }
  } else if (vibe === 'street_relaxed') {
    const streetMatches = items.filter(
      (i) =>
        STREET_RELAXED_SUBCATEGORIES.includes(i.subcategory) ||
        i.fit === 'relaxed' ||
        i.fit === 'boxy_oversized'
    ).length;
    if (streetMatches >= 3) {
      styleVibeBonus += 9;
      traces.push(
        'Stil-Fokus [Street / Relaxed]: Entspannte Proportionen & urbane Layering-Struktur'
      );
    } else {
      styleVibeBonus -= 5;
    }
  }

  if (context.weather === 'rain_wet') {
    const wetReady = items
      .filter((i) => i.category === 'outerwear' || i.category === 'footwear')
      .every((i) => i.waterResistant);
    if (wetReady) {
      traces.push('Wetterfest: Wasserabweisende Materialien für Regen & Nässe');
    }
  }

  const rawTotal =
    biometricBase +
    contrastCalibration +
    colorHarmony +
    silhouetteBalance +
    textureContrast +
    formalityPenalty +
    styleVibeBonus;

  const totalScore = Math.max(10, Math.min(99, Math.round(rawTotal)));

  return {
    id: items.map((i) => i.id).join('__'),
    items,
    totalScore,
    breakdown: {
      biometricBase: Math.round(biometricBase),
      contrastCalibration,
      colorHarmony: Math.max(-15, colorHarmony + formalityPenalty),
      silhouetteBalance: Math.max(0, Math.min(15, silhouetteBalance + Math.round(styleVibeBonus / 2))),
      textureContrast,
      rawBiometricAvg: Math.round(rawBiometricAvg),
      lightnessDelta,
    },
    traces,
  };
}

/**
 * Generates all valid outfit combinations for a given context, returning the top N distinct outfits sorted by totalScore.
 */
export function generateOutfitsForContext(
  garments: Garment[],
  profile: BiometricProfile,
  context: OutfitContext,
  limit: number = 5
): GeneratedOutfit[] {
  const lockedSet = new Set(context.lockedGarmentIds);

  const eligible = garments.filter((g) =>
    passesHardContextFilter(g, context, lockedSet.has(g.id))
  );

  const baseTops = eligible.filter((g) => g.category === 'base_top');
  const midLayers = eligible.filter((g) => g.category === 'mid_layer');
  const outerwears = eligible.filter((g) => g.category === 'outerwear');
  const bottoms = eligible.filter((g) => g.category === 'bottom');
  const footwears = eligible.filter((g) => g.category === 'footwear');

  const restrictByLock = (list: Garment[]) => {
    const lockedInSlot = list.filter((g) => lockedSet.has(g.id));
    return lockedInSlot.length > 0 ? lockedInSlot : list;
  };

  const slotBaseTops = restrictByLock(baseTops);
  const slotMidLayers = restrictByLock(midLayers);
  const slotOuterwears = restrictByLock(outerwears);
  const slotBottoms = restrictByLock(bottoms);
  const slotFootwears = restrictByLock(footwears);

  const temp = context.temperatureC;
  const candidateCombos: Garment[][] = [];

  const isRealisticEverydayLayering = (top: Garment, mid: Garment): boolean => {
    if (top.neckline === 'hooded' && mid.neckline !== 'hooded') return false;
    // Avoid wearing a blouse under a sporty hoodie or sweatshirt
    if (
      top.subcategory === 'blouse' &&
      (mid.subcategory === 'hoodie' || mid.subcategory === 'crewneck_sweater')
    ) {
      return false;
    }
    return true;
  };

  if (temp >= 21) {
    const hasLockedMid = slotMidLayers.some((g) => lockedSet.has(g.id));
    for (const top of slotBaseTops) {
      for (const bottom of slotBottoms) {
        for (const shoe of slotFootwears) {
          if (hasLockedMid) {
            for (const mid of slotMidLayers) {
              candidateCombos.push([top, mid, bottom, shoe]);
            }
          } else {
            candidateCombos.push([top, bottom, shoe]);
          }
        }
      }
    }
  } else if (temp >= 14 && temp <= 20) {
    const hasLockedOuter = slotOuterwears.some((g) => lockedSet.has(g.id));
    for (const top of slotBaseTops) {
      for (const mid of slotMidLayers) {
        if (!isRealisticEverydayLayering(top, mid)) continue;
        for (const bottom of slotBottoms) {
          for (const shoe of slotFootwears) {
            if (hasLockedOuter) {
              for (const out of slotOuterwears) {
                candidateCombos.push([top, mid, out, bottom, shoe]);
              }
            } else {
              candidateCombos.push([top, mid, bottom, shoe]);
            }
          }
        }
      }
    }
  } else {
    for (const top of slotBaseTops) {
      for (const mid of slotMidLayers) {
        if (!isRealisticEverydayLayering(top, mid)) continue;
        for (const out of slotOuterwears) {
          for (const bottom of slotBottoms) {
            for (const shoe of slotFootwears) {
              candidateCombos.push([top, mid, out, bottom, shoe]);
            }
          }
        }
      }
    }
  }

  const validLockedCombos = candidateCombos.filter((combo) => {
    if (lockedSet.size === 0) return true;
    const ids = new Set(combo.map((c) => c.id));
    for (const lockedId of lockedSet) {
      if (!ids.has(lockedId)) return false;
    }
    return true;
  });

  const scored = validLockedCombos
    .map((combo) => scoreOutfitCombination(combo, profile, context))
    .sort((a, b) => b.totalScore - a.totalScore);

  if (limit <= 0 || scored.length === 0) {
    return scored;
  }

  // Deterministic Maximal Marginal Relevance (MMR) Diversity Selection:
  // Ensures the Top N recommended outfits on the start page do not repeat the same
  // visible Mid-Layer, Outerwear, Bottom, Base-Top, or Footwear combination.
  const selected: GeneratedOutfit[] = [scored[0]];
  const selectedIds = new Set<string>([scored[0].id]);

  while (selected.length < limit && selected.length < scored.length) {
    let bestCandidate: GeneratedOutfit | null = null;
    let bestDiversityScore = -Infinity;

    for (const candidate of scored) {
      if (selectedIds.has(candidate.id)) continue;

      let penalty = 0;
      let bonus = 0;

      const candMid = candidate.items.find((i) => i.category === 'mid_layer');
      const candOut = candidate.items.find((i) => i.category === 'outerwear');
      const candBot = candidate.items.find((i) => i.category === 'bottom');
      const candTop = candidate.items.find((i) => i.category === 'base_top');
      const candShoe = candidate.items.find((i) => i.category === 'footwear');

      let unseenMidSubcategory = true;
      let unseenDominantHue = true;
      const candDominantHex = (candOut || candMid || candTop)?.colorHex;

      for (const prev of selected) {
        const prevIds = new Set(prev.items.map((i) => i.id));
        const sharedUnlockedCount = candidate.items.filter(
          (i) => !lockedSet.has(i.id) && prevIds.has(i.id)
        ).length;
        const unlockedSlotsCount = candidate.items.filter((i) => !lockedSet.has(i.id)).length;

        // Heavy penalty if candidate differs by only 1 item from an already selected outfit
        if (unlockedSlotsCount >= 2 && sharedUnlockedCount >= unlockedSlotsCount - 1) {
          penalty += 60;
        } else if (unlockedSlotsCount >= 3 && sharedUnlockedCount >= unlockedSlotsCount - 2) {
          penalty += 22;
        }

        const prevMid = prev.items.find((i) => i.category === 'mid_layer');
        const prevOut = prev.items.find((i) => i.category === 'outerwear');
        const prevBot = prev.items.find((i) => i.category === 'bottom');
        const prevTop = prev.items.find((i) => i.category === 'base_top');
        const prevShoe = prev.items.find((i) => i.category === 'footwear');

        if (candOut && prevOut && !lockedSet.has(candOut.id) && candOut.id === prevOut.id) {
          penalty += 26;
        }
        if (candMid && prevMid && !lockedSet.has(candMid.id)) {
          if (candMid.id === prevMid.id) {
            penalty += 30;
          }
          if (candMid.subcategory === prevMid.subcategory) {
            unseenMidSubcategory = false;
          }
        }
        if (candBot && prevBot && !lockedSet.has(candBot.id) && candBot.id === prevBot.id) {
          penalty += 20;
        }
        if (candTop && prevTop && !lockedSet.has(candTop.id) && candTop.id === prevTop.id) {
          penalty += 18;
        }
        if (candShoe && prevShoe && !lockedSet.has(candShoe.id) && candShoe.id === prevShoe.id) {
          penalty += 14;
        }

        // Extra penalty if exact same (Mid/Top + Bottom) visual torso-leg block repeats
        if (
          candMid &&
          prevMid &&
          candBot &&
          prevBot &&
          !lockedSet.has(candMid.id) &&
          !lockedSet.has(candBot.id) &&
          candMid.id === prevMid.id &&
          candBot.id === prevBot.id
        ) {
          penalty += 35;
        }

        const prevDominantHex = (prevOut || prevMid || prevTop)?.colorHex;
        if (candDominantHex && prevDominantHex && candDominantHex === prevDominantHex) {
          unseenDominantHue = false;
        }
      }

      if (candMid && unseenMidSubcategory) {
        bonus += 12;
      }
      if (candDominantHex && unseenDominantHue) {
        bonus += 10;
      }

      const diversityAdjustedScore = candidate.totalScore + bonus - penalty;
      if (diversityAdjustedScore > bestDiversityScore) {
        bestDiversityScore = diversityAdjustedScore;
        bestCandidate = candidate;
      }
    }

    if (!bestCandidate) break;
    selected.push(bestCandidate);
    selectedIds.add(bestCandidate.id);
  }

  return selected;
}
