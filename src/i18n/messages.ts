import { AppLocale, GarmentCategory, GarmentSubcategory, OccasionType, WeatherCondition } from '../types/wardrobe';

export const DE_MESSAGES = {
  'app.title': 'OUTFIT-PLANER',
  'nav.ariaMain': 'Hauptnavigation',
  'nav.ariaMobile': 'Mobile Navigation',
  'nav.stylist': 'Outfits für heute',
  'nav.travel': 'Reise & Koffer',
  'nav.closet': 'Kleiderschrank ({count})',
  'nav.stats': 'Statistik & Favoriten',
  'nav.statsWithCount': 'Statistik & Favoriten ({count})',
  'nav.gaps': 'Was fehlt? ({count})',
  'nav.profile': 'Mein Typ & Farben',
  'nav.mobile.stylist': 'Outfits',
  'nav.mobile.travel': 'Reise',
  'nav.mobile.closet': 'Schrank',
  'nav.mobile.stats': 'Statistik',
  'nav.mobile.gaps': 'Was fehlt?',
  'nav.mobile.profile': 'Mein Typ',
  'header.settings': 'Einstellungen',
  'header.settingsTitle': 'Einstellungen, Kleidungs-Auswahl & Farben',
  'header.switchLang': 'Auf Englisch umschalten (EN)',
  'header.addGarmentShort': 'Kleidungsstück',
  'header.addGarmentAria': 'Neues Kleidungsstück anlegen',
  'demo.title': 'Demo-Modus · Beispiel-Garderobe',
  'demo.subtitle':
    'Bereit für deinen eigenen Kleiderschrank? Beende die Demo und lege deine eigene Kleidung an.',
  'demo.emptyAndAdd': 'Schrank direkt leeren & 1. Teil anlegen',
  'demo.exitAndSetup': 'Demo beenden & Eigenen Schrank starten',
  'footer.tagline': 'Outfit-Planer & Kleiderschrank · Kostenlos & offline nutzbar',
  'footer.affiliateNotice': '· Als Amazon-Partner verdiene ich an qualifizierten Verkäufen.',
  'footer.backupBtn': 'Backup & Daten',
  'common.close': 'Schließen',
  'common.save': 'Speichern',
  'common.cancel': 'Abbrechen',
  'common.delete': 'Löschen',
  'common.edit': 'Bearbeiten',
  'common.reset': 'Zurücksetzen',
  'gaps.updating': 'Aktualisiere Kombinations-Analyse…',
} as const;

export type MessageKey = keyof typeof DE_MESSAGES;

export const EN_MESSAGES: Record<MessageKey, string> = {
  'app.title': 'OUTFIT PLANNER',
  'nav.ariaMain': 'Main navigation',
  'nav.ariaMobile': 'Mobile navigation',
  'nav.stylist': "Today's Outfits",
  'nav.travel': 'Travel & Packing',
  'nav.closet': 'My Closet ({count})',
  'nav.stats': 'Stats & Favorites',
  'nav.statsWithCount': 'Stats & Favorites ({count})',
  'nav.gaps': "What's Missing? ({count})",
  'nav.profile': 'My Colors & Style',
  'nav.mobile.stylist': 'Outfits',
  'nav.mobile.travel': 'Travel',
  'nav.mobile.closet': 'Closet',
  'nav.mobile.stats': 'Stats',
  'nav.mobile.gaps': 'Missing',
  'nav.mobile.profile': 'My Colors',
  'header.settings': 'Settings',
  'header.settingsTitle': 'Settings, Clothing Choice & Colors',
  'header.switchLang': 'Switch to German (DE)',
  'header.addGarmentShort': 'Add Garment',
  'header.addGarmentAria': 'Add Garment',
  'demo.title': 'Demo Mode · Example Wardrobe',
  'demo.subtitle':
    'Ready for your own wardrobe? Exit demo mode to start with your own clothes.',
  'demo.emptyAndAdd': 'Empty Closet & Add 1st Item',
  'demo.exitAndSetup': 'Exit Demo & Start Setup',
  'footer.tagline': 'Outfit Planner & Wardrobe · Free & works offline',
  'footer.affiliateNotice': '· As an Amazon Associate, we earn from qualifying purchases.',
  'footer.backupBtn': 'Backup & Export',
  'common.close': 'Close',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.reset': 'Reset',
  'gaps.updating': 'Updating outfit matrix…',
};

export const MESSAGES: Record<AppLocale, Record<MessageKey, string>> = {
  de: DE_MESSAGES,
  en: EN_MESSAGES,
};

/**
 * Formats a localized UI message with optional `{param}` placeholders.
 */
export function tMessage(
  locale: AppLocale,
  key: MessageKey,
  params?: Record<string, string | number>
): string {
  const dict = MESSAGES[locale] || MESSAGES.de;
  const template = dict[key] ?? MESSAGES.de[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, token: string) =>
    params[token] !== undefined ? String(params[token]) : `{${token}}`
  );
}

/**
 * Creates a bound translator function for a given locale.
 */
export function createTranslator(locale: AppLocale) {
  return (key: MessageKey, params?: Record<string, string | number>): string =>
    tMessage(locale, key, params);
}

const CATEGORY_LABELS: Record<AppLocale, Record<GarmentCategory, string>> = {
  de: {
    base_top: 'T-Shirts, Hemden & Tops',
    mid_layer: 'Pullover & Strick',
    outerwear: 'Jacken & Mäntel',
    bottom: 'Hosen & Röcke',
    footwear: 'Schuhe',
    accessory: 'Accessoires',
  },
  en: {
    base_top: 'T-Shirts, Shirts & Tops',
    mid_layer: 'Sweaters & Knitwear',
    outerwear: 'Jackets & Coats',
    bottom: 'Pants & Skirts',
    footwear: 'Footwear',
    accessory: 'Accessories',
  },
};

const OCCASION_LABELS: Record<AppLocale, Record<OccasionType, string>> = {
  de: {
    homeoffice_lounge: 'Homeoffice & Gemütlich',
    casual: 'Alltag & Freizeit',
    smart_casual_office: 'Büro & Smart Casual',
    city_cafe: 'Stadt & Café',
    outdoor_walk: 'Spaziergang & Draußen',
    beach_vacation: 'Urlaub & Strand',
    active_sporty: 'Aktiv & Sportlich',
    date_night: 'Abend & Ausgehen',
    formal_event: 'Anzug & Festlich',
  },
  en: {
    homeoffice_lounge: 'Home Office & Lounge',
    casual: 'Everyday & Casual',
    smart_casual_office: 'Office & Smart Casual',
    city_cafe: 'City & Café',
    outdoor_walk: 'Outdoor & Walk',
    beach_vacation: 'Vacation & Beach',
    active_sporty: 'Active & Sporty',
    date_night: 'Date Night & Evening',
    formal_event: 'Formal & Business',
  },
};

const WEATHER_LABELS: Record<AppLocale, Record<WeatherCondition, string>> = {
  de: {
    sunny_dry: 'Sonnig / Trocken',
    cloudy_windy: 'Bewölkt / Windig',
    rain_wet: 'Regen / Nass',
  },
  en: {
    sunny_dry: 'Sunny / Dry',
    cloudy_windy: 'Cloudy / Windy',
    rain_wet: 'Rain / Wet',
  },
};

export function tCategory(locale: AppLocale, category: GarmentCategory): string {
  return CATEGORY_LABELS[locale]?.[category] ?? CATEGORY_LABELS.de[category] ?? category;
}

export function tOccasion(locale: AppLocale, occasion: OccasionType): string {
  return OCCASION_LABELS[locale]?.[occasion] ?? OCCASION_LABELS.de[occasion] ?? occasion;
}

export function tWeather(locale: AppLocale, weather: WeatherCondition): string {
  return WEATHER_LABELS[locale]?.[weather] ?? WEATHER_LABELS.de[weather] ?? weather;
}

export function tSubcategory(
  locale: AppLocale,
  subcategory: GarmentSubcategory | string
): string {
  if (locale === 'de') return subcategory;
  const map: Record<string, string> = {
    t_shirt: 'T-Shirt',
    longsleeve: 'Longsleeve',
    polo: 'Polo Shirt',
    tank_top: 'Tank Top',
    blouse: 'Blouse',
    button_down_shirt: 'Button-Down Shirt',
    short_sleeve_shirt: 'Short-Sleeve Shirt',
    sweater: 'Crewneck Sweater',
    turtleneck: 'Turtleneck',
    cardigan: 'Cardigan',
    hoodie: 'Hoodie',
    sweatshirt: 'Sweatshirt',
    blazer: 'Blazer',
    trenchcoat: 'Trench Coat',
    wool_coat: 'Wool Coat',
    puffer_jacket: 'Winter / Puffer Jacket',
    leather_jacket: 'Leather Jacket',
    denim_jacket: 'Denim Jacket',
    overshirt: 'Overshirt',
    rain_jacket: 'Rain Jacket',
    vest: 'Vest / Gilet',
    denim: 'Jeans',
    chino: 'Chinos',
    trousers: 'Cloth Trousers',
    suit_trousers: 'Suit Trousers',
    cargo: 'Cargo Pants',
    shorts: 'Shorts',
    sweatpants: 'Sweatpants',
    skirt: 'Skirt',
    leggings: 'Leggings',
    sneakers: 'Sneakers',
    loafer: 'Loafers',
    boots: 'Boots',
    derby: 'Dress Shoes / Derbies',
    heels: 'Heels / Pumps',
    sandals: 'Sandals',
    dress: 'Dress',
    jumpsuit: 'Jumpsuit',
    watch: 'Watch',
    belt: 'Belt',
    sunglasses: 'Sunglasses',
    scarf: 'Scarf',
    cap: 'Cap',
    beanie: 'Beanie',
    bag: 'Bag',
    jewelry: 'Jewelry',
    socks: 'Socks',
  };
  return map[subcategory] || subcategory;
}
