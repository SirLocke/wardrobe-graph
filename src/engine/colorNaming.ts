import { hexToHsl } from './colorMath';

export interface GermanColorEntry {
  name: string;
  nameEn: string;
  hex: string;
  group: 'Neutrals' | 'Earth & Olive' | 'Blue & Cool' | 'Accent';
  keywords?: string[];
}

interface LabColor {
  L: number;
  a: number;
  b: number;
}

function hexToLab(hex: string): LabColor {
  const clean = hex.trim().replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (!/^[0-9A-Fa-f]{6}$/.test(full)) {
    return { L: 50, a: 0, b: 0 };
  }

  let r = parseInt(full.slice(0, 2), 16) / 255;
  let g = parseInt(full.slice(2, 4), 16) / 255;
  let b = parseInt(full.slice(4, 6), 16) / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function ciede2000(lab1: LabColor, lab2: LabColor): number {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Comprehensive bilingual (DE & EN) fashion & textile color dictionary (~70 entries)
 * used for deterministic Hex -> German/English color name translation and
 * natural language color recognition from garment titles.
 */
export const GERMAN_COLOR_DICTIONARY: GermanColorEntry[] = [
  // --- Neutrals ---
  { name: 'Tiefschwarz', nameEn: 'Jet Black', hex: '#0E0E10', group: 'Neutrals', keywords: ['tiefschwarz', 'pechschwarz', 'jet black', 'pitch black'] },
  { name: 'Schwarz', nameEn: 'Black', hex: '#141414', group: 'Neutrals', keywords: ['schwarz', 'schwarze', 'schwarzer', 'schwarzes', 'schwarzen', 'black'] },
  { name: 'Onyx / Mattschwarz', nameEn: 'Matte Black', hex: '#222326', group: 'Neutrals', keywords: ['mattschwarz', 'onyx', 'washed black', 'matte black', 'faded black'] },
  { name: 'Anthrazit', nameEn: 'Charcoal', hex: '#36393C', group: 'Neutrals', keywords: ['anthrazit', 'charcoal', 'dunkelgrau', 'dunkelgraue', 'dunkelgrauer', 'dunkelgraues', 'graphit', 'dark grey', 'dark gray', 'anthracite'] },
  { name: 'Schiefergrau', nameEn: 'Slate Grey', hex: '#4F555B', group: 'Neutrals', keywords: ['schiefergrau', 'schiefer', 'slate', 'slate grey', 'slate gray'] },
  { name: 'Steingrau', nameEn: 'Stone Grey', hex: '#7C7F7E', group: 'Neutrals', keywords: ['steingrau', 'mittelgrau', 'grau', 'graue', 'grauer', 'graues', 'grauen', 'grey', 'gray', 'stone grey', 'medium grey'] },
  { name: 'Aschgrau', nameEn: 'Ash Grey', hex: '#9A9E9E', group: 'Neutrals', keywords: ['aschgrau', 'zementgrau', 'ash grey', 'ash gray'] },
  { name: 'Grau-Melange', nameEn: 'Heather Grey', hex: '#A8AAAC', group: 'Neutrals', keywords: ['melange', 'graumelange', 'grau-melange', 'heather grey', 'heather gray', 'marl grey'] },
  { name: 'Hellgrau', nameEn: 'Light Grey', hex: '#C6C8CA', group: 'Neutrals', keywords: ['hellgrau', 'hellgraue', 'hellgrauer', 'hellgraues', 'silbergrau', 'light grey', 'light gray'] },
  { name: 'Silber', nameEn: 'Silver', hex: '#C4C7CE', group: 'Neutrals', keywords: ['silber', 'silbern', 'silver', 'metallic'] },
  { name: 'Perlgrau', nameEn: 'Pearl Grey', hex: '#DCDAD6', group: 'Neutrals', keywords: ['perlgrau', 'kieselgrau', 'pearl grey', 'pebble grey'] },
  { name: 'Wollweiß', nameEn: 'Off-White', hex: '#F2EFE9', group: 'Neutrals', keywords: ['wollweiß', 'wollweiss', 'off-white', 'offwhite', 'naturweiß', 'winter white'] },
  { name: 'Reinweiß', nameEn: 'White', hex: '#FAFAFA', group: 'Neutrals', keywords: ['weiß', 'weiss', 'weiße', 'weisse', 'weißer', 'weisser', 'weißes', 'weisses', 'weißen', 'reinweiß', 'white', 'pure white'] },
  { name: 'Elfenbein', nameEn: 'Ivory', hex: '#F5EEDC', group: 'Neutrals', keywords: ['elfenbein', 'ivory'] },
  { name: 'Creme / Ecru', nameEn: 'Cream / Ecru', hex: '#EAE3D2', group: 'Neutrals', keywords: ['creme', 'ecru', 'cream', 'cremefarben', 'cremeweiß'] },
  { name: 'Hafer / Oatmeal', nameEn: 'Oatmeal', hex: '#DFD5C2', group: 'Neutrals', keywords: ['hafer', 'oatmeal', 'oat'] },
  { name: 'Sandbeige', nameEn: 'Sand Beige', hex: '#D8C8B0', group: 'Neutrals', keywords: ['sand', 'sandbeige', 'beige', 'hellbeige', 'beigefarben', 'sand beige'] },
  { name: 'Greige', nameEn: 'Greige', hex: '#BFB6A8', group: 'Neutrals', keywords: ['greige', 'kitt', 'putty'] },
  { name: 'Warmes Taupe', nameEn: 'Warm Taupe', hex: '#A69580', group: 'Neutrals', keywords: ['taupe', 'schlamm', 'warm taupe'] },
  { name: 'Dunkeltaupe', nameEn: 'Dark Taupe', hex: '#7A6C5D', group: 'Neutrals', keywords: ['dunkeltaupe', 'mokka-grau', 'dark taupe'] },

  // --- Earth & Olive ---
  { name: 'Khaki', nameEn: 'Khaki', hex: '#B5A47E', group: 'Earth & Olive', keywords: ['khaki', 'chinosand', 'tan'] },
  { name: 'Camel', nameEn: 'Camel', hex: '#C19A6B', group: 'Earth & Olive', keywords: ['camel', 'kamel', 'kamelhaar', 'hellbraun', 'hellbraune', 'hellbrauner', 'hellbraunes', 'light brown'] },
  { name: 'Karamell', nameEn: 'Caramel', hex: '#AF7845', group: 'Earth & Olive', keywords: ['karamell', 'caramel', 'toffee', 'honigbraun'] },
  { name: 'Cognac', nameEn: 'Cognac', hex: '#9A5B32', group: 'Earth & Olive', keywords: ['cognac', 'sattelbraun', 'rostbraun', 'saddle brown'] },
  { name: 'Zimtbraun', nameEn: 'Cinnamon', hex: '#8C4E2B', group: 'Earth & Olive', keywords: ['zimt', 'zimtbraun', 'cinnamon'] },
  { name: 'Nussbraun', nameEn: 'Walnut Brown', hex: '#6E4730', group: 'Earth & Olive', keywords: ['nussbraun', 'mittelbraun', 'braun', 'braune', 'brauner', 'braunes', 'braunen', 'brown', 'walnuss', 'walnut'] },
  { name: 'Schokobraun', nameEn: 'Chocolate Brown', hex: '#4B3022', group: 'Earth & Olive', keywords: ['schokobraun', 'schokolade', 'kastanie', 'kastanienbraun', 'chocolate', 'chestnut'] },
  { name: 'Espresso / Dunkelbraun', nameEn: 'Espresso', hex: '#3B2A22', group: 'Earth & Olive', keywords: ['dunkelbraun', 'dunkelbraune', 'dunkelbrauner', 'dunkelbraunes', 'espresso', 'kaffeebraun', 'mokka', 'dark brown'] },
  { name: 'Gold / Messing', nameEn: 'Gold / Brass', hex: '#C5A059', group: 'Earth & Olive', keywords: ['gold', 'golden', 'messing', 'brass'] },
  { name: 'Kupfer / Bronze', nameEn: 'Copper / Bronze', hex: '#A8653B', group: 'Earth & Olive', keywords: ['kupfer', 'bronze', 'copper'] },
  { name: 'Pistazie', nameEn: 'Pistachio Green', hex: '#B8C9A3', group: 'Earth & Olive', keywords: ['pistazie', 'hellgrün', 'hellgrüne', 'hellgrüner', 'hellgrünes', 'lindgrün', 'pistachio', 'light green'] },
  { name: 'Salbeigrün', nameEn: 'Sage Green', hex: '#8F9779', group: 'Earth & Olive', keywords: ['salbei', 'salbeigrün', 'sage', 'sage green', 'schilfgrün'] },
  { name: 'Eukalyptus', nameEn: 'Eucalyptus', hex: '#6F8A7A', group: 'Earth & Olive', keywords: ['eukalyptus', 'seladon', 'eucalyptus'] },
  { name: 'Olivgrün', nameEn: 'Olive Green', hex: '#556B2F', group: 'Earth & Olive', keywords: ['oliv', 'olivgrün', 'olive', 'olive green', 'army', 'armygrün', 'militärgrün', 'dunkel-oliv'] },
  { name: 'Moosgrün', nameEn: 'Moss Green', hex: '#425432', group: 'Earth & Olive', keywords: ['moosgrün', 'moos', 'jagdgrün', 'grün', 'grüne', 'grüner', 'grünes', 'grünen', 'green', 'moss', 'moss green'] },
  { name: 'Tannengrün', nameEn: 'Forest Green', hex: '#1F3A2E', group: 'Earth & Olive', keywords: ['tannengrün', 'waldgrün', 'dunkelgrün', 'dunkelgrüne', 'dunkelgrüner', 'dunkelgrünes', 'flaschengrün', 'british racing green', 'forest', 'forest green', 'pine green', 'waldkiefer', 'dark green'] },
  { name: 'Smaragdgrün', nameEn: 'Emerald Green', hex: '#1B6B4F', group: 'Earth & Olive', keywords: ['smaragd', 'smaragdgrün', 'emerald', 'emerald green', 'kelly green'] },

  // --- Blue & Cool ---
  { name: 'Eisblau', nameEn: 'Ice Blue', hex: '#C7D6E2', group: 'Blue & Cool', keywords: ['eisblau', 'gletscherblau', 'babyblau', 'ice blue', 'baby blue'] },
  { name: 'Himmelblau / Hellblau', nameEn: 'Sky Blue', hex: '#8FAEC7', group: 'Blue & Cool', keywords: ['hellblau', 'hellblaue', 'hellblauer', 'hellblaues', 'hellblauen', 'himmelblau', 'bleach', 'light blue', 'sky blue', 'oxfordblau'] },
  { name: 'Rauchblau / Taubenblau', nameEn: 'Slate Blue', hex: '#68829E', group: 'Blue & Cool', keywords: ['rauchblau', 'taubenblau', 'stahlblau', 'dusty blue', 'slate blue'] },
  { name: 'Denimblau', nameEn: 'Denim Blue', hex: '#4A6B8C', group: 'Blue & Cool', keywords: ['denimblau', 'jeansblau', 'mittelblau', 'blau', 'blaue', 'blauer', 'blaues', 'blauen', 'blue', 'mid wash', 'denim blue'] },
  { name: 'Kobaltblau / Royalblau', nameEn: 'Royal Blue', hex: '#1D4ED8', group: 'Blue & Cool', keywords: ['royalblau', 'königsblau', 'kobaltblau', 'kornblumenblau', 'leuchtend blau', 'royal blue', 'cobalt blue'] },
  { name: 'Indigoblau', nameEn: 'Indigo Blue', hex: '#283B5B', group: 'Blue & Cool', keywords: ['indigo', 'indigoblau', 'raw denim', 'dark denim', 'raw indigo'] },
  { name: 'Marineblau / Navy', nameEn: 'Navy Blue', hex: '#1C2838', group: 'Blue & Cool', keywords: ['marine', 'marineblau', 'navy', 'navy blue', 'dunkelblau', 'dunkelblaue', 'dunkelblauer', 'dunkelblaues', 'dunkelblauen', 'dark blue'] },
  { name: 'Mitternachtsblau', nameEn: 'Midnight Blue', hex: '#121926', group: 'Blue & Cool', keywords: ['mitternachtsblau', 'nachtblau', 'midnight blue'] },
  { name: 'Mintgrün', nameEn: 'Mint Green', hex: '#A3D5C5', group: 'Blue & Cool', keywords: ['mint', 'mintgrün', 'wassergrün', 'mint green'] },
  { name: 'Türkis / Aqua', nameEn: 'Turquoise', hex: '#3898A6', group: 'Blue & Cool', keywords: ['türkis', 'aqua', 'ozeanblau', 'lagune', 'turquoise'] },
  { name: 'Petrol', nameEn: 'Petrol / Teal', hex: '#1F4E5B', group: 'Blue & Cool', keywords: ['petrol', 'petrolblau', 'petrolgrün', 'teal', 'petrol-teal'] },

  // --- Accent ---
  { name: 'Zitronengelb', nameEn: 'Lemon Yellow', hex: '#F2D64B', group: 'Accent', keywords: ['gelb', 'gelbe', 'gelber', 'gelbes', 'zitronengelb', 'sonnengelb', 'yellow', 'lemon yellow'] },
  { name: 'Buttergelb / Pastellgelb', nameEn: 'Butter Yellow', hex: '#F5E6A6', group: 'Accent', keywords: ['buttergelb', 'pastellgelb', 'hellgelb', 'vanille', 'butter yellow', 'pale yellow'] },
  { name: 'Senfgelb / Ocker', nameEn: 'Mustard / Ochre', hex: '#D49B27', group: 'Accent', keywords: ['senf', 'senfgelb', 'ocker', 'ocker-senf', 'mustard', 'ochre', 'curry', 'maisgelb'] },
  { name: 'Bernstein / Amber', nameEn: 'Amber', hex: '#C87A28', group: 'Accent', keywords: ['bernstein', 'amber', 'honig'] },
  { name: 'Mandarine / Orange', nameEn: 'Tangerine / Orange', hex: '#E06A2B', group: 'Accent', keywords: ['orange', 'mandarine', 'tangerine'] },
  { name: 'Terrakotta / Rostrot', nameEn: 'Terracotta / Rust', hex: '#B85A3A', group: 'Accent', keywords: ['terrakotta', 'terracotta', 'rost', 'rostrot', 'rostbraun', 'rostorange', 'ziegelrot', 'rust'] },
  { name: 'Koralle / Lachs', nameEn: 'Coral / Salmon', hex: '#E57A6E', group: 'Accent', keywords: ['koralle', 'lachs', 'apricot', 'pfirsich', 'coral', 'salmon'] },
  { name: 'Kirschrot / Signalrot', nameEn: 'Crimson Red', hex: '#C62828', group: 'Accent', keywords: ['rot', 'rote', 'roter', 'rotes', 'roten', 'kirschrot', 'signalrot', 'feuerrot', 'scharlachrot', 'red', 'crimson'] },
  { name: 'Weinrot / Bordeaux', nameEn: 'Burgundy / Wine', hex: '#63222A', group: 'Accent', keywords: ['bordeaux', 'weinrot', 'burgund', 'burgunder', 'burgundy', 'dunkelrot', 'dunkelrote', 'dunkelroter', 'dunkelrotes', 'merlot', 'oxblood', 'wine red'] },
  { name: 'Beere / Himbeere', nameEn: 'Berry / Magenta', hex: '#9E2A5B', group: 'Accent', keywords: ['beere', 'himbeere', 'brombeere', 'magenta', 'fuchsia', 'berry'] },
  { name: 'Puderrosa / Blush', nameEn: 'Blush Pink', hex: '#E8C5C8', group: 'Accent', keywords: ['puderrosa', 'hellrosa', 'eisrosa', 'rosa', 'rosé', 'rose', 'blush', 'zartrosa', 'pink', 'blush pink'] },
  { name: 'Altrosa / Mauve', nameEn: 'Dusty Rose / Mauve', hex: '#C98A8E', group: 'Accent', keywords: ['altrosa', 'mauve', 'rosenholz', 'dusty pink', 'dusty rose', 'lachsrosa'] },
  { name: 'Flieder / Lavendel', nameEn: 'Lavender / Lilac', hex: '#B7A4D4', group: 'Accent', keywords: ['flieder', 'lavendel', 'helllila', 'lilac', 'lavender'] },
  { name: 'Violett / Lila', nameEn: 'Purple / Violet', hex: '#6B3FA0', group: 'Accent', keywords: ['lila', 'violett', 'purple', 'violet'] },
  { name: 'Aubergine / Pflaume', nameEn: 'Plum / Aubergine', hex: '#47243C', group: 'Accent', keywords: ['aubergine', 'pflaume', 'pflaume gedämpft', 'dunkellila', 'plum'] }
];

/**
 * Classifies any hex color into one of the 4 wardrobe palette groups.
 */
export function classifyHexColorGroup(hex: string): 'Neutrals' | 'Earth & Olive' | 'Blue & Cool' | 'Accent' {
  const { h, s, l } = hexToHsl(hex);
  if (s < 14 || l < 11 || l > 92) return 'Neutrals';
  if (h >= 170 && h <= 255) return 'Blue & Cool';
  if (h >= 22 && h <= 165 && (s < 65 || l < 55)) return 'Earth & Olive';
  return 'Accent';
}

/**
 * Translates any Hex color code (e.g. "#3A5F4B") into the closest German or English textile color name
 * using perceptual color distance in CIELAB space.
 */
export function hexToGermanColorName(
  hex: string,
  locale: 'de' | 'en' = 'de'
): {
  name: string;
  nameDe: string;
  nameEn: string;
  hex: string;
  group: 'Neutrals' | 'Earth & Olive' | 'Blue & Cool' | 'Accent';
} {
  const isEn = locale === 'en';
  const normalized = hex.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
    return {
      name: isEn ? 'Custom Color' : 'Eigene Farbe',
      nameDe: 'Eigene Farbe',
      nameEn: 'Custom Color',
      hex: '#8F9779',
      group: 'Neutrals',
    };
  }

  const targetLab = hexToLab(normalized);
  let bestEntry = GERMAN_COLOR_DICTIONARY[0];
  let minDistance = Infinity;

  for (const entry of GERMAN_COLOR_DICTIONARY) {
    const dist = ciede2000(targetLab, hexToLab(entry.hex));
    if (dist < minDistance) {
      minDistance = dist;
      bestEntry = entry;
    }
  }

  if (minDistance <= 18) {
    const nameDe = bestEntry.name.split(' / ')[0];
    const nameEn = bestEntry.nameEn.split(' / ')[0];
    return {
      name: isEn ? nameEn : nameDe,
      nameDe,
      nameEn,
      hex: bestEntry.hex,
      group: bestEntry.group,
    };
  }

  const { h, s, l } = hexToHsl(normalized);
  const group = classifyHexColorGroup(normalized);
  if (s < 10) {
    if (l < 18)
      return {
        name: isEn ? 'Black' : 'Schwarz',
        nameDe: 'Schwarz',
        nameEn: 'Black',
        hex: normalized.toUpperCase(),
        group: 'Neutrals',
      };
    if (l < 38)
      return {
        name: isEn ? 'Charcoal' : 'Anthrazit',
        nameDe: 'Anthrazit',
        nameEn: 'Charcoal',
        hex: normalized.toUpperCase(),
        group: 'Neutrals',
      };
    if (l < 68)
      return {
        name: isEn ? 'Stone Grey' : 'Steingrau',
        nameDe: 'Steingrau',
        nameEn: 'Stone Grey',
        hex: normalized.toUpperCase(),
        group: 'Neutrals',
      };
    if (l < 88)
      return {
        name: isEn ? 'Light Grey' : 'Hellgrau',
        nameDe: 'Hellgrau',
        nameEn: 'Light Grey',
        hex: normalized.toUpperCase(),
        group: 'Neutrals',
      };
    return {
      name: isEn ? 'White' : 'Weiß',
      nameDe: 'Weiß',
      nameEn: 'White',
      hex: normalized.toUpperCase(),
      group: 'Neutrals',
    };
  }

  const prefixDe = l < 28 ? 'Dunkel' : l > 75 ? 'Hell' : '';
  const prefixEn = l < 28 ? 'Dark ' : l > 75 ? 'Light ' : '';
  let baseHueDe = 'rot';
  let baseHueEn = 'Red';
  if (h >= 18 && h < 42) {
    baseHueDe = 'orange';
    baseHueEn = 'Orange';
  } else if (h >= 42 && h < 68) {
    baseHueDe = 'gelb';
    baseHueEn = 'Yellow';
  } else if (h >= 68 && h < 165) {
    baseHueDe = 'grün';
    baseHueEn = 'Green';
  } else if (h >= 165 && h < 200) {
    baseHueDe = 'türkis';
    baseHueEn = 'Teal';
  } else if (h >= 200 && h < 260) {
    baseHueDe = 'blau';
    baseHueEn = 'Blue';
  } else if (h >= 260 && h < 315) {
    baseHueDe = 'violett';
    baseHueEn = 'Purple';
  } else if (h >= 315 && h < 345) {
    baseHueDe = 'rosa';
    baseHueEn = 'Pink';
  }

  const composedDe = prefixDe
    ? `${prefixDe}${baseHueDe}`
    : baseHueDe.charAt(0).toUpperCase() + baseHueDe.slice(1);
  const composedEn = `${prefixEn}${baseHueEn}`;
  return {
    name: isEn ? composedEn : composedDe,
    nameDe: composedDe,
    nameEn: composedEn,
    hex: normalized.toUpperCase(),
    group,
  };
}

/**
 * Translates an existing German or English color label into the requested UI locale ('de' | 'en').
 */
export function translateColorName(
  colorName: string,
  locale: 'de' | 'en' = 'de',
  fallbackHex?: string
): string {
  const clean = colorName.replace(' (Test)', '').trim();
  if (!clean) {
    return fallbackHex ? hexToGermanColorName(fallbackHex, locale).name : '';
  }
  const lower = clean.toLowerCase();

  for (const entry of GERMAN_COLOR_DICTIONARY) {
    const deParts = entry.name.toLowerCase().split(/\s*\/\s*/);
    const enParts = entry.nameEn.toLowerCase().split(/\s*\/\s*/);
    const kwMatch = entry.keywords?.some((kw) => kw === lower);
    if (deParts.includes(lower) || enParts.includes(lower) || kwMatch) {
      return locale === 'en' ? entry.nameEn.split(' / ')[0] : entry.name.split(' / ')[0];
    }
  }

  if (fallbackHex && /^#[0-9A-Fa-f]{6}$/.test(fallbackHex.trim())) {
    const byHex = hexToGermanColorName(fallbackHex, locale);
    // Only replace with dictionary translation if clean matches one of the dictionary names
    if (
      byHex.nameDe.toLowerCase() === lower ||
      byHex.nameEn.toLowerCase() === lower
    ) {
      return byHex.name;
    }
  }

  return clean;
}

/**
 * Resolves a German or English color name string to its best matching Hex code.
 */
export function resolveGermanColorNameToHex(colorName: string): string | null {
  const clean = colorName.trim().toLowerCase();
  if (!clean) return null;
  if (/^#[0-9a-f]{6}$/i.test(clean)) return clean.toUpperCase();

  // 1. Exact name or slash-part match (DE or EN)
  for (const entry of GERMAN_COLOR_DICTIONARY) {
    const partsDe = entry.name.toLowerCase().split(/\s*\/\s*/);
    const partsEn = entry.nameEn.toLowerCase().split(/\s*\/\s*/);
    if (partsDe.includes(clean) || partsEn.includes(clean)) return entry.hex;
  }

  // 2. Exact keyword match
  for (const entry of GERMAN_COLOR_DICTIONARY) {
    if (entry.keywords?.some((kw) => kw === clean)) {
      return entry.hex;
    }
  }

  // 3. Substring match (prefer longer keywords first so "dunkelblau" beats "blau")
  const allKeywordPairs: Array<{ kw: string; hex: string }> = [];
  for (const entry of GERMAN_COLOR_DICTIONARY) {
    for (const kw of entry.keywords || []) {
      allKeywordPairs.push({ kw, hex: entry.hex });
    }
  }
  allKeywordPairs.sort((a, b) => b.kw.length - a.kw.length);

  for (const pair of allKeywordPairs) {
    if (clean.includes(pair.kw)) {
      return pair.hex;
    }
  }

  return null;
}

/**
 * Inspects a garment name (e.g., "Schwarze Winterjacke", "Navy Suit Trousers", "Beige Chino")
 * and extracts an explicit color if present, returning its name in the requested locale ('de' | 'en').
 */
export function inferColorFromGarmentName(
  garmentName: string,
  locale: 'de' | 'en' = 'de'
): { name: string; hex: string } | null {
  const lower = garmentName.trim().toLowerCase();
  if (!lower) return null;

  // Tokenize by spaces, hyphens, slashes, parentheses
  const tokens = lower.split(/[\s\-/(),.]+/).filter(Boolean);
  if (tokens.length === 0) return null;

  // Check multi-word or compound matches sorted by keyword length descending
  const candidates: Array<{ kw: string; entry: GermanColorEntry }> = [];
  for (const entry of GERMAN_COLOR_DICTIONARY) {
    for (const kw of entry.keywords || []) {
      candidates.push({ kw, entry });
    }
  }
  candidates.sort((a, b) => b.kw.length - a.kw.length);

  const pickName = (entry: GermanColorEntry) =>
    locale === 'en' ? entry.nameEn.split(' / ')[0] : entry.name.split(' / ')[0];

  // First check multi-word keyword matches (e.g. "forest green", "navy blue", "jet black")
  for (const { kw, entry } of candidates) {
    if (kw.includes(' ') && lower.includes(kw)) {
      return { name: pickName(entry), hex: entry.hex };
    }
  }

  // Next check exact single-token matches
  for (const token of tokens) {
    for (const { kw, entry } of candidates) {
      if (token === kw) {
        return { name: pickName(entry), hex: entry.hex };
      }
    }
  }

  // Then check prefix/compound token matches (e.g. "schwarz-weiß" or "marineblaues")
  for (const token of tokens) {
    for (const { kw, entry } of candidates) {
      if (
        kw.length >= 4 &&
        (token.startsWith(kw) ||
          token === `${kw}e` ||
          token === `${kw}er` ||
          token === `${kw}es` ||
          token === `${kw}en`)
      ) {
        return { name: pickName(entry), hex: entry.hex };
      }
    }
  }

  return null;
}

