import {
  DEFAULT_BIOMETRIC_PROFILE,
  SUBCATEGORIES_BY_CATEGORY,
  TEXTILE_COLOR_PRESETS,
} from '../data/seedData';
import {
  BiometricProfile,
  FitType,
  GapAnalysisReport,
  Garment,
  GarmentCategory,
  GarmentSubcategory,
  NecklineType,
  TextureType,
} from '../types/wardrobe';
import { classifyColorTemp, deriveSeasonPalette, hexToHsl, scoreGarmentBiometrics } from './colorMath';

const VALID_CATEGORIES: GarmentCategory[] = [
  'base_top',
  'mid_layer',
  'outerwear',
  'bottom',
  'footwear',
  'accessory',
];

const VALID_SUBCATEGORIES: GarmentSubcategory[] = Object.values(
  SUBCATEGORIES_BY_CATEGORY
).flat();

const VALID_FITS: FitType[] = ['slim', 'regular', 'relaxed', 'boxy_oversized'];

const VALID_NECKLINES: NecklineType[] = [
  'crewneck',
  'heavy_crewneck',
  'v_neck',
  'stand_collar',
  'shirt_collar',
  'turtleneck',
  'hooded',
  'none',
];

const VALID_TEXTURES: TextureType[] = [
  'smooth_cotton',
  'heavy_jersey',
  'twill_chino',
  'denim',
  'chunky_knit',
  'fine_knit',
  'flannel_wool',
  'linen',
  'tech_waterproof',
  'leather_suede',
];

export interface ParsedWardrobeImportResult {
  ok: boolean;
  garments: Garment[];
  profile?: BiometricProfile;
  warnings: string[];
  error?: string;
}

/**
 * Infers GarmentCategory from GarmentSubcategory if category was omitted or invalid in LLM output
 */
function inferCategoryFromSubcategory(sub: GarmentSubcategory): GarmentCategory {
  for (const cat of VALID_CATEGORIES) {
    if (SUBCATEGORIES_BY_CATEGORY[cat].includes(sub)) {
      return cat;
    }
  }
  return 'base_top';
}

/**
 * Normalizes a hex string or attempts to match a preset color name if hex is missing
 */
function resolveColorHex(rawHex: unknown, rawColorName: unknown): string {
  if (typeof rawHex === 'string') {
    const trimmed = rawHex.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) {
      return `#${trimmed.toUpperCase()}`;
    }
  }
  if (typeof rawColorName === 'string' && rawColorName.trim()) {
    const lower = rawColorName.toLowerCase();
    const match = TEXTILE_COLOR_PRESETS.find((p) =>
      lower.includes(p.name.toLowerCase().split(' ')[0])
    );
    if (match) return match.hex;
  }
  return '#8F9779';
}

/**
 * Parses and normalizes JSON or Markdown-fenced JSON from a user backup or an external LLM response.
 * Automatically calculates HSL and ColorTemp deterministically and repairs missing/invalid enum fields.
 */
export function parseAndNormalizeWardrobeImport(rawInput: string): ParsedWardrobeImportResult {
  const warnings: string[] = [];
  const trimmed = rawInput.trim();

  if (!trimmed) {
    return {
      ok: false,
      garments: [],
      warnings: [],
      error: 'Bitte füge einen JSON-Text ein oder wähle eine .json-Datei aus.',
    };
  }

  // Strip Markdown code fences (e.g. ```json ... ```) if an LLM wrapped the output
  let jsonCandidate = trimmed;
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1]) {
    jsonCandidate = fenceMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch (e) {
    return {
      ok: false,
      garments: [],
      warnings: [],
      error: `Ungültiges JSON-Format: ${(e as Error).message}`,
    };
  }

  let rawGarments: unknown[] = [];
  let parsedProfile: BiometricProfile | undefined = undefined;

  if (Array.isArray(parsed)) {
    rawGarments = parsed;
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.garments)) {
      rawGarments = obj.garments;
    } else if (Array.isArray(obj.items)) {
      rawGarments = obj.items;
    } else if (typeof obj.name === 'string' && (obj.category || obj.subcategory)) {
      // Single garment object
      rawGarments = [obj];
    }

    if (obj.profile && typeof obj.profile === 'object') {
      parsedProfile = {
        ...DEFAULT_BIOMETRIC_PROFILE,
        ...(obj.profile as Partial<BiometricProfile>),
        id: 'default_profile',
      };
    }
  }

  if (rawGarments.length === 0 && !parsedProfile) {
    return {
      ok: false,
      garments: [],
      warnings: [],
      error:
        'Keine Kleidungsstücke im JSON gefunden. Erwartet wird ein Array [...] oder ein Objekt mit {"garments": [...]}.',
    };
  }

  const normalizedGarments: Garment[] = [];

  rawGarments.forEach((rawItem, idx) => {
    if (!rawItem || typeof rawItem !== 'object') {
      warnings.push(`Eintrag #${idx + 1} übersprungen (kein Objekt).`);
      return;
    }
    const item = rawItem as Record<string, unknown>;

    const rawSub = String(item.subcategory || '').trim() as GarmentSubcategory;
    const rawCat = String(item.category || '').trim() as GarmentCategory;

    let subcategory: GarmentSubcategory;
    let category: GarmentCategory;

    if (VALID_SUBCATEGORIES.includes(rawSub)) {
      subcategory = rawSub;
      category = VALID_CATEGORIES.includes(rawCat)
        ? rawCat
        : inferCategoryFromSubcategory(subcategory);
    } else if (VALID_CATEGORIES.includes(rawCat)) {
      category = rawCat;
      subcategory = SUBCATEGORIES_BY_CATEGORY[category][0];
      if (rawSub) {
        warnings.push(
          `Eintrag #${idx + 1}: Unbekannte Subkategorie "${rawSub}" → auf "${subcategory}" normiert.`
        );
      }
    } else {
      category = 'base_top';
      subcategory = 't_shirt';
      warnings.push(
        `Eintrag #${idx + 1}: Fehlende Kategorie/Subkategorie → auf "base_top / t_shirt" gesetzt.`
      );
    }

    const colorHex = resolveColorHex(item.colorHex, item.colorName);
    const colorName =
      typeof item.colorName === 'string' && item.colorName.trim()
        ? item.colorName.trim()
        : colorHex;

    const name =
      typeof item.name === 'string' && item.name.trim()
        ? item.name.trim()
        : `${subcategory} ${colorName}`;

    const rawFit = String(item.fit || 'regular') as FitType;
    const fit: FitType = VALID_FITS.includes(rawFit) ? rawFit : 'regular';

    const isLowerBody = category === 'bottom' || category === 'footwear';
    const rawNeck = String(item.neckline || (isLowerBody ? 'none' : 'crewneck')) as NecklineType;
    const neckline: NecklineType = isLowerBody
      ? 'none'
      : VALID_NECKLINES.includes(rawNeck) && rawNeck !== 'none'
      ? rawNeck
      : 'crewneck';

    const rawTex = String(item.texture || 'smooth_cotton') as TextureType;
    const texture: TextureType = VALID_TEXTURES.includes(rawTex) ? rawTex : 'smooth_cotton';

    const rawThermal = Number(item.thermalRating);
    const thermalRating = (
      Number.isFinite(rawThermal) ? Math.max(1, Math.min(5, Math.round(rawThermal))) : 2
    ) as 1 | 2 | 3 | 4 | 5;

    const rawFormality = Number(item.formality);
    const formality = (
      Number.isFinite(rawFormality) ? Math.max(1, Math.min(5, Math.round(rawFormality))) : 3
    ) as 1 | 2 | 3 | 4 | 5;

    const waterResistant = Boolean(item.waterResistant);
    const isClean = item.isClean === undefined ? true : Boolean(item.isClean);
    const isWishlistSandbox = Boolean(item.isWishlistSandbox);

    const hsl = hexToHsl(colorHex);
    const colorTemp = classifyColorTemp(hsl);

    const id =
      typeof item.id === 'string' && item.id.trim()
        ? item.id.trim()
        : `import_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;

    normalizedGarments.push({
      id,
      name,
      category,
      subcategory,
      colorName,
      colorHex,
      hsl,
      colorTemp,
      fit,
      neckline,
      texture,
      thermalRating,
      formality,
      waterResistant,
      isClean,
      isWishlistSandbox,
      imageDataUrl: typeof item.imageDataUrl === 'string' ? item.imageDataUrl : undefined,
    });
  });

  return {
    ok: true,
    garments: normalizedGarments,
    profile: parsedProfile,
    warnings,
  };
}

/**
 * Generates a structured JSON Schema + Prompt so the user can paste their wardrobe into any external LLM
 * for analysis, reorganization, or new item generation, receiving valid JSON back for immediate import.
 */
export function buildLlmWardrobeAnalysisPrompt(
  profile: BiometricProfile,
  garments: Garment[],
  gapReport: GapAnalysisReport
): string {
  const season = deriveSeasonPalette(profile);

  const compactGarments = garments.map((g) => ({
    id: g.id,
    name: g.name,
    category: g.category,
    subcategory: g.subcategory,
    colorName: g.colorName,
    colorHex: g.colorHex,
    fit: g.fit,
    neckline: g.neckline,
    texture: g.texture,
    thermalRating: g.thermalRating,
    formality: g.formality,
    waterResistant: g.waterResistant,
    isClean: g.isClean,
    biometricScore: scoreGarmentBiometrics(g, profile).score,
    validOutfitsCount: gapReport.outfitCountsByGarmentId[g.id] || 0,
  }));

  return `# AUFGABE: Biometrische Kleiderschrank-Analyse & Strukturierter JSON-Export

Du bist ein datengetriebener Menswear/Womenswear-Stylist und Farbtheorie-Experte.
Unten findest du mein **Biometrisches Profil**, meine abgeleitete **12-Jahreszeiten-Farbpalette (${season.seasonName})**, den aktuellen **Gap-Report** sowie mein komplettes **Kleiderschrank-Inventar als JSON**.

Bitte:
1. Analysiere meinen aktuellen Kleiderschrank auf Stärken, Farb-Brücken und Engpässe.
2. Schlage mir konkrete Ergänzungen oder Optimierungen vor, die perfekt zu meinem Biometrie-Profil passen.
3. **WICHTIG FÜR DEN RE-IMPORT IN MEINE APP:** Gib alle neuen oder angepassten Kleidungsstücke am Ende deiner Antwort in einem einzigen \`\`\`json ... \`\`\` Codeblock exakt nach folgendem Schema aus, damit ich sie mit 1 Klick direkt in meine App importieren kann!

---

## 1. ERLAUBTES JSON-SCHEMA FÜR DEN APP-IMPORT

\`\`\`typescript
interface ImportGarment {
  name: string; // z.B. "Merino Rollkragen Dunkel-Oliv"
  category: "base_top" | "mid_layer" | "outerwear" | "bottom" | "footwear";
  subcategory:
    | "t_shirt" | "heavyweight_tee" | "polo" | "longsleeve"
    | "overshirt" | "button_down_shirt" | "crewneck_sweater" | "knit_sweater" | "turtleneck" | "hoodie" | "cardigan"
    | "light_jacket" | "coat" | "parka" | "blouson"
    | "chino" | "denim" | "trousers" | "cargo" | "shorts"
    | "sneaker_clean" | "sneaker_chunky" | "boots" | "loafer_derby" | "runner";
  colorName: string; // z.B. "Salbeigrün", "Espresso", "Navy"
  colorHex: string;  // Exakter 6-stelliger Hex-Code, z.B. "#8F9779"
  fit: "slim" | "regular" | "relaxed" | "boxy_oversized";
  neckline: "crewneck" | "heavy_crewneck" | "v_neck" | "stand_collar" | "shirt_collar" | "turtleneck" | "hooded" | "none"; // "none" bei Hosen/Schuhen
  texture: "smooth_cotton" | "heavy_jersey" | "twill_chino" | "denim" | "chunky_knit" | "fine_knit" | "flannel_wool" | "linen" | "tech_waterproof" | "leather_suede";
  thermalRating: 1 | 2 | 3 | 4 | 5; // 1=>24°C, 2=18-23°C, 3=12-17°C, 4=5-11°C, 5=<5°C
  formality: 1 | 2 | 3 | 4 | 5;     // 1=Sport, 2=Casual, 3=Smart Casual, 4=Business/Chic, 5=Formal
  waterResistant: boolean;
  isClean: boolean;
  isWishlistSandbox?: boolean;      // true, wenn es ein Kaufvorschlag zum Testen ist
}
\`\`\`

---

## 2. MEIN BIOMETRISCHES PROFIL & FARBPALETTE

\`\`\`json
${JSON.stringify(
  {
    profile,
    derivedSeason: season.seasonName,
    powerColors: season.powerColors.map((c) => `${c.name} (${c.hex})`),
    coreNeutrals: season.coreNeutrals.map((c) => `${c.name} (${c.hex})`),
    avoidColors: season.avoidColors.map((c) => `${c.name} (${c.hex})`),
    wardrobeHealthScore: gapReport.wardrobeHealthScore,
    orphanPieces: gapReport.orphanPieces.map((o) => o.garment.name),
  },
  null,
  2
)}
\`\`\`

---

## 3. MEIN AKTUELLER KLEIDERSCHRANK (${garments.length} TEILE)

\`\`\`json
${JSON.stringify(compactGarments, null, 2)}
\`\`\`
`;
}

/**
 * Generates a prompt template for converting raw user descriptions or photos into importable JSON.
 */
export function buildLlmPhotoToJsonPrompt(profile: BiometricProfile): string {
  const season = deriveSeasonPalette(profile);

  return `# AUFGABE: Kleidungsstücke (Text oder Fotos) in strukturiertes App-JSON umwandeln

Ich möchte neue Kleidungsstücke in meine deterministische Garderoben-App ("ATELIER BIOMETRIC") importieren.
Bitte wandle die Kleidungsstücke, die ich dir gleich beschreibe oder als Foto hochlade, in ein **valides JSON-Array** um.

Antworte mit einem \`\`\`json ... \`\`\` Codeblock, der ein Array von Objekten nach exakt diesen erlaubten Enum-Werten enthält:

\`\`\`json
[
  {
    "name": "Bezeichnung + Farbe (z.B. Heavyweight Tee Salbeigrün)",
    "category": "base_top | mid_layer | outerwear | bottom | footwear",
    "subcategory": "t_shirt | heavyweight_tee | polo | longsleeve | overshirt | button_down_shirt | crewneck_sweater | knit_sweater | turtleneck | hoodie | cardigan | light_jacket | coat | parka | blouson | chino | denim | trousers | cargo | shorts | sneaker_clean | sneaker_chunky | boots | loafer_derby | runner",
    "colorName": "Deutscher Farbname (z.B. Salbeigrün, Dunkel-Oliv, Off-White, Espresso)",
    "colorHex": "#8F9779",
    "fit": "slim | regular | relaxed | boxy_oversized",
    "neckline": "crewneck | heavy_crewneck | v_neck | stand_collar | shirt_collar | turtleneck | hooded | none",
    "texture": "smooth_cotton | heavy_jersey | twill_chino | denim | chunky_knit | fine_knit | flannel_wool | linen | tech_waterproof | leather_suede",
    "thermalRating": 2,
    "formality": 3,
    "waterResistant": false,
    "isClean": true,
    "isWishlistSandbox": false
  }
]
\`\`\`

Hinweis zu meinem Farbtyp (${season.seasonName}):
Typische Referenz-Hexcodes meiner Palette sind u.a.:
${season.powerColors
  .slice(0, 6)
  .map((c) => `- ${c.name}: ${c.hex}`)
  .join('\n')}
${season.coreNeutrals
  .slice(0, 4)
  .map((c) => `- ${c.name}: ${c.hex}`)
  .join('\n')}

Hier sind meine Kleidungsstücke zum Konvertieren:
[HIER FOTOS HOCHLADEN ODER KLEIDUNGSSTÜCKE KURZ AUFLISTEN]`;
}
