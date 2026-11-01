import {
  BiometricProfile,
  BiometricScoreResult,
  Garment,
  NecklineType,
  SeasonPalette,
  TextureType,
  Undertone,
} from '../types/wardrobe';

/**
 * Converts a hex color string (#RRGGBB or #RGB) to HSL { h: 0-360, s: 0-100, l: 0-100 }
 */
export function hexToHsl(colorHex: string): { h: number; s: number; l: number } {
  let cleanHex = colorHex.trim().replace(/^#/, '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    return { h: 0, s: 0, l: 50 };
  }

  const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
  const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
  const b = parseInt(cleanHex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360) % 360,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Classifies HSL color into 'neutral', 'warm', or 'cool'.
 * - Neutral if s < 12 or l < 12 or l > 92 (black, white, charcoal, grey).
 * - Warm if Hue falls in warm ranges (0°-75° or 330°-360° with warm/deep shift) or earthy olive/forest undertones (76°-165° with muted/earthy saturation).
 * - Cool if Hue falls in 160°-310° or blue-based greens/reds.
 */
export function classifyColorTemp(hsl: { h: number; s: number; l: number }): 'warm' | 'cool' | 'neutral' {
  const { h, s, l } = hsl;

  if (s < 12 || l < 12 || l > 92) {
    return 'neutral';
  }

  // Warm hues: reds, oranges, yellows, warm golds (0-75), earthy olives/moss/forest greens (76-159 with s <= 55), warm burgundies/terracottas (335-360 with l < 65)
  if (
    (h >= 0 && h <= 75) ||
    (h >= 76 && h <= 159 && s <= 55) ||
    (h >= 335 && h <= 360 && l <= 60)
  ) {
    return 'warm';
  }

  // Cool hues: 160-310 or high-saturation blue-greens or icy/neon pinks/magentas
  if (h >= 113 && h <= 359) {
    return 'cool';
  }

  return 'neutral';
}

/**
 * Computes shortest circular distance between two hue angles (0 - 180)
 */
export function getHueDistance(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Computes color distance in HSL space for duplicate archetype detection
 */
export function getHslDistance(
  a: { h: number; s: number; l: number },
  b: { h: number; s: number; l: number }
): number {
  if (a.s < 14 && b.s < 14) {
    return Math.abs(a.l - b.l) * 1.4 + Math.abs(a.s - b.s) * 0.5;
  }
  const hueDist = getHueDistance(a.h, b.h);
  const satDiff = Math.abs(a.s - b.s);
  const lightDiff = Math.abs(a.l - b.l);
  return hueDist * 0.6 + satDiff * 0.4 + lightDiff * 0.6;
}

/**
 * Checks if a garment acts as a versatile wardrobe neutral (including classic menswear/womenswear neutrals
 * like Navy, Sand/Beige, Espresso, Charcoal, Off-White, Taupe, Black).
 */
export function isWardrobeNeutral(hsl: { h: number; s: number; l: number }, colorTemp: 'warm' | 'cool' | 'neutral'): boolean {
  if (colorTemp === 'neutral') return true;
  // Classic dark navy or slate/charcoal
  if (hsl.h >= 195 && hsl.h <= 245 && hsl.l <= 28 && hsl.s <= 45) return true;
  // Classic warm neutrals: sand, beige, stone, khaki, espresso, camel (low-to-moderate saturation)
  if (hsl.h >= 15 && hsl.h <= 52 && hsl.s <= 36 && (hsl.l >= 70 || hsl.l <= 28)) return true;
  return false;
}

/**
 * Checks whether a neutral or classic core color is approved for a specific skin undertone.
 */
export function isApprovedNeutralForUndertone(
  hsl: { h: number; s: number; l: number },
  colorTemp: 'warm' | 'cool' | 'neutral',
  undertone: Undertone
): boolean {
  if (colorTemp === 'neutral') {
    if ((undertone === 'warm' || undertone === 'olive') && hsl.l > 97) {
      return false;
    }
    return true;
  }

  // Deep Navy (#1B263B) is a universal classic neutral across cool, neutral, and olive
  const isDeepNavy = hsl.h >= 200 && hsl.h <= 240 && hsl.l <= 26 && hsl.s <= 45;
  if (isDeepNavy && (undertone === 'cool' || undertone === 'neutral' || undertone === 'olive')) {
    return true;
  }

  // Warm/Olive approved neutrals & muted petrol/forest tones
  if (undertone === 'warm' || undertone === 'olive' || undertone === 'neutral') {
    const isEspressoOrCamel = hsl.h >= 10 && hsl.h <= 50 && hsl.s <= 40 && (hsl.l <= 30 || hsl.l >= 68);
    const isMutedOliveOrPetrol = hsl.h >= 65 && hsl.h <= 198 && hsl.s <= 48 && hsl.l <= 62;
    if (isEspressoOrCamel || isMutedOliveOrPetrol) return true;
  }

  // Cool approved neutrals
  if (undertone === 'cool' || undertone === 'neutral') {
    const isCoolSlate = hsl.h >= 195 && hsl.h <= 255 && hsl.s <= 35;
    if (isCoolSlate) return true;
  }

  return false;
}

const UNDERTONE_LABELS: Record<Undertone, string> = {
  cool: 'kühlen',
  warm: 'warmen',
  neutral: 'neutralen',
  olive: 'oliv-warmen',
};

/**
 * Deterministically maps BiometricProfile (undertone + contrastLevel + chromaLevel + valueLevel)
 * to one of the 12 Color Seasons, returning 12 Power Colors, 6 Core Neutrals, 6 Avoid Colors, and Top 3 Necklines.
 */
export function deriveSeasonPalette(profile: BiometricProfile): SeasonPalette {
  const { undertone, contrastLevel, chromaLevel, valueLevel, haircutStyle } = profile;

  const recommendedNecklines = getRecommendedNecklines(haircutStyle);

  if (undertone === 'olive' || undertone === 'warm') {
    if (chromaLevel === 'muted') {
      return {
        seasonName: 'Warme & ruhige Naturfarben – Soft Autumn (Gedämpfter Herbst)',
        seasonSubtitle: 'Einfach erklärt: Dir stehen warme, sanfte Erd- und Naturtöne am besten',
        description:
          'Das bedeutet für dich: Warme, unaufdringliche Farben wie Salbeigrün, Oliv, Beige, Dunkelbraun, Creme und Weinrot lassen dein Gesicht sofort frisch und erholt wirken. Sehr grelle Neonfarben oder eiskaltes Pink wirken dagegen schnell zu hart.',
        powerColors: [
          { name: 'Salbeigrün', hex: '#8F9779', categoryHint: 'T-Shirts & Knitwear' },
          { name: 'Dunkel-Oliv', hex: '#4B5320', categoryHint: 'Overshirts & Jacken' },
          { name: 'Burgunder Gedeckt', hex: '#5E2129', categoryHint: 'Strick & Akzent-Tops' },
          { name: 'Terrakotta Gedämpft', hex: '#A85A44', categoryHint: 'Sweater & Polos' },
          { name: 'Waldkiefer', hex: '#2D4A3E', categoryHint: 'Mid-Layer & Jacken' },
          { name: 'Ocker-Senf Gedeckt', hex: '#B88B4A', categoryHint: 'Feinstrick' },
          { name: 'Petrol-Teal', hex: '#355C67', categoryHint: 'Hemden & Polos' },
          { name: 'Rostbraun', hex: '#7C3F2C', categoryHint: 'Overshirts' },
          { name: 'Moosgrün', hex: '#636B46', categoryHint: 'T-Shirts & Cargos' },
          { name: 'Pflaume Gedämpft', hex: '#583A4E', categoryHint: 'Abend-Strick' },
          { name: 'Kupfer-Zimt', hex: '#945B3E', categoryHint: 'Cardigans' },
          { name: 'Eukalyptus', hex: '#6F8578', categoryHint: 'Leinen & Jersey' },
        ],
        coreNeutrals: [
          { name: 'Off-White / Ecru', hex: '#F4F1EA', categoryHint: 'Base-Tops' },
          { name: 'Sand / Beige', hex: '#D5C7B8', categoryHint: 'Chinos & Hemden' },
          { name: 'Espresso', hex: '#3B2F2F', categoryHint: 'Schuhe & Mäntel' },
          { name: 'Anthrazit Warm', hex: '#2B2D42', categoryHint: 'Trousers & Coats' },
          { name: 'Tiefes Navy', hex: '#1B263B', categoryHint: 'Struktur-Basics' },
          { name: 'Warmes Taupe', hex: '#8A7E72', categoryHint: 'Hosen & Strick' },
        ],
        avoidColors: [
          { name: 'Eisrosa', hex: '#F7C6DB' },
          { name: 'Neon-Magenta', hex: '#FF1493' },
          { name: 'Eisblau', hex: '#C6ECFF' },
          { name: 'Knallgelb', hex: '#FFF200' },
          { name: 'Elektrisch Cyan', hex: '#00E5FF' },
          { name: 'Reinweiß Hart', hex: '#FFFFFF' },
        ],
        recommendedNecklines,
      };
    }

    if (valueLevel === 'dark' || contrastLevel === 'high') {
      return {
        seasonName: 'Kräftige, warme dunkle Töne – Dark Autumn (Tiefer Herbst)',
        seasonSubtitle: 'Einfach erklärt: Dir stehen dunkle, warme Farben und klare Hell-Dunkel-Outfits',
        description:
          'Das bedeutet für dich: Durch den Kontrast zwischen deinen Haaren und deiner Haut stehen dir satte, dunkle Naturfarben wie Dunkelbraun, Tannengrün, Weinrot, Oliv und Creme besonders gut – viel besser als blasse Pastellfarben.',
        powerColors: [
          { name: 'Oxblood / Burgunder', hex: '#5E2129', categoryHint: 'Strick & Blousons' },
          { name: 'Tannengrün', hex: '#1E3F2B', categoryHint: 'Overshirts & Mäntel' },
          { name: 'Dunkel-Oliv', hex: '#4B5320', categoryHint: 'Feldjacken & Hemden' },
          { name: 'Rost-Karamell', hex: '#8F4326', categoryHint: 'Feinstrick' },
          { name: 'Tiefes Petrol', hex: '#1D4E56', categoryHint: 'Polos & Hemden' },
          { name: 'Bronze-Gold', hex: '#9A6E2F', categoryHint: 'Akzent-Layer' },
          { name: 'Aubergine Warm', hex: '#47243B', categoryHint: 'Turtlenecks' },
          { name: 'Kupferrot', hex: '#8C3828', categoryHint: 'Heavyweight Tees' },
          { name: 'Salbeigrün', hex: '#8F9779', categoryHint: 'Kontrast-Base' },
          { name: 'Zedernholz', hex: '#5C3A28', categoryHint: 'Wolljacken' },
          { name: 'Senfgold', hex: '#B5892E', categoryHint: 'Strick-Akzent' },
          { name: 'Moos-Dunkel', hex: '#3B4928', categoryHint: 'Trousers & Tops' },
        ],
        coreNeutrals: [
          { name: 'Espresso', hex: '#3B2F2F', categoryHint: 'Leder & Mäntel' },
          { name: 'Schwarz-Braun', hex: '#1A1615', categoryHint: 'Boots & Hosen' },
          { name: 'Off-White / Creme', hex: '#F4F1EA', categoryHint: 'Kontrast-Tees' },
          { name: 'Tiefes Navy', hex: '#1B263B', categoryHint: 'Anzug & Chino' },
          { name: 'Kamel / Sand', hex: '#C6A47E', categoryHint: 'Coats & Chinos' },
          { name: 'Anthrazit', hex: '#2B2D42', categoryHint: 'Hosen' },
        ],
        avoidColors: [
          { name: 'Pastell-Lavendel', hex: '#E3D1F9' },
          { name: 'Babyblau', hex: '#BFE6FF' },
          { name: 'Eisminze', hex: '#C9FFF2' },
          { name: 'Blassrosa', hex: '#FFD6E7' },
          { name: 'Neon-Grün', hex: '#39FF14' },
          { name: 'Kühles Silbergrau', hex: '#C8CED6' },
        ],
        recommendedNecklines,
      };
    }

    if (chromaLevel === 'bright') {
      return {
        seasonName: 'Frische, warme Farben – Warm Spring (Klarer Frühling)',
        seasonSubtitle: 'Einfach erklärt: Dir stehen freundliche, warme und leuchtende Farbtöne',
        description:
          'Das bedeutet für dich: Warme, frische Farben wie Korallrot, Smaragdgrün, Kamel, Beige und warmes Blau lassen dich strahlen. Zu düstere, komplett schwarze Outfits direkt am Gesicht wirken dagegen oft zu streng.',
        powerColors: [
          { name: 'Warmes Korallrot', hex: '#D9534F', categoryHint: 'Polos & Tees' },
          { name: 'Smaragd-Grün', hex: '#2E7D5B', categoryHint: 'Strick & Hemden' },
          { name: 'Sonnengold', hex: '#D99B26', categoryHint: 'Akzent-Strick' },
          { name: 'Warmes Türkis', hex: '#2A8C8C', categoryHint: 'Sommer-Hemden' },
          { name: 'Terrakotta Klar', hex: '#C45B3E', categoryHint: 'Overshirts' },
          { name: 'Oliv-Frisch', hex: '#6B7F35', categoryHint: 'Casual Tops' },
          { name: 'Kobalt Warm', hex: '#2B5B9E', categoryHint: 'Jacken' },
          { name: 'Pfirsich-Sand', hex: '#E09F7D', categoryHint: 'Leinenhemden' },
          { name: 'Salbeigrün', hex: '#8F9779', categoryHint: 'Alltags-Basics' },
          { name: 'Karamell', hex: '#B87333', categoryHint: 'Leder & Strick' },
          { name: 'Mohnrot', hex: '#C8372D', categoryHint: 'Statement-Top' },
          { name: 'Aquamarin', hex: '#439A86', categoryHint: 'Polos' },
        ],
        coreNeutrals: [
          { name: 'Elfenbein / Off-White', hex: '#F4F1EA', categoryHint: 'Tees & Hemden' },
          { name: 'Warmes Beige', hex: '#D5C7B8', categoryHint: 'Chinos' },
          { name: 'Kamel', hex: '#C19A6B', categoryHint: 'Mäntel' },
          { name: 'Schokoladenbraun', hex: '#3B2F2F', categoryHint: 'Schuhe' },
          { name: 'Marineblau', hex: '#1B263B', categoryHint: 'Trousers' },
          { name: 'Warmes Grau', hex: '#6E6A63', categoryHint: 'Strick' },
        ],
        avoidColors: [
          { name: 'Tiefschwarz Stumpf', hex: '#050505' },
          { name: 'Kühles Mauve', hex: '#91738A' },
          { name: 'Eisgrau', hex: '#D0D7DE' },
          { name: 'Dunkles Violett', hex: '#2E113D' },
          { name: 'Eisblau', hex: '#C4E7FF' },
          { name: 'Aschbraun', hex: '#5A5552' },
        ],
        recommendedNecklines,
      };
    }

    return {
      seasonName: 'Klassische warme Erdtöne – True Autumn (Wahrer Herbst)',
      seasonSubtitle: 'Einfach erklärt: Dir stehen warme Naturtöne wie Oliv, Kamel, Braun & Beige',
      description:
        'Das bedeutet für dich: Dein Typ sieht in warmen Naturfarben wie Olivgrün, Rostbraun, Salbei, Kamel, Dunkelbraun und Creme (statt hartem Reinweiß) besonders harmonisch aus.',
      powerColors: [
        { name: 'Dunkel-Oliv', hex: '#4B5320', categoryHint: 'Overshirts & Jacken' },
        { name: 'Salbeigrün', hex: '#8F9779', categoryHint: 'Tees & Hemden' },
        { name: 'Rost-Terrakotta', hex: '#9E4732', categoryHint: 'Strickpullover' },
        { name: 'Burgunder Warm', hex: '#5E2129', categoryHint: 'Merino-Knit' },
        { name: 'Waldgrün', hex: '#2A4B3C', categoryHint: 'Blousons & Polos' },
        { name: 'Senf-Ocker', hex: '#C28C38', categoryHint: 'Akzent-Tops' },
        { name: 'Petrol', hex: '#2C5E6B', categoryHint: 'Button-Downs' },
        { name: 'Karamell-Braun', hex: '#8A5229', categoryHint: 'Leder & Strick' },
        { name: 'Moosgrün', hex: '#5E6B3C', categoryHint: 'Heavyweight Tees' },
        { name: 'Kupfer', hex: '#A65438', categoryHint: 'Cardigans' },
        { name: 'Pflaume Warm', hex: '#5A2B41', categoryHint: 'Abend-Outfits' },
        { name: 'Gold-Beige', hex: '#C8A97E', categoryHint: 'Leinen & Chinos' },
      ],
      coreNeutrals: [
        { name: 'Off-White', hex: '#F4F1EA', categoryHint: 'Base-Tops' },
        { name: 'Sand / Beige', hex: '#D5C7B8', categoryHint: 'Chinos' },
        { name: 'Espresso', hex: '#3B2F2F', categoryHint: 'Boots & Gürtel' },
        { name: 'Navy Gedeckt', hex: '#1B263B', categoryHint: 'Mäntel & Hosen' },
        { name: 'Anthrazit', hex: '#2B2D42', categoryHint: 'Wollhosen' },
        { name: 'Khaki-Stein', hex: '#9E9281', categoryHint: 'Alltags-Hosen' },
      ],
      avoidColors: [
        { name: 'Eisrosa', hex: '#F9C9E2' },
        { name: 'Neon-Pink', hex: '#FF1080' },
        { name: 'Kühles Babyblau', hex: '#B8E2FF' },
        { name: 'Reinweiß', hex: '#FFFFFF' },
        { name: 'Elektrisch Violett', hex: '#7B00FF' },
        { name: 'Eisminze', hex: '#C2FFF0' },
      ],
      recommendedNecklines,
    };
  }

  if (undertone === 'cool') {
    if (contrastLevel === 'high' || chromaLevel === 'bright' || valueLevel === 'dark') {
      return {
        seasonName: 'Klare, kühle Kontrastfarben – Clear / Dark Winter (Winter-Typ)',
        seasonSubtitle: 'Einfach erklärt: Dir stehen Schwarz, Weiß, Dunkelblau und kräftige kühle Farben',
        description:
          'Das bedeutet für dich: Du gehörst zu den Typen, denen tiefes Schwarz, kühles Weiß, Marineblau, Dunkelgrau, Tannengrün und Weinrot ausgezeichnet stehen. Gelbliche oder rostbraune Töne solltest du eher meiden.',
        powerColors: [
          { name: 'Königsblau Gedeckt', hex: '#1F4591', categoryHint: 'Strick & Hemden' },
          { name: 'Kühles Burgunder', hex: '#54162B', categoryHint: 'Turtlenecks' },
          { name: 'Smaragd-Tanne', hex: '#144D3E', categoryHint: 'Overshirts' },
          { name: 'Stahlblau', hex: '#345678', categoryHint: 'Button-Downs' },
          { name: 'Pflaume Kühl', hex: '#3E1F47', categoryHint: 'Feinstrick' },
          { name: 'Eisblau Klar', hex: '#D4E6F1', categoryHint: 'Kontrast-Hemden' },
          { name: 'Karmesinrot', hex: '#8A1527', categoryHint: 'Akzent-Piece' },
          { name: 'Tiefes Petrol', hex: '#154354', categoryHint: 'Polos' },
          { name: 'Tannengrün Kühl', hex: '#1B3B36', categoryHint: 'Jacken' },
          { name: 'Violett-Indigo', hex: '#2D2A5A', categoryHint: 'Pullover' },
          { name: 'Kirschrot Dunkel', hex: '#631222', categoryHint: 'Strick' },
          { name: 'Arktis-Blau', hex: '#4B779D', categoryHint: 'Tees' },
        ],
        coreNeutrals: [
          { name: 'Tiefschwarz', hex: '#141414', categoryHint: 'Basics & Mäntel' },
          { name: 'Anthrazit', hex: '#2B2D42', categoryHint: 'Trousers & Knit' },
          { name: 'Tiefes Navy', hex: '#1B263B', categoryHint: 'Anzug & Jacken' },
          { name: 'Kühles Weiß', hex: '#F8F9FA', categoryHint: 'Tees & Hemden' },
          { name: 'Schiefergrau', hex: '#525866', categoryHint: 'Hosen' },
          { name: 'Silbergrau', hex: '#C5CBD3', categoryHint: 'Layering' },
        ],
        avoidColors: [
          { name: 'Senfgelb', hex: '#D49B27' },
          { name: 'Orange-Rost', hex: '#C85A28' },
          { name: 'Warmes Kamel-Gelb', hex: '#D6A461' },
          { name: 'Pfirsich', hex: '#F5B895' },
          { name: 'Gelbgrün', hex: '#9BC53D' },
          { name: 'Goldbraun', hex: '#996515' },
        ],
        recommendedNecklines,
      };
    }

    return {
      seasonName: 'Sanfte, kühle Farben – Soft / True Summer (Sommer-Typ)',
      seasonSubtitle: 'Einfach erklärt: Dir stehen ruhige Blau-, Grau-, Beeren- und Grüntöne',
      description:
        'Das bedeutet für dich: Sanfte, kühle Farben wie Blaugrau, Marineblau, Hellblau, kühles Salbeigrün, Grau und Weinrot passen perfekt zu deinem Hautton. Grelles Orange oder Senfgelb wirken dagegen unruhig.',
      powerColors: [
        { name: 'Taubenblau', hex: '#5B758E', categoryHint: 'Hemden & Strick' },
        { name: 'Kühles Salbei', hex: '#7C9082', categoryHint: 'T-Shirts' },
        { name: 'Beeren-Burgunder', hex: '#632639', categoryHint: 'Sweater' },
        { name: 'Blaugrau', hex: '#4A5D73', categoryHint: 'Overshirts' },
        { name: 'Meeresgrün Gedeckt', hex: '#3D6B66', categoryHint: 'Polos' },
        { name: 'Lavendel-Grau', hex: '#766E85', categoryHint: 'Feinstrick' },
        { name: 'Stahl-Indigo', hex: '#324869', categoryHint: 'Jacken' },
        { name: 'Rauch-Rosenholz', hex: '#8A5A65', categoryHint: 'Casual Tops' },
        { name: 'Fichtengrün Kühl', hex: '#2F5249', categoryHint: 'Mid-Layer' },
        { name: 'Himmelblau Gedeckt', hex: '#8FAEC7', categoryHint: 'Oxford-Hemden' },
        { name: 'Pflaume Sanft', hex: '#52384F', categoryHint: 'Cardigans' },
        { name: 'Nebel-Türkis', hex: '#4F7A82', categoryHint: 'Tees' },
      ],
      coreNeutrals: [
        { name: 'Anthrazit', hex: '#2B2D42', categoryHint: 'Hosen & Mäntel' },
        { name: 'Marineblau', hex: '#1B263B', categoryHint: 'Basics' },
        { name: 'Gebrochenes Kühlweiß', hex: '#F0F2F5', categoryHint: 'T-Shirts' },
        { name: 'Steingrau', hex: '#7D8491', categoryHint: 'Trousers' },
        { name: 'Kühles Taupe', hex: '#756D6A', categoryHint: 'Strick & Schuhe' },
        { name: 'Graphit', hex: '#1F2229', categoryHint: 'Abend-Outfits' },
      ],
      avoidColors: [
        { name: 'Knallorange', hex: '#FF6600' },
        { name: 'Grelles Gelb', hex: '#FFE600' },
        { name: 'Rostrot Warm', hex: '#B8441E' },
        { name: 'Neon-Limette', hex: '#76FF03' },
        { name: 'Gold-Ocker', hex: '#CC8E1E' },
        { name: 'Tomatenrot', hex: '#E62E00' },
      ],
      recommendedNecklines,
    };
  }

  return {
    seasonName: 'Vielseitige Alltagsfarben – Soft Neutral Studio (Neutral-Typ)',
    seasonSubtitle: 'Einfach erklärt: Dir stehen sowohl kühle Klassiker (Blau/Grau) als auch warme Naturtöne',
    description:
      'Das bedeutet für dich: Weil dein Hautton ausgeglichen ist, kannst du sowohl Dunkelblau, Grau und Schwarz als auch Salbeigrün, Beige und Braun problemlos tragen – solange die Farben nicht neon-grell sind.',
    powerColors: [
      { name: 'Salbeigrün', hex: '#8F9779', categoryHint: 'T-Shirts & Strick' },
      { name: 'Burgunder', hex: '#5E2129', categoryHint: 'Sweater & Polos' },
      { name: 'Petrol-Blau', hex: '#2D5A6B', categoryHint: 'Hemden & Jacken' },
      { name: 'Dunkel-Oliv', hex: '#4B5320', categoryHint: 'Overshirts' },
      { name: 'Stahlblau', hex: '#43617D', categoryHint: 'Button-Downs' },
      { name: 'Tannengrün', hex: '#234738', categoryHint: 'Blousons' },
      { name: 'Terrakotta Sanft', hex: '#9E5847', categoryHint: 'Feinstrick' },
      { name: 'Pflaume', hex: '#4F2D45', categoryHint: 'Turtlenecks' },
      { name: 'Eukalyptus', hex: '#6A8479', categoryHint: 'Polos' },
      { name: 'Indigo', hex: '#283B66', categoryHint: 'Denim & Hemden' },
      { name: 'Moosgrün', hex: '#5C6942', categoryHint: 'Tees' },
      { name: 'Kupfer-Braun', hex: '#824B36', categoryHint: 'Cardigans' },
    ],
    coreNeutrals: [
      { name: 'Off-White', hex: '#F4F1EA', categoryHint: 'T-Shirts' },
      { name: 'Anthrazit', hex: '#2B2D42', categoryHint: 'Hosen & Mäntel' },
      { name: 'Navy', hex: '#1B263B', categoryHint: 'Key Pieces' },
      { name: 'Sand / Beige', hex: '#D5C7B8', categoryHint: 'Chinos' },
      { name: 'Espresso', hex: '#3B2F2F', categoryHint: 'Schuhe & Leder' },
      { name: 'Schwarz Gedeckt', hex: '#141414', categoryHint: 'Basics' },
    ],
    avoidColors: [
      { name: 'Neon-Pink', hex: '#FF1493' },
      { name: 'Neon-Gelb', hex: '#FFFF00' },
      { name: 'Grelles Cyan', hex: '#00FFFF' },
      { name: 'Eisrosa', hex: '#FFD1EB' },
      { name: 'Giftgrün', hex: '#39FF14' },
      { name: 'Grelles Orange', hex: '#FF5500' },
    ],
    recommendedNecklines,
  };
}

function getRecommendedNecklines(haircutStyle: BiometricProfile['haircutStyle']): SeasonPalette['recommendedNecklines'] {
  switch (haircutStyle) {
    case 'short_fade_structured_top':
      return [
        {
          neckline: 'stand_collar',
          label: 'Stehkragen / Overshirt-Kragen',
          reason: 'Strukturierter Kragen rahmt deinen kurzen Seiten-Fade optimal und setzt die klare Kieferlinie fort.',
        },
        {
          neckline: 'shirt_collar',
          label: 'Klassischer Hemdkragen (Button-Down)',
          reason: 'Vertikale Kragenkante balanciert das Volumen am Oberkopf.',
        },
        {
          neckline: 'heavy_crewneck',
          label: 'Heavyweight Crewneck (Enges Bündchen)',
          reason: 'Schweres Rippenbündchen gibt dem Hals klare Geometrie statt auszuleiern.',
        },
      ];
    case 'buzz_very_short':
      return [
        {
          neckline: 'turtleneck',
          label: 'Rollkragen / Mock-Neck',
          reason: 'Schafft architektonische Präsenz im Halsbereich als Ausgleich zum minimalistischen Buzz-Cut.',
        },
        {
          neckline: 'heavy_crewneck',
          label: 'Heavyweight Crewneck',
          reason: 'Kräftiger Kragenabschluss betont Schulter- und Nackenpartie.',
        },
        {
          neckline: 'hooded',
          label: 'Strukturierte Kapuze / Stehkragen',
          reason: 'Rahmt Kopf- und Nackenpartie mit zusätzlichem Volumen.',
        },
      ];
    case 'medium_textured_flow':
    case 'long_hair':
      return [
        {
          neckline: 'crewneck',
          label: 'Klassischer Crewneck',
          reason: 'Hält die Halspartie frei, damit längere Haare nicht am Kragen aufstauen.',
        },
        {
          neckline: 'v_neck',
          label: 'Dezenter V-Neck / Offener Kragen',
          reason: 'Öffnet die vertikale Linie unter dem Kinn und streckt den Oberkörper.',
        },
        {
          neckline: 'shirt_collar',
          label: 'Offener Hemdkragen (1–2 Knöpfe offen)',
          reason: 'Lässige Rahmung ohne Reibung mit den Haarspitzen im Nacken.',
        },
      ];
  }
}

const RUGGED_TEXTURES: TextureType[] = [
  'chunky_knit',
  'flannel_wool',
  'twill_chino',
  'heavy_jersey',
  'denim',
  'leather_suede',
];

/**
 * Deterministically evaluates how well a single garment matches the user's BiometricProfile.
 * Implements Rules 1 to 5 from the specification.
 */
export function scoreGarmentBiometrics(
  garment: Pick<Garment, 'category' | 'colorName' | 'colorHex' | 'hsl' | 'colorTemp' | 'neckline' | 'texture'>,
  profile: BiometricProfile
): BiometricScoreResult {
  const isUpperBody =
    garment.category === 'base_top' ||
    garment.category === 'mid_layer' ||
    garment.category === 'outerwear';

  // Rule 1: Face Proximity Weighting (1.0x for upper body, 0.2x for bottom/footwear)
  const weightMultiplier = isUpperBody ? 1.0 : 0.2;

  const reasons: string[] = [];
  let undertoneDelta = 0;
  let chromaDelta = 0;
  let eyeBonus = 0;
  let haircutNecklineDelta = 0;
  let textureFacialHairBonus = 0;

  // Rule 2: Undertone Harmony
  const approvedNeutral = isApprovedNeutralForUndertone(garment.hsl, garment.colorTemp, profile.undertone);
  const isWarmProfile = profile.undertone === 'warm' || profile.undertone === 'olive';
  const isCoolProfile = profile.undertone === 'cool';

  if (approvedNeutral) {
    undertoneDelta = 25;
    if (isUpperBody) {
      reasons.push(
        `Souveräner Ruhepol (${garment.colorName}): Bewährte Neutral-/Erdfarbe für deinen ${UNDERTONE_LABELS[profile.undertone]} Hautunterton`
      );
    } else {
      reasons.push(`Vielseitige Basis-Farbe (${garment.colorName}) fernab der Gesichtspartie`);
    }
  } else if (
    (isWarmProfile && garment.colorTemp === 'warm') ||
    (isCoolProfile && garment.colorTemp === 'cool') ||
    profile.undertone === 'neutral'
  ) {
    undertoneDelta = 25;
    if (isUpperBody) {
      reasons.push(
        `Farbtemperatur (${garment.colorTemp === 'warm' ? 'Warm' : 'Kühl'}) harmoniert ideal mit deinem ${UNDERTONE_LABELS[profile.undertone]} Hautunterton`
      );
    }
  } else {
    undertoneDelta = -30;
    if (isUpperBody) {
      reasons.push('Farbtemperatur beißt sich mit deinem Hautunterton');
    } else {
      reasons.push('Farbtemperatur weicht vom Hautunterton ab (geringer Einfluss da Unterkörper/Schuhwerk)');
    }
  }

  // Rule 3: Chroma/Saturation Match
  const s = garment.hsl.s;
  const isLowSatNeutral = s < 15;

  if (profile.chromaLevel === 'muted') {
    if ((s >= 15 && s <= 55) || isLowSatNeutral) {
      chromaDelta = 20;
      if (isUpperBody && s >= 15) {
        reasons.push(`Gedämpfte Sättigung (${s}%) unterstreicht dein Muted-Chroma-Profil ohne zu überstrahlen`);
      }
    } else if (s > 75) {
      chromaDelta = -20;
      reasons.push(`Zu hohe Farbsättigung (${s}%) wirkt unruhig bei deinem gedämpften Chroma-Typ`);
    } else {
      chromaDelta = 5;
    }
  } else if (profile.chromaLevel === 'moderate') {
    if (s <= 72) {
      chromaDelta = 18;
      if (isUpperBody && s >= 18) {
        reasons.push(`Ausgewogene Farbsättigung (${s}%) passt zu deinem mittleren Chroma-Level`);
      }
    } else if (s > 82) {
      chromaDelta = -15;
      reasons.push(`Übersättigte Farbe (${s}%) dominiert dein mittleres Chroma-Profil`);
    } else {
      chromaDelta = 5;
    }
  } else {
    if (s >= 50 || garment.hsl.l < 15 || garment.hsl.l > 90) {
      chromaDelta = 20;
      if (isUpperBody) {
        reasons.push(`Klare Farbintensität (${s}%) unterstützt dein Bright-Chroma-Profil`);
      }
    } else if (s >= 18 && s <= 35) {
      chromaDelta = -15;
      reasons.push(`Stumpfe Sättigung (${s}%) nimmt deinem klaren Chroma-Typ die Strahlkraft`);
    } else {
      chromaDelta = 8;
    }
  }

  // Rule 4: Eye Color Amplifier
  const eyeHsl = hexToHsl(profile.eyeHex);
  if (garment.hsl.s >= 12 && eyeHsl.s >= 10) {
    const hueDist = getHueDistance(garment.hsl.h, eyeHsl.h);
    if (hueDist <= 22) {
      eyeBonus = 20;
      if (isUpperBody) {
        reasons.push(`Verstärkt direkt deine Augenfarbe (${profile.eyeColorName})`);
      }
    } else if (hueDist >= 160 && hueDist <= 200) {
      eyeBonus = 15;
      if (isUpperBody) {
        reasons.push(`Komplementärkontrast bringt deine Augenfarbe (${profile.eyeColorName}) zum Leuchten`);
      }
    }
  }

  // Rule 5: Haircut & Facial Hair × Neckline Matrix
  if (isUpperBody && garment.neckline !== 'none') {
    if (profile.haircutStyle === 'short_fade_structured_top') {
      if (
        garment.neckline === 'stand_collar' ||
        garment.neckline === 'shirt_collar' ||
        garment.neckline === 'heavy_crewneck' ||
        garment.neckline === 'turtleneck'
      ) {
        haircutNecklineDelta = 15;
        reasons.push('Strukturierter Kragen rahmt deinen kurzen Seiten-Fade optimal');
      } else if (garment.neckline === 'v_neck') {
        haircutNecklineDelta = -10;
        reasons.push('Offener V-Ausschnitt nimmt dem kurzen Fade die geometrische Struktur');
      } else {
        haircutNecklineDelta = 6;
      }
    } else if (profile.haircutStyle === 'buzz_very_short') {
      if (
        garment.neckline === 'heavy_crewneck' ||
        garment.neckline === 'turtleneck' ||
        garment.neckline === 'stand_collar' ||
        garment.neckline === 'hooded'
      ) {
        haircutNecklineDelta = 15;
        reasons.push('Prägnanter Kragenabschluss gibt dem kurzen Buzz-Cut architektonischen Halt');
      } else {
        haircutNecklineDelta = 5;
      }
    } else if (
      profile.haircutStyle === 'medium_textured_flow' ||
      profile.haircutStyle === 'long_hair'
    ) {
      if (
        garment.neckline === 'crewneck' ||
        garment.neckline === 'v_neck' ||
        garment.neckline === 'shirt_collar'
      ) {
        haircutNecklineDelta = 15;
        reasons.push('Kragenform lässt Raum für deine längere Haarstruktur ohne am Nacken zu stauchen');
      } else if (garment.neckline === 'turtleneck') {
        haircutNecklineDelta = -8;
        reasons.push('Hoher Kragen konkurriert mit längerer Haarpartie im Nacken');
      }
    }
  }

  // Facial Hair × Texture synergy
  if (
    (profile.facialHair === 'stubble' ||
      profile.facialHair === 'short_beard' ||
      profile.facialHair === 'full_beard') &&
    RUGGED_TEXTURES.includes(garment.texture)
  ) {
    textureFacialHairBonus = 10;
    if (isUpperBody) {
      reasons.push('Markante Stoffstruktur korrespondiert mit deiner Barttextur');
    }
  }

  let rawScore: number;
  const baseScore = isUpperBody ? 40 : 78;

  if (isUpperBody) {
    rawScore =
      baseScore +
      undertoneDelta +
      chromaDelta +
      eyeBonus +
      haircutNecklineDelta +
      textureFacialHairBonus;
  } else {
    rawScore =
      baseScore +
      Math.round((undertoneDelta + chromaDelta + eyeBonus) * weightMultiplier) +
      Math.round(textureFacialHairBonus * 0.5);
  }

  const finalScore = Math.max(12, Math.min(99, Math.round(rawScore)));

  if (reasons.length === 0) {
    reasons.push('Solide Basiskompatibilität mit deinem Biometrie-Profil');
  }

  return {
    score: finalScore,
    weightMultiplier,
    reasons,
    breakdown: {
      baseScore,
      undertoneDelta: Math.round(undertoneDelta * weightMultiplier),
      chromaDelta: Math.round(chromaDelta * weightMultiplier),
      eyeBonus: Math.round(eyeBonus * weightMultiplier),
      haircutNecklineDelta,
      textureFacialHairBonus,
    },
  };
}
