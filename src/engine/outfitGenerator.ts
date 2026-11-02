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
import { getHueDistance, hexToHsl, isWardrobeNeutral, scoreGarmentBiometrics } from './colorMath';

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
  fleece: 'Fleece',
  down_quilted: 'gesteppter Daune',
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
  'fleece',
  'down_quilted',
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
  'cardigan',
  'polo',
  'chino',
  'trousers',
  'wide_leg_trousers',
  'midi_skirt',
  'boots',
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
  'fleece_vest',
  'leather_jacket',
  'puffer_jacket',
  'down_jacket',
  'fleece_jacket',
  'rain_jacket',
  'blouson',
  'denim',
  'cargo',
  'wide_leg_trousers',
  'sneaker_clean',
  'sneaker_chunky',
  'boots',
];

/**
 * Checks whether a garment is rain/water-resistant via explicit flags, rain_jacket/parka type, or waterproof tech fabric.
 */
export function isGarmentWaterResistant(garment: Garment): boolean {
  return Boolean(
    garment.waterResistant ||
      garment.rainproof ||
      garment.texture === 'tech_waterproof' ||
      garment.subcategory === 'rain_jacket' ||
      garment.subcategory === 'parka'
  );
}

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

  // Accessories do not use formality or thermalRating levels — only user toggles & weather sanity
  if (garment.category === 'accessory') {
    if (!isLocked) {
      if (context.includeAccessories === false) return false;
      if (context.excludedAccessorySubcategories?.includes(garment.subcategory)) {
        return false;
      }
      if (garment.subcategory === 'sunglasses' && context.weather === 'rain_wet') return false;
      if (garment.subcategory === 'scarf' && context.temperatureC >= 22) return false;
    }
    return true;
  }

  // 2. Weather filter (Rain/Wet)
  if (context.weather === 'rain_wet' && !isLocked) {
    if (
      (garment.category === 'footwear' || garment.category === 'outerwear') &&
      !isGarmentWaterResistant(garment)
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

  // 3. Occasion Formality Window (supports multi-select formalities[])
  if (!isLocked) {
    const [minFormality, maxFormality] = FORMALITY_WINDOWS[context.occasion] ?? [2, 4];
    const effectiveMin =
      garment.category === 'base_top' && context.temperatureC <= 20
        ? Math.max(1, minFormality - 1)
        : minFormality;
    const effectiveMax =
      context.styleVibe === 'tailored_chic'
        ? Math.max(maxFormality, 4)
        : maxFormality;

    const activeFormalities =
      garment.formalities && garment.formalities.length > 0
        ? garment.formalities
        : [garment.formality];

    const matchesFormality = activeFormalities.some(
      (f) => f >= effectiveMin && f <= effectiveMax
    );
    if (!matchesFormality) {
      return false;
    }

    if (
      context.occasion === 'smart_casual_office' &&
      OFFICE_EXCLUDED_SUBCATEGORIES.includes(garment.subcategory)
    ) {
      return false;
    }
  }

  // 4. Temperature Thermal Rating filter per slot (supports multi-select thermalRatings[])
  if (!isLocked) {
    const temp = context.temperatureC;
    const activeThermals =
      garment.thermalRatings && garment.thermalRatings.length > 0
        ? garment.thermalRatings
        : [garment.thermalRating];

    if (temp >= 27) {
      if (garment.category === 'base_top' && !activeThermals.some((t) => t <= 2)) return false;
      if (garment.category === 'bottom' && !activeThermals.some((t) => t <= 2)) return false;
    } else if (temp >= 21) {
      if (garment.category === 'base_top' && !activeThermals.some((t) => t <= 2)) return false;
      if (garment.category === 'bottom' && !activeThermals.some((t) => t <= 3)) return false;
    } else if (temp >= 14 && temp <= 20) {
      if (garment.category === 'base_top' && !activeThermals.some((t) => t <= 3)) return false;
      if (
        garment.category === 'mid_layer' &&
        !activeThermals.some((t) => t >= 2 && t <= 3)
      ) {
        return false;
      }
      if (
        garment.category === 'bottom' &&
        !activeThermals.some((t) => t >= 2 && t <= 3)
      ) {
        return false;
      }
    } else {
      if (garment.category === 'outerwear' && !activeThermals.some((t) => t >= 3)) return false;
      if (garment.category === 'bottom' && !activeThermals.some((t) => t >= 3)) return false;
      if (
        garment.subcategory === 'shorts' ||
        garment.subcategory === 'mini_skirt' ||
        garment.subcategory === 'sandal_strappy'
      ) {
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

  const coreItems = items.filter((i) => i.category !== 'accessory');
  const accessoryItems = items.filter((i) => i.category === 'accessory');

  const upperItems = coreItems.filter(
    (i) => i.category === 'base_top' || i.category === 'mid_layer' || i.category === 'outerwear'
  );
  const bottomItem = coreItems.find((i) => i.category === 'bottom');
  const baseTop = coreItems.find((i) => i.category === 'base_top');
  const midLayer = coreItems.find((i) => i.category === 'mid_layer');
  const outerwear = coreItems.find((i) => i.category === 'outerwear');

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

  // 3. Color Harmony Rule (20% weight, or -35 penalty for 3+ competing non-neutral hues across core garments)
  const nonNeutralItems = coreItems.filter((item) => !isWardrobeNeutral(item.hsl, item.colorTemp));
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

  // Check formality coherence across visible core items
  const visibleFormalities = coreItems
    .filter((i) => i.category !== 'base_top' || coreItems.length === 3)
    .map((i) => i.formality);
  const formalitySpread =
    visibleFormalities.length > 0
      ? Math.max(...visibleFormalities) - Math.min(...visibleFormalities)
      : 0;
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
  const uniqueTextures = Array.from(new Set(coreItems.map((i) => i.texture)));
  const hasSmooth = coreItems.some((i) => SMOOTH_TEXTURES.includes(i.texture));
  const hasStructured = coreItems.some((i) => STRUCTURED_TEXTURES.includes(i.texture));

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
    const avgSat =
      coreItems.length > 0
        ? coreItems.reduce((acc, i) => acc + i.hsl.s, 0) / coreItems.length
        : 20;
    if (distinctNonNeutralHues.length === 0 && coreItems.every((i) => i.hsl.s <= 40)) {
      styleVibeBonus += 14;
      traces.push(
        'Stil-Fokus [Schlicht & Zeitlos / Capsule]: Ruhige, zeitlose Neutral-Komposition ohne laute Farbbrüche'
      );
    } else if (distinctNonNeutralHues.length <= 1 && coreItems.every((i) => i.hsl.s <= 45)) {
      styleVibeBonus += avgSat <= 22 ? 9 : 4;
      traces.push(
        'Stil-Fokus [Schlicht & Zeitlos / Capsule]: Dezenter Akzent auf ruhiger Capsule-Basis'
      );
    } else {
      styleVibeBonus -= 14;
    }
  } else if (vibe === 'statement_editorial') {
    const hasRichTexture = coreItems.some(
      (i) =>
        i.texture === 'leather_suede' ||
        i.texture === 'chunky_knit' ||
        i.subcategory === 'trenchcoat' ||
        i.subcategory === 'blazer' ||
        i.subcategory === 'overshirt' ||
        i.subcategory === 'midi_skirt' ||
        i.subcategory === 'wide_leg_trousers'
    );
    const hasStatementFootwearOrLayer = coreItems.some(
      (i) =>
        i.subcategory === 'boots' ||
        i.subcategory === 'heeled_ankle_boot' ||
        i.subcategory === 'overshirt' ||
        i.subcategory === 'turtleneck' ||
        i.subcategory === 'leather_jacket'
    );
    if (distinctNonNeutralHues.length >= 1 && (hasRichTexture || silhouetteBalance === 15)) {
      styleVibeBonus += hasStatementFootwearOrLayer ? 14 : 9;
      traces.push(
        'Stil-Fokus [Auffälliger Hingucker / Statement]: Markanter Farbakzent mit ausdrucksstarker Textur'
      );
    } else if (distinctNonNeutralHues.length === 0) {
      styleVibeBonus -= 15;
    }
  } else if (vibe === 'tailored_chic') {
    const tailoredMatches = coreItems.filter((i) =>
      TAILORED_SUBCATEGORIES.includes(i.subcategory)
    ).length;
    const hasSmartLead = coreItems.some(
      (i) =>
        i.subcategory === 'button_down_shirt' ||
        i.subcategory === 'blazer' ||
        i.subcategory === 'turtleneck' ||
        i.subcategory === 'trenchcoat' ||
        i.subcategory === 'coat' ||
        i.subcategory === 'blouse' ||
        i.subcategory === 'cardigan'
    );
    const hasCasualStreet = coreItems.some(
      (i) =>
        i.subcategory === 'hoodie' ||
        i.subcategory === 'crewneck_sweater' ||
        i.subcategory === 'denim' ||
        i.subcategory === 'cargo' ||
        i.subcategory === 'shorts'
    );
    if (tailoredMatches >= 2 && hasSmartLead) {
      styleVibeBonus += hasCasualStreet ? 6 : 15;
      traces.push(
        `Stil-Fokus [Schick & Gepflegt]: ${tailoredMatches} klassisch-gepflegte Teile kombiniert`
      );
    } else if (tailoredMatches >= 2) {
      styleVibeBonus += 8;
      traces.push(
        `Stil-Fokus [Schick & Gepflegt]: ${tailoredMatches} gepflegte Klassiker kombiniert`
      );
    } else {
      styleVibeBonus -= 14;
    }
  } else if (vibe === 'street_relaxed') {
    const streetMatches = coreItems.filter(
      (i) =>
        STREET_RELAXED_SUBCATEGORIES.includes(i.subcategory) ||
        i.fit === 'relaxed' ||
        i.fit === 'boxy_oversized'
    ).length;
    const hasRelaxedCasualPiece = coreItems.some(
      (i) =>
        i.subcategory === 'hoodie' ||
        i.subcategory === 'overshirt' ||
        i.subcategory === 'crewneck_sweater' ||
        i.subcategory === 'denim' ||
        i.subcategory === 'sneaker_clean' ||
        i.subcategory === 'sneaker_chunky'
    );
    const hasFormalShirtOrBlazer = coreItems.some(
      (i) =>
        i.subcategory === 'button_down_shirt' ||
        i.subcategory === 'blazer' ||
        i.subcategory === 'turtleneck'
    );
    if (streetMatches >= 3 && hasRelaxedCasualPiece && !hasFormalShirtOrBlazer) {
      styleVibeBonus += 14;
      traces.push(
        'Stil-Fokus [Locker & Bequem]: Entspannte Schnitte & lässiges Alltags-Layering'
      );
    } else if (streetMatches >= 3) {
      styleVibeBonus += 6;
      traces.push(
        'Stil-Fokus [Locker & Bequem]: Lässige Proportionen für den Alltag'
      );
    } else {
      styleVibeBonus -= 12;
    }
  }

  if (context.weather === 'rain_wet') {
    const wetReady = coreItems
      .filter((i) => i.category === 'outerwear' || i.category === 'footwear')
      .every((i) => isGarmentWaterResistant(i));
    if (wetReady) {
      traces.push('Wetterfest: Regen- & wasserabweisende Materialien für Nässe');
    }
  } else if (context.weather === 'cloudy_windy') {
    const windPiece = coreItems.find(
      (i) =>
        i.windproof ||
        i.rainproof ||
        i.texture === 'tech_waterproof' ||
        i.subcategory === 'rain_jacket' ||
        i.subcategory === 'parka'
    );
    if (windPiece) {
      styleVibeBonus += 3;
      traces.push(`Windschutz: ${windPiece.name} schützt zuverlässig bei windigem Wetter`);
    }
  }

  // 7. Print, Logo & Open/Closed Shirt Styling Rules
  const printedItems = coreItems.filter((i) => i.hasPrint);
  const logoItems = coreItems.filter((i) => i.hasLogo);
  if (printedItems.length >= 2) {
    styleVibeBonus -= 8;
    traces.push('Print-Konflikt: Mehrere auffällige Prints im selben Outfit konkurrieren miteinander');
  } else if (printedItems.length === 1) {
    if (vibe === 'minimal_capsule') {
      styleVibeBonus -= 4;
    } else if (context.occasion === 'casual' || vibe === 'street_relaxed') {
      styleVibeBonus += 2;
      traces.push(`Lässiger Hingucker: ${printedItems[0].name} mit Print lockert das Outfit auf`);
    }
  } else if (logoItems.length === 1 && (context.occasion === 'casual' || vibe === 'street_relaxed')) {
    styleVibeBonus += 1;
    traces.push(`Dezentes Marken-Detail: ${logoItems[0].name} mit Logo-Akzent`);
  }

  if (midLayer && baseTop) {
    if (midLayer.wornOpen === true) {
      styleVibeBonus += 3;
      traces.push(`Offenes Layering: ${midLayer.name} locker offen über ${baseTop.name} getragen`);
    } else if (midLayer.wornOpen === false) {
      traces.push(`Klassisch geschlossen: ${midLayer.name} zugeknöpft getragen`);
    }
  }

  // Accessory synergy & styling traces (incl. short vs long socks explanation)
  if (accessoryItems.length > 0) {
    const accNames = accessoryItems.map((a) => a.name).join(', ');
    traces.push(`Abgestimmte Accessoires im Look: ${accNames}`);
    for (const accessoryItem of accessoryItems) {
      if (accessoryItem.subcategory === 'socks_short') {
        traces.push(
          `Kurze Socken (${accessoryItem.name}): Dezent im Schuh passend zu Sneakern & Temperatur`
        );
      } else if (accessoryItem.subcategory === 'socks') {
        traces.push(
          `Lange Socken (${accessoryItem.name}): Passend zu Schuhhöhe & Hose abgestimmt`
        );
      } else if (accessoryItem.subcategory === 'sunglasses' && context.weather === 'sunny_dry') {
        traces.push('Sonnenbrille schützt vor Blendung & setzt einen markanten Akzent');
      } else if (
        accessoryItem.subcategory === 'watch' ||
        accessoryItem.subcategory === 'necklace' ||
        accessoryItem.subcategory === 'bracelet'
      ) {
        const isWarmProfile = profile.undertone === 'warm' || profile.undertone === 'olive';
        const isMetalWarm =
          accessoryItem.colorTemp === 'warm' ||
          accessoryItem.colorName.toLowerCase().includes('gold') ||
          accessoryItem.colorName.toLowerCase().includes('bronze') ||
          accessoryItem.colorName.toLowerCase().includes('kupfer') ||
          accessoryItem.colorName.toLowerCase().includes('espresso');
        if (isWarmProfile && isMetalWarm) {
          traces.push(`Accessoire (${accessoryItem.name}): Warmer Ton harmoniert edel mit deinem Hautunterton`);
        } else if (!isWarmProfile && !isMetalWarm) {
          traces.push(`Accessoire (${accessoryItem.name}): Kühle Optik unterstreicht deinen Teint`);
        }
      }
    }
  }

  // Footwear accent color echo bonus (e.g. white sneakers with green/burgundy/navy accent matching top or bottom)
  const footwearItem = coreItems.find((i) => i.category === 'footwear');
  if (footwearItem && footwearItem.accentColorHex) {
    const accentHsl = hexToHsl(footwearItem.accentColorHex);
    const otherCoreItems = coreItems.filter((i) => i.id !== footwearItem.id);
    const echoedItem = otherCoreItems.find(
      (other) =>
        (footwearItem.accentColorName &&
          other.colorName.toLowerCase() === footwearItem.accentColorName.toLowerCase()) ||
        (Math.abs(accentHsl.l - other.hsl.l) < 25 &&
          getHueDistance(accentHsl.h, other.hsl.h) < 28)
    );
    if (echoedItem) {
      colorHarmony = Math.min(20, colorHarmony + 3);
      traces.push(
        `Farb-Echo: Akzentfarbe der Schuhe (${
          footwearItem.accentColorName || footwearItem.accentColorHex
        }) greift den Farbton von ${echoedItem.name} harmonisch auf`
      );
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
    // If a button-down shirt is explicitly worn closed (buttoned up), avoid hiding a graphic print tee underneath
    if (
      mid.wornOpen === false &&
      (mid.subcategory === 'button_down_shirt' || mid.subcategory === 'overshirt') &&
      top.hasPrint
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

  const accessories = eligible.filter((g) => g.category === 'accessory');
  const lockedAccessories = accessories.filter((g) => lockedSet.has(g.id));
  const lockedCoreIds = Array.from(lockedSet).filter(
    (id) => !lockedAccessories.some((a) => a.id === id)
  );

  const validCoreCombos = candidateCombos.filter((combo) => {
    if (lockedCoreIds.length === 0) return true;
    const ids = new Set(combo.map((c) => c.id));
    for (const lockedId of lockedCoreIds) {
      if (!ids.has(lockedId)) return false;
    }
    return true;
  });

  // If a locked item could not be satisfied at all (e.g. missing from eligible), return empty
  if (lockedSet.size > 0 && lockedCoreIds.length + lockedAccessories.length < lockedSet.size) {
    return [];
  }

  // Compute a deterministic style-vibe alignment tie-breaker so switching 'Stil' in the UI
  // visibly re-orders and surfaces outfits matching the chosen style direction.
  const getVibeAlignmentPriority = (outfit: GeneratedOutfit): number => {
    const vibe = context.styleVibe || 'balanced';
    if (vibe === 'balanced') return 0;

    const core = outfit.items.filter((i) => i.category !== 'accessory');
    const nonNeutrals = core.filter((i) => !isWardrobeNeutral(i.hsl, i.colorTemp));
    const avgSat =
      core.length > 0 ? core.reduce((s, i) => s + i.hsl.s, 0) / core.length : 20;

    if (vibe === 'minimal_capsule') {
      let score = nonNeutrals.length === 0 ? 40 : nonNeutrals.length === 1 ? 10 : -25;
      score += Math.max(0, 30 - avgSat);
      if (core.some((i) => i.subcategory === 'knit_sweater')) score += 12;
      if (core.some((i) => i.subcategory === 'sneaker_clean')) score += 8;
      if (core.some((i) => i.subcategory === 'chino' || i.subcategory === 'wide_leg_trousers')) score += 8;
      return score;
    }

    if (vibe === 'statement_editorial') {
      let score = nonNeutrals.length >= 1 ? 35 : -30;
      score += Math.min(25, avgSat);
      if (core.some((i) => i.subcategory === 'overshirt' || i.subcategory === 'blazer' || i.subcategory === 'trenchcoat')) score += 15;
      if (core.some((i) => i.subcategory === 'boots' || i.subcategory === 'heeled_ankle_boot')) score += 12;
      if (core.some((i) => i.colorName === 'Espresso' || i.colorName === 'Salbeigrün' || i.colorName === 'Burgunder')) score += 10;
      return score;
    }

    if (vibe === 'tailored_chic') {
      let score = 0;
      for (const item of core) {
        if (
          item.subcategory === 'button_down_shirt' ||
          item.subcategory === 'blazer' ||
          item.subcategory === 'turtleneck' ||
          item.subcategory === 'trenchcoat' ||
          item.subcategory === 'coat' ||
          item.subcategory === 'blouse'
        ) {
          score += 28;
        } else if (TAILORED_SUBCATEGORIES.includes(item.subcategory)) {
          score += 12;
        }
        if (
          item.subcategory === 'hoodie' ||
          item.subcategory === 'crewneck_sweater' ||
          item.subcategory === 'denim' ||
          item.subcategory === 'cargo' ||
          item.subcategory === 'shorts'
        ) {
          score -= 18;
        }
      }
      return score;
    }

    if (vibe === 'street_relaxed') {
      let score = 0;
      for (const item of core) {
        if (item.fit === 'relaxed' || item.fit === 'boxy_oversized') score += 12;
        if (
          item.subcategory === 'hoodie' ||
          item.subcategory === 'crewneck_sweater' ||
          item.subcategory === 'overshirt' ||
          item.subcategory === 'heavyweight_tee' ||
          item.subcategory === 'denim' ||
          item.subcategory === 'cargo' ||
          item.subcategory === 'sneaker_clean' ||
          item.subcategory === 'sneaker_chunky'
        ) {
          score += 10;
        }
        if (
          item.subcategory === 'button_down_shirt' ||
          item.subcategory === 'blazer' ||
          item.subcategory === 'turtleneck' ||
          item.subcategory === 'loafer_derby'
        ) {
          score -= 22;
        }
      }
      return score;
    }

    return 0;
  };

  const scoredCore = validCoreCombos
    .map((combo) => scoreOutfitCombination(combo, profile, context))
    .sort((a, b) => {
      const scoreA = a.totalScore + getVibeAlignmentPriority(a) * 0.35;
      const scoreB = b.totalScore + getVibeAlignmentPriority(b) * 0.35;
      return scoreB - scoreA;
    });

  if (limit <= 0 || scoredCore.length === 0) {
    if (lockedAccessories.length > 0) {
      return scoredCore.map((o) =>
        scoreOutfitCombination([...o.items, ...lockedAccessories], profile, context)
      );
    }
    return scoredCore;
  }

  const variationSeed = context.variationSeed || 0;

  // Deterministic Maximal Marginal Relevance (MMR) Diversity Selection on Core Outfits:
  // Ensures the Top N recommended outfits on the start page do not repeat the same
  // visible Mid-Layer, Outerwear, Bottom, Base-Top, or Footwear combination.
  // When variationSeed > 0 ("Neue Outfits generieren"), starts from a rotated top candidate
  // and applies a deterministic variation offset to surface fresh valid combinations.
  const startPoolSize = Math.min(scoredCore.length, Math.max(5, limit * 3));
  const firstIdx = variationSeed > 0 ? (variationSeed * 2) % startPoolSize : 0;
  const selected: GeneratedOutfit[] = [scoredCore[firstIdx]];
  const selectedIds = new Set<string>([scoredCore[firstIdx].id]);

  while (selected.length < limit && selected.length < scoredCore.length) {
    let bestCandidate: GeneratedOutfit | null = null;
    let bestDiversityScore = -Infinity;

    for (let cIdx = 0; cIdx < scoredCore.length; cIdx++) {
      const candidate = scoredCore[cIdx];
      if (selectedIds.has(candidate.id)) continue;

      let penalty = 0;
      const seedJitter =
        variationSeed > 0 ? (((cIdx * 7 + variationSeed * 13) % 11) - 5) * 2.2 : 0;
      let bonus = getVibeAlignmentPriority(candidate) * 0.25 + seedJitter;

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

  // Attach configured / enabled accessories (incl. context-aware short vs. long socks)
  if (accessories.length === 0) {
    return selected;
  }

  // Group unlocked eligible accessories by subcategory so each enabled accessory type can be represented
  const unlockedBySubcategory = new Map<GarmentSubcategory, Garment[]>();
  if (context.includeAccessories !== false) {
    for (const acc of accessories) {
      if (lockedSet.has(acc.id)) continue;
      const list = unlockedBySubcategory.get(acc.subcategory) || [];
      list.push(acc);
      unlockedBySubcategory.set(acc.subcategory, list);
    }
  }

  return selected.map((coreOutfit, outfitIdx) => {
    const attachedAccessories: Garment[] = [...lockedAccessories];
    const attachedSubcategories = new Set<GarmentSubcategory>(
      lockedAccessories.map((a) => a.subcategory)
    );

    if (context.includeAccessories !== false) {
      const shoe = coreOutfit.items.find((i) => i.category === 'footwear');
      const bottom = coreOutfit.items.find((i) => i.category === 'bottom');
      const isSandal = shoe?.subcategory === 'sandal_strappy';
      const isBoot =
        shoe?.subcategory === 'boots' || shoe?.subcategory === 'heeled_ankle_boot';
      const isShortBottom =
        bottom?.subcategory === 'shorts' || bottom?.subcategory === 'mini_skirt';

      // 1. Handle Socks (choose EITHER 'socks' [Lange Socken] OR 'socks_short' [Kurze Socken], never both!)
      const hasLockedSock =
        attachedSubcategories.has('socks') || attachedSubcategories.has('socks_short');
      if (!hasLockedSock && !isSandal) {
        const longSockCandidates = unlockedBySubcategory.get('socks') || [];
        const shortSockCandidates = unlockedBySubcategory.get('socks_short') || [];

        // Recommend short socks for low-top shoes with shorts/skirts, warm weather (>=20°C),
        // or alternating sneaker outfits in mild weather (16-19°C)
        const prefersShortSocks =
          !isBoot &&
          (isShortBottom ||
            context.temperatureC >= 20 ||
            (context.temperatureC >= 16 &&
              outfitIdx % 2 === 1 &&
              context.styleVibe !== 'tailored_chic'));

        const primaryPool = prefersShortSocks ? shortSockCandidates : longSockCandidates;
        const fallbackPool = isBoot
          ? [] // Never recommend short sneaker socks inside high boots unless explicitly locked
          : prefersShortSocks
          ? longSockCandidates
          : shortSockCandidates;

        const activePool = primaryPool.length > 0 ? primaryPool : fallbackPool;
        if (activePool.length > 0) {
          const sortedSocks = [...activePool].sort((a, b) => {
            const scoreA = scoreGarmentBiometrics(a, profile).score;
            const scoreB = scoreGarmentBiometrics(b, profile).score;
            return scoreB - scoreA;
          });
          const chosenSock = sortedSocks[outfitIdx % sortedSocks.length];
          attachedAccessories.push(chosenSock);
          attachedSubcategories.add(chosenSock.subcategory);
        }
      }

      // 2. Attach remaining enabled non-sock accessories
      for (const [subcat, candidates] of unlockedBySubcategory.entries()) {
        if (subcat === 'socks' || subcat === 'socks_short') continue;
        if (attachedSubcategories.has(subcat) || candidates.length === 0) continue;
        const sortedCandidates = [...candidates].sort((a, b) => {
          const scoreA = scoreGarmentBiometrics(a, profile).score;
          const scoreB = scoreGarmentBiometrics(b, profile).score;
          return scoreB - scoreA;
        });
        const chosen = sortedCandidates[outfitIdx % sortedCandidates.length];
        attachedAccessories.push(chosen);
        attachedSubcategories.add(subcat);
      }
    }

    if (attachedAccessories.length === 0) {
      return coreOutfit;
    }

    return scoreOutfitCombination(
      [...coreOutfit.items, ...attachedAccessories],
      profile,
      context
    );
  });
}
