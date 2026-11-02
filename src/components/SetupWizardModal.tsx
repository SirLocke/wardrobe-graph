import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Camera,
  Check,
  CheckCheck,
  Copy,
  FileText,
  HelpCircle,
  Plus,
  Ruler,
  Shirt,
  Sparkles,
  Trash2,
  UserCheck,
  Wand2,
  X,
} from 'lucide-react';
import {
  deriveScopeFromTargets,
  getAllColorPresets,
  getQuickItemsForScopes,
  normalizeWardrobeScopes,
  SMART_SUBCATEGORY_DEFAULTS,
  STYLE_VIBE_META,
  SUBCATEGORY_LABELS,
  TextileColorPreset,
  WARDROBE_MULTI_SCOPE_META,
  WARDROBE_PRESETS,
  WARDROBE_SCOPE_META,
  WardrobePresetKey,
} from '../data/seedData';
import { suggestSizeForGarment } from '../engine/brandSizeMatcher';
import { classifyColorTemp, deriveSeasonPalette, hexToHsl } from '../engine/colorMath';
import { parseAndNormalizeWardrobeImport } from '../engine/wardrobeFormatter';
import {
  AppLocale,
  BiometricProfile,
  ChromaLevel,
  ContrastLevel,
  Garment,
  GarmentSubcategory,
  HaircutStyle,
  StyleVibe,
  Undertone,
  WardrobeScope,
  WardrobeScopeTarget,
} from '../types/wardrobe';
import { GarmentVector } from './GarmentVector';

export type WizardStartMode = 'own_empty' | 'keep_current' | WardrobePresetKey;

interface SetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: AppLocale;
  currentProfile: BiometricProfile;
  currentStyleVibe: StyleVibe;
  startInOwnClosetMode?: boolean;
  onCompleteSetup: (payload: {
    profile: BiometricProfile;
    styleVibe: StyleVibe;
    garmentsToLoad: Garment[] | null;
    additionalGarmentsToAppend?: Garment[];
    openAddModalAfter?: boolean;
  }) => Promise<void>;
}

export const AI_AGENT_ANALYSIS_PROMPT = `Du bist ein professioneller Farb- und Stilbiometrie-Experte für das Kapsel-Garderoben-System „Atelier Biometric“.
Ich habe ein Foto von mir (Portrait / Selfie / Gesicht und/oder Kleidung) angehängt.

Analysiere anhand des Fotos meine Farb- und Stilwerte und antworte AUSSCHLIESSLICH mit einem validen JSON-Code-Block (ohne einleitenden oder erklärenden Text davor oder danach), exakt in dieser Struktur:

\`\`\`json
{
  "undertone": "warm",
  "skinHex": "#D4A38B",
  "hairColorName": "Kupferblond / Goldbraun",
  "hairHex": "#8C6244",
  "eyeColorName": "Blaugrau",
  "eyeHex": "#526878",
  "contrastLevel": "medium",
  "chromaLevel": "moderate",
  "haircutStyle": "medium_textured_flow",
  "wardrobeScopes": ["menswear", "unisex"],
  "styleVibe": "minimal_capsule",
  "reasoningDe": "Erklärung in 1-2 Sätzen, warum diese Farbpalette und Kontraste zu Teint, Augen und Haaren passen."
}
\`\`\`

Erklärungen & Erlaubte Werte:
- undertone: "warm" (goldig/warm, Creme/Kamel/Off-White), "olive" (Adern grünlich, bräunt schnell, Salbei/Khaki), "cool" (rosig/kühl, Sonnenbrand-anfällig, Reinweiß/Navy), "neutral" (ausgewogen).
- skinHex, hairHex, eyeHex: Reelle 6-stellige Hex-Farbcodes (#RRGGBB) aus dem Foto entnommen.
- contrastLevel: "low" (Haar & Haut ähnlich hell/dunkel), "medium" (normal), "high" (z.B. dunkle Haare auf heller Haut).
- chromaLevel: "muted" (sanfte Naturtöne), "moderate" (normale Alltagsfarben), "bright" (klare Farben & starkes Reinweiß/Schwarz).
- haircutStyle: "short_fade_structured_top" | "medium_textured_flow" | "long_hair" | "buzz_very_short".
- wardrobeScopes: ["womenswear", "unisex"] oder ["menswear", "unisex"] oder alle drei ["womenswear", "menswear", "unisex"].
- styleVibe: "minimal_capsule" | "statement_editorial" | "tailored_chic" | "street_relaxed".`;

export const CLOTHES_AI_AGENT_PROMPT = `Du bist ein professioneller Kapsel-Garderoben-Experte für „Atelier Biometric“.
Ich habe ein Foto meines Kleiderschranks / meiner Kleidung angehängt (oder hier ist eine Liste meiner Kleidungsstücke).

Erstelle daraus eine vollständige, strukturierte Liste meiner Kleidungsstücke & Accessoires als valides JSON-Array (ohne zusätzlichen Text davor oder danach).

Unterstützte Kategorien & Schnitte:
- base_top: t_shirt, heavyweight_tee, polo, longsleeve, blouse, tank_camisole, crop_top, bodysuit
- mid_layer: overshirt, button_down_shirt, crewneck_sweater, knit_sweater, turtleneck, hoodie, cardigan, blazer, vest_gilet
- outerwear: light_jacket, coat, parka, blouson, trenchcoat, leather_jacket, puffer_jacket
- bottom: denim, chino, trousers, wide_leg_trousers, midi_skirt, mini_skirt, cargo, shorts
- footwear: sneaker_clean, sneaker_chunky, boots, loafer_derby, runner, heeled_ankle_boot, ballet_flat, sandal_strappy
- accessory: watch (Uhr), sunglasses (Sonnenbrille), glasses (Brille), necklace (Kette), bracelet (Armband), belt (Gürtel), bag_backpack (Tasche), scarf (Schal), cap_beanie (Mütze), socks (Socken)

Antworte exakt in dieser JSON-Struktur:
\`\`\`json
[
  {
    "name": "Kupferfarbene Chronograph-Uhr",
    "category": "accessory",
    "subcategory": "watch",
    "colorName": "Kupfer",
    "colorHex": "#8C6244",
    "brand": "Seiko",
    "size": "40 mm",
    "formality": 3
  },
  {
    "name": "Schwarze Wayfarer Sonnenbrille",
    "category": "accessory",
    "subcategory": "sunglasses",
    "colorName": "Schwarz",
    "colorHex": "#141414",
    "brand": "Ray-Ban",
    "size": "OneSize",
    "formality": 2
  },
  {
    "name": "Off-White Heavyweight T-Shirt",
    "category": "base_top",
    "subcategory": "heavyweight_tee",
    "colorName": "Off-White",
    "colorHex": "#F4F1EA",
    "brand": "Uniqlo",
    "size": "M",
    "formality": 2
  },
  {
    "name": "Salbeigrüner Hoodie",
    "category": "mid_layer",
    "subcategory": "hoodie",
    "colorName": "Salbeigrün",
    "colorHex": "#8F9779",
    "brand": "Carhartt",
    "size": "M",
    "formality": 2
  },
  {
    "name": "Dunkelblaue Raw Denim Jeans",
    "category": "bottom",
    "subcategory": "denim",
    "colorName": "Raw Indigo",
    "colorHex": "#24344D",
    "brand": "Levi's",
    "size": "W32/L32",
    "formality": 2
  },
  {
    "name": "Weiße Leder-Sneaker",
    "category": "footwear",
    "subcategory": "sneaker_clean",
    "colorName": "Off-White",
    "colorHex": "#F4F1EA",
    "brand": "Adidas",
    "size": "42",
    "formality": 3
  }
]
\`\`\`
Regeln:
- colorHex: 6-stelliger Hex-Code (#RRGGBB).
- formality: 1 (Sport/Lounge), 2 (Casual/Alltag), 3 (Smart Casual), 4 (Business/Chic), 5 (Formal).
- Alle fehlenden Felder werden automatisch passend vorbelegt.`;

const SKIN_PRESETS: {
  undertone: Undertone;
  skinHex: string;
  labelDe: string;
  labelEn: string;
  descDe: string;
  descEn: string;
  veinAndSunHintDe: string;
  metalHintDe: string;
}[] = [
  {
    undertone: 'olive',
    skinHex: '#C8A98E',
    labelDe: 'Leicht gebräunt / Oliv (Warm-Neutral)',
    labelEn: 'Olive / Light Tan (Warm-Neutral)',
    descDe: 'Adern schimmern am Handgelenk grünlich. In der Sonne wirst du schnell braun ohne Sonnenbrand. Naturtöne wie Olivgrün, Salbei, Khaki, Sand & Braun stehen dir herausragend.',
    descEn: 'Veins appear greenish. You tan quickly in the sun. Earth tones like olive, sage, khaki, sand & brown look outstanding on you.',
    veinAndSunHintDe: '🌿 Adern grünlich · Bräunt schnell · Salbei, Khaki & Erdfarben',
    metalHintDe: 'Bronze, Gold, Messing & warme Uhren/Metalle passen super',
  },
  {
    undertone: 'warm',
    skinHex: '#D4A38B',
    labelDe: 'Warm / Goldig & Pfirsich',
    labelEn: 'Warm / Golden & Peach',
    descDe: 'Warmer, goldener Grundton. Bräunt gut in der Sonne. Cremeweiß, Off-White, Kamel & warme Naturtöne lassen dich frisch wirken (grelles Reinweiß wirkt oft zu hart).',
    descEn: 'Warm, golden undertone. Tans well in the sun. Cream, camel & warm earthy tones give you a fresh, radiant look.',
    veinAndSunHintDe: '☀️ Adern eher grün · Off-White/Creme besser als Reinweiß · Warme Töne',
    metalHintDe: 'Gold, Kupfer & warme Uhren/Metalle harmonieren am besten',
  },
  {
    undertone: 'cool',
    skinHex: '#DFC2B8',
    labelDe: 'Kühl / Hell & Rosig',
    labelEn: 'Cool / Fair & Rosy',
    descDe: 'Kühler oder leicht rosiger Teint. Adern am Handgelenk schimmern bläulich/violett. In der Sonne bekommst du eher Sonnenbrand. Kühle, klare Farben wie Dunkelblau, Grau, Tiefschwarz, Reinweiß & Weinrot stehen dir perfekt.',
    descEn: 'Cool or rosy skin. Veins appear blue or purple. Burns easily in the sun. Crisp, cool colors like navy, charcoal, black, crisp white & burgundy suit you best.',
    veinAndSunHintDe: '❄️ Adern bläulich · Sonnenbrand-anfällig · Strahlendes Reinweiß & Navy',
    metalHintDe: 'Silber, Edelstahl, Titan & Platin passen besonders gut',
  },
  {
    undertone: 'neutral',
    skinHex: '#C9A892',
    labelDe: 'Ausgewogen Neutral („Mir steht beides“)',
    labelEn: 'Balanced Neutral ("Both suit me")',
    descDe: 'Weder stark warm noch stark kühl. Adern wirken blau-grün. Du bräunst nach leichten Rötungen gleichmäßig. Du kannst sowohl kühle Basics (Dunkelblau, Grau) als auch warme Töne (Salbei, Sand) tragen.',
    descEn: 'Neither distinctly warm nor cool. Veins look blue-green. Tans evenly after slight pinkness. You can wear cool classics and warm tones with ease.',
    veinAndSunHintDe: '⚖️ Adern blau-grün · Bräunt nach kurzer Rötung · Reinweiß & Creme gehen beides',
    metalHintDe: 'Sowohl Edelstahl/Silber als auch Gold passen harmonisch',
  },
];

const HAIR_PRESETS = [
  { name: 'Kupferblond / Goldbraun', hex: '#8C6244' },
  { name: 'Dunkelblond / Aschbraun', hex: '#5A4D41' },
  { name: 'Mittelbraun / Kastanie', hex: '#4A3222' },
  { name: 'Dunkelbraun / Schwarzbraun', hex: '#231C18' },
  { name: 'Schwarz', hex: '#121214' },
  { name: 'Blond / Honigblond', hex: '#9C7A4C' },
  { name: 'Hellblond / Platin', hex: '#D8C39D' },
  { name: 'Grau / Silbergrau', hex: '#7A7D82' },
  { name: 'Kupfer / Rotbraun', hex: '#8C3D26' },
];

const EYE_PRESETS = [
  { name: 'Blau', hex: '#3B78A8' },
  { name: 'Blaugrau', hex: '#526878' },
  { name: 'Hellblau / Eisblau', hex: '#7BA7C7' },
  { name: 'Grün-Braun / Haselnuss', hex: '#6E7D4E' },
  { name: 'Grün / Graugrün', hex: '#4F6D5A' },
  { name: 'Hellbraun / Bernstein', hex: '#8B6528' },
  { name: 'Dunkelbraun', hex: '#3B281E' },
];

const ACCESSORY_QUICK_ITEMS: GarmentSubcategory[] = [
  'watch',
  'sunglasses',
  'glasses',
  'belt',
  'necklace',
  'bracelet',
  'bag_backpack',
  'scarf',
  'cap_beanie',
  'socks',
  'socks_short',
];

const HAIRCUT_OPTIONS: {
  id: HaircutStyle;
  labelDe: string;
  labelEn: string;
  descDe: string;
  descEn: string;
}[] = [
  {
    id: 'short_fade_structured_top',
    labelDe: 'Kurze Haare (Seiten kürzer, oben etwas länger)',
    labelEn: 'Short Hair (Shorter sides, textured top)',
    descDe: 'Sieht besonders gut aus mit Rundhals-Shirts, Pullovern, Hoodies und Stehkragen.',
    descEn: 'Looks great with crewnecks, sweaters, hoodies, and stand collars.',
  },
  {
    id: 'medium_textured_flow',
    labelDe: 'Mittellange Haare / Bob / Übergangslänge',
    labelEn: 'Medium Length / Bob / Textured Flow',
    descDe: 'Passt super zu Hemden, Blusen, Strickjacken, Blazern und leichten V-Ausschnitten.',
    descEn: 'Pairs well with shirts, blouses, cardigans, blazers & V-necks.',
  },
  {
    id: 'long_hair',
    labelDe: 'Lange Haare (über die Schultern)',
    labelEn: 'Long Hair (Past shoulders)',
    descDe: 'Ideal bei V-Ausschnitten, offenen Blazern, Strickjacken und weiteren Kragenformen.',
    descEn: 'Ideal for V-necks, open blazers, cardigans & open collars.',
  },
  {
    id: 'buzz_very_short',
    labelDe: 'Sehr kurze Haare / Glatze',
    labelEn: 'Very Short Hair / Buzzcut',
    descDe: 'Wirkt besonders stark mit Kapuzen (Hoodies), Rollkragen und kräftigen Stoffen.',
    descEn: 'Strong framing with hoodies, turtlenecks & structured fabrics.',
  },
];

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({
  isOpen,
  onClose,
  locale,
  currentProfile,
  currentStyleVibe,
  startInOwnClosetMode = false,
  onCompleteSetup,
}) => {
  const isEn = locale === 'en';
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const wasOpenRef = useRef<boolean>(false);
  const hasUserCustomizedScopesRef = useRef<boolean>(false);

  const [selectedStartMode, setSelectedStartMode] = useState<WizardStartMode>('own_empty');
  const [draftProfile, setDraftProfile] = useState<BiometricProfile>(currentProfile);
  const [selectedScopes, setSelectedScopes] = useState<WardrobeScopeTarget[]>(() =>
    normalizeWardrobeScopes(currentProfile)
  );
  const [showExamplePresets, setShowExamplePresets] = useState<boolean>(false);
  const [selectedVibe, setSelectedVibe] = useState<StyleVibe>(
    currentStyleVibe === 'balanced' ? 'minimal_capsule' : currentStyleVibe
  );

  // Step 4: Quick-Add own clothes right inside the wizard
  const [allColors, setAllColors] = useState<TextileColorPreset[]>(() => getAllColorPresets());
  const [quickColor, setQuickColor] = useState<TextileColorPreset>(() => getAllColorPresets()[0]);
  const [quickBrand, setQuickBrand] = useState<string>('');
  const [wizardAddedGarments, setWizardAddedGarments] = useState<Garment[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // AI Agent Prompt & JSON Importer (Biometrie & Kleidung)
  const [showAgentModal, setShowAgentModal] = useState<boolean>(false);
  const [agentModalTab, setAgentModalTab] = useState<'biometrics' | 'clothes'>('biometrics');
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [agentJsonInput, setAgentJsonInput] = useState<string>('');
  const [agentJsonError, setAgentJsonError] = useState<string | null>(null);
  const [agentJsonSuccess, setAgentJsonSuccess] = useState<string | null>(null);

  const handleCopyAgentPrompt = async () => {
    try {
      const textToCopy =
        agentModalTab === 'clothes' ? CLOTHES_AI_AGENT_PROMPT : AI_AGENT_ANALYSIS_PROMPT;
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      }
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 3000);
    } catch {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 3000);
    }
  };

  const handleApplyAgentJson = () => {
    setAgentJsonError(null);
    setAgentJsonSuccess(null);
    if (!agentJsonInput.trim()) {
      setAgentJsonError('Bitte füge zuerst die JSON-Antwort des KI-Agenten ein.');
      return;
    }
    try {
      let raw = agentJsonInput.trim();
      if (raw.includes('```json')) {
        raw = raw.split('```json')[1].split('```')[0].trim();
      } else if (raw.includes('```')) {
        raw = raw.split('```')[1].split('```')[0].trim();
      }
      const parsed = JSON.parse(raw);

      // 1. Check if clothes/garments were imported (JSON array or { garments: [...] })
      const isClothesArray = Array.isArray(parsed);
      const hasGarmentsArray =
        parsed && typeof parsed === 'object' && Array.isArray((parsed as any).garments);

      if (agentModalTab === 'clothes' || isClothesArray || hasGarmentsArray) {
        const clothesResult = parseAndNormalizeWardrobeImport(raw);
        if (clothesResult.ok && clothesResult.garments.length > 0) {
          setWizardAddedGarments((prev) => [...prev, ...clothesResult.garments]);
          setAgentJsonSuccess(
            `✓ ${clothesResult.garments.length} Kleidungsstücke & Accessoires erfolgreich importiert!`
          );
          setTimeout(() => {
            setShowAgentModal(false);
            setAgentJsonSuccess(null);
            setAgentJsonInput('');
            setStep(4);
          }, 1500);
          return;
        } else if (agentModalTab === 'clothes') {
          setAgentJsonError(clothesResult.error || 'Keine gültigen Kleidungsstücke gefunden.');
          return;
        }
      }

      // 2. Biometrics Profile import
      const nextProfile: BiometricProfile = { ...draftProfile };
      if (parsed.undertone && ['warm', 'cool', 'neutral', 'olive'].includes(parsed.undertone)) {
        nextProfile.undertone = parsed.undertone;
      }
      if (parsed.skinHex && /^#[0-9A-Fa-f]{6}$/.test(parsed.skinHex)) {
        nextProfile.skinHex = parsed.skinHex;
      }
      if (parsed.hairHex && /^#[0-9A-Fa-f]{6}$/.test(parsed.hairHex)) {
        nextProfile.hairHex = parsed.hairHex;
      }
      if (parsed.hairColorName) {
        nextProfile.hairColorName = String(parsed.hairColorName);
      }
      if (parsed.eyeHex && /^#[0-9A-Fa-f]{6}$/.test(parsed.eyeHex)) {
        nextProfile.eyeHex = parsed.eyeHex;
      }
      if (parsed.eyeColorName) {
        const rawEyeName = String(parsed.eyeColorName).trim();
        nextProfile.eyeColorName =
          rawEyeName.toLowerCase() === 'blau-grau' ? 'Blaugrau' : rawEyeName;
      }
      if (parsed.contrastLevel && ['low', 'medium', 'high'].includes(parsed.contrastLevel)) {
        nextProfile.contrastLevel = parsed.contrastLevel;
      }
      if (parsed.chromaLevel && ['muted', 'moderate', 'bright'].includes(parsed.chromaLevel)) {
        nextProfile.chromaLevel = parsed.chromaLevel;
      }
      if (parsed.haircutStyle) {
        nextProfile.haircutStyle = parsed.haircutStyle;
      }
      // Only let AI pre-fill wardrobeScopes initially if the user hasn't manually overridden them yet
      if (
        !hasUserCustomizedScopesRef.current &&
        Array.isArray(parsed.wardrobeScopes) &&
        parsed.wardrobeScopes.length > 0
      ) {
        const validScopes = parsed.wardrobeScopes.filter((s: string) =>
          ['womenswear', 'menswear', 'unisex'].includes(s)
        ) as WardrobeScopeTarget[];
        if (validScopes.length > 0) {
          setSelectedScopes(validScopes);
          nextProfile.wardrobeScopes = validScopes;
          nextProfile.wardrobeScope = deriveScopeFromTargets(validScopes);
        }
      } else {
        nextProfile.wardrobeScopes = selectedScopes;
        nextProfile.wardrobeScope = deriveScopeFromTargets(selectedScopes);
      }
      if (
        parsed.styleVibe &&
        ['minimal_capsule', 'statement_editorial', 'tailored_chic', 'street_relaxed'].includes(
          parsed.styleVibe
        )
      ) {
        setSelectedVibe(parsed.styleVibe);
      }

      setDraftProfile(nextProfile);
      setAgentJsonSuccess('✓ Farb- & Stilwerte aus dem KI-Ergebnis erfolgreich übernommen!');
      setTimeout(() => {
        setShowAgentModal(false);
        setAgentJsonSuccess(null);
        setAgentJsonInput('');
        setStep(2);
      }, 1500);
    } catch (err: any) {
      setAgentJsonError(`JSON konnte nicht gelesen werden: ${err.message || 'Ungültiges Format'}`);
    }
  };

  const handleSelectSkin = (sp: (typeof SKIN_PRESETS)[number]) => {
    const skinL = hexToHsl(sp.skinHex).l;
    const hairL = hexToHsl(draftProfile.hairHex || '#5A4D41').l;
    const deltaL = Math.abs(skinL - hairL);
    const derivedContrast: ContrastLevel = deltaL < 25 ? 'low' : deltaL <= 52 ? 'medium' : 'high';
    setDraftProfile({
      ...draftProfile,
      undertone: sp.undertone,
      skinHex: sp.skinHex,
      contrastLevel: derivedContrast,
    });
  };

  const handleSelectHair = (hair: (typeof HAIR_PRESETS)[number]) => {
    const skinL = hexToHsl(draftProfile.skinHex).l;
    const hairL = hexToHsl(hair.hex).l;
    const deltaL = Math.abs(skinL - hairL);
    const derivedContrast: ContrastLevel = deltaL < 25 ? 'low' : deltaL <= 52 ? 'medium' : 'high';
    setDraftProfile({
      ...draftProfile,
      hairHex: hair.hex,
      hairColorName: hair.name,
      contrastLevel: derivedContrast,
    });
  };

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) {
      // Wizard is already open: never overwrite user's edits or selectedScopes when switching tabs
      return;
    }
    wasOpenRef.current = true;
    hasUserCustomizedScopesRef.current = false;
    setStep(1);
    setDraftProfile(currentProfile);
    setSelectedScopes(normalizeWardrobeScopes(currentProfile));
    setShowExamplePresets(false);
    const colors = getAllColorPresets();
    setAllColors(colors);
    setQuickColor(colors[0]);
    setWizardAddedGarments([]);
    setSelectedStartMode(
      startInOwnClosetMode || currentProfile.isDemoMode !== false
        ? 'own_empty'
        : 'keep_current'
    );
  }, [isOpen, startInOwnClosetMode, currentProfile]);

  const derivedPalette = useMemo(
    () => deriveSeasonPalette(draftProfile),
    [draftProfile]
  );

  const quickItems = useMemo(
    () => getQuickItemsForScopes(selectedScopes),
    [selectedScopes]
  );

  if (!isOpen) return null;

  const handleToggleScope = (scope: WardrobeScopeTarget) => {
    hasUserCustomizedScopesRef.current = true;
    setSelectedScopes((prev) => {
      let next: WardrobeScopeTarget[];
      if (prev.includes(scope)) {
        // Keep at least one selected so the user always has choices
        if (prev.length === 1) return prev;
        next = prev.filter((s) => s !== scope);
      } else {
        next = [...prev, scope];
      }
      const derived = deriveScopeFromTargets(next);
      setDraftProfile((dp) => ({
        ...dp,
        wardrobeScopes: next,
        wardrobeScope: derived,
      }));
      return next;
    });
  };

  const handleSelectPreset = (presetKey: WardrobePresetKey) => {
    hasUserCustomizedScopesRef.current = true;
    setSelectedStartMode(presetKey);
    const preset = WARDROBE_PRESETS[presetKey];
    let targetScopes: WardrobeScopeTarget[];
    if (preset.scope === 'womenswear') targetScopes = ['womenswear', 'unisex'];
    else if (preset.scope === 'menswear') targetScopes = ['menswear', 'unisex'];
    else if (preset.scope === 'unisex') targetScopes = ['unisex'];
    else targetScopes = ['womenswear', 'menswear', 'unisex'];

    setSelectedScopes(targetScopes);
    setDraftProfile((prev) => ({
      ...prev,
      wardrobeScopes: targetScopes,
      wardrobeScope: preset.scope,
    }));
  };

  const handleAddWizardGarment = (subcategory: GarmentSubcategory) => {
    const defaults = SMART_SUBCATEGORY_DEFAULTS[subcategory];
    const hsl = hexToHsl(quickColor.hex);
    const colorTemp = classifyColorTemp(hsl);
    const cleanSubLabel = SUBCATEGORY_LABELS[subcategory].split(' (')[0];
    const cleanColor = quickColor.name.replace(' (Test)', '');
    const autoSize = suggestSizeForGarment(defaults.category, quickBrand, draftProfile).suggestedSize;

    const newItem: Garment = {
      id: `own_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${cleanSubLabel} ${cleanColor}`,
      category: defaults.category,
      subcategory,
      colorName: cleanColor,
      colorHex: quickColor.hex,
      hsl,
      colorTemp,
      fit: defaults.fit,
      neckline: defaults.neckline,
      texture: defaults.texture,
      thermalRating: defaults.thermalRating,
      formality: defaults.formality,
      waterResistant: defaults.waterResistant,
      isClean: true,
      brand: quickBrand.trim() || undefined,
      size: autoSize || undefined,
    };

    setWizardAddedGarments((prev) => [newItem, ...prev]);
  };

  const handleRemoveWizardGarment = (id: string) => {
    setWizardAddedGarments((prev) => prev.filter((g) => g.id !== id));
  };

  const hasTop = wizardAddedGarments.some(
    (g) => g.category === 'base_top' || g.category === 'mid_layer'
  );
  const hasBottom = wizardAddedGarments.some((g) => g.category === 'bottom');
  const hasShoes = wizardAddedGarments.some((g) => g.category === 'footwear');

  const handleFinish = async (openAddModalAfter = false) => {
    setIsSaving(true);
    try {
      let garmentsToLoad: Garment[] | null = null;
      let additionalGarmentsToAppend: Garment[] | undefined = undefined;
      let isDemo = false;

      if (selectedStartMode === 'own_empty') {
        // Replace demo wardrobe with the user's own added garments (or empty array if none clicked yet)
        garmentsToLoad = wizardAddedGarments;
        isDemo = false;
      } else if (selectedStartMode === 'keep_current') {
        garmentsToLoad = null;
        additionalGarmentsToAppend =
          wizardAddedGarments.length > 0 ? wizardAddedGarments : undefined;
        isDemo = false;
      } else {
        // A preset was chosen from the example list
        const presetGarments = WARDROBE_PRESETS[selectedStartMode].garments;
        garmentsToLoad = [...wizardAddedGarments, ...presetGarments];
        isDemo = wizardAddedGarments.length === 0;
      }

      const derivedScope = deriveScopeFromTargets(selectedScopes);

      await onCompleteSetup({
        profile: {
          ...draftProfile,
          wardrobeScopes: selectedScopes,
          wardrobeScope: derivedScope,
          isDemoMode: isDemo,
        },
        styleVibe: selectedVibe,
        garmentsToLoad,
        additionalGarmentsToAppend,
        openAddModalAfter,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto sm:overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-wizard-title"
    >
      <div className="w-full h-full sm:h-auto sm:max-h-[90vh] max-w-3xl rounded-none sm:rounded-2xl bg-zinc-950 border-0 sm:border sm:border-zinc-800 shadow-2xl my-0 sm:my-8 overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="shrink-0 sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-800/90 bg-zinc-950/95 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="setup-wizard-title" className="text-sm sm:text-lg font-semibold text-zinc-100">
                {isEn
                  ? 'Closet Setup Wizard (4 Steps)'
                  : 'Kleiderschrank einrichten (4 Schritte)'}
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400">
                {isEn
                  ? 'Exit demo mode, find your best colors & add clothes'
                  : 'Demo beenden, Farben bestimmen & eigene Kleidung anlegen'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Setup-Assistent schließen"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-900 cursor-pointer touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar - Horizontally Scrollable on Mobile */}
        <div className="shrink-0 px-4 sm:px-6 py-2.5 sm:py-3 bg-zinc-900/30 border-b border-zinc-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none flex-nowrap sm:grid sm:grid-cols-4">
          {[
            {
              num: 1 as const,
              titleDe: '1. Schrank & Größen',
              titleEn: '1. Closet & Sizes',
            },
            {
              num: 2 as const,
              titleDe: '2. Deine Farben',
              titleEn: '2. Your Colors',
            },
            {
              num: 3 as const,
              titleDe: '3. Dein Stil',
              titleEn: '3. Your Style',
            },
            {
              num: 4 as const,
              titleDe: `4. Kleidung (${wizardAddedGarments.length})`,
              titleEn: `4. Clothes (${wizardAddedGarments.length})`,
            },
          ].map((s) => {
            const active = step === s.num;
            const done = step > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num)}
                className={`py-2 px-3 min-h-[38px] rounded-xl border text-left text-xs font-medium transition-colors cursor-pointer shrink-0 sm:shrink whitespace-nowrap touch-manipulation active:scale-95 ${
                  active
                    ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-semibold'
                    : done
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {isEn ? s.titleEn : s.titleDe}
              </button>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* STEP 1: DEMO BEENDEN / EIGENER SCHRANK + FÜR WEN + GRÖSSEN */}
          {step === 1 && (
            <div className="space-y-6">
              {/* 1A: Start Mode */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">
                    {isEn
                      ? '1. How would you like to start?'
                      : '1. Wie möchtest du starten? (Demo-Modus beenden oder Beispiele nutzen)'}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {isEn
                      ? 'Your data is saved locally in your browser (IndexedDB) and in your local database file (data/wardrobe-store.json).'
                      : 'Deine eigene Datenbank wird lokal im Browser (IndexedDB) und in deiner lokalen Datei (data/wardrobe-store.json) gespeichert.'}
                  </p>
                </div>

                {/* AI Agent Analysis Quick Option */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Bot className="w-4 h-4 text-amber-400 shrink-0" />
                    <p className="text-xs text-zinc-300">
                      <strong className="text-amber-200">Foto per KI analysieren lassen:</strong> Lass Hautunterton, Kontrast &amp; Farben direkt aus einem Selfie ermitteln.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAgentModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold shrink-0 cursor-pointer transition-colors shadow-sm"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>KI-Prompt</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* Option 1: Exit Demo Mode & Start Own Empty Closet */}
                  <button
                    type="button"
                    onClick={() => setSelectedStartMode('own_empty')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-4 ${
                      selectedStartMode === 'own_empty'
                        ? 'bg-emerald-950/30 border-emerald-400 text-zinc-100 ring-1 ring-emerald-400/30'
                        : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-emerald-300">
                          {isEn
                            ? 'Exit Demo Mode & Start My Own Wardrobe (Recommended)'
                            : 'Demo-Modus beenden & Meinen eigenen Kleiderschrank starten (Empfohlen)'}
                        </span>
                        {selectedStartMode === 'own_empty' && (
                          <span className="px-2 py-0.5 rounded bg-emerald-400 text-zinc-950 text-[11px] font-semibold">
                            ✓ {isEn ? 'Selected' : 'Ausgewählt'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        {isEn
                          ? 'Removes all example demo clothes so you start fresh with your own wardrobe. In Step 4 you can immediately click together your own clothes.'
                          : 'Entfernt alle Demo-Beispielsachen, damit du komplett mit deiner eigenen Kleidung startest. In Schritt 4 kannst du direkt deine ersten eigenen Teile anklicken.'}
                      </p>
                    </div>
                  </button>

                  {/* Option 2: Keep current closet */}
                  <button
                    type="button"
                    onClick={() => setSelectedStartMode('keep_current')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      selectedStartMode === 'keep_current'
                        ? 'bg-amber-500/15 border-amber-400 text-zinc-100'
                        : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-semibold block text-zinc-100">
                        {isEn
                          ? 'Keep current clothes & add new items'
                          : 'Aktuelle Kleidungsstücke im Schrank behalten & ergänzen'}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {isEn
                          ? 'Keeps everything currently in your closet and adds any items you pick in Step 4.'
                          : 'Behält alle aktuellen Teile im Schrank und fügt neue Sachen aus Schritt 4 hinzu.'}
                      </span>
                    </div>
                    {selectedStartMode === 'keep_current' && (
                      <Check className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                  </button>

                  {/* Collapsible Example Wardrobe Loader (Optional) */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowExamplePresets((prev) => !prev)}
                      className="text-xs text-zinc-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer py-1"
                    >
                      <span className="text-[10px]">{showExamplePresets ? '▲' : '▼'}</span>
                      <span>
                        {isEn
                          ? 'Or load an example wardrobe for testing (Optional)'
                          : 'Möchtest du stattdessen eine Beispiel-Garderobe zum Testen laden? (Optional)'}
                      </span>
                    </button>

                    {showExamplePresets && (
                      <div className="mt-2.5 p-3 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-2">
                        <p className="text-[11px] text-zinc-400">
                          {isEn
                            ? 'Select a curated sample wardrobe if you want to explore the app with pre-filled items:'
                            : 'Wähle eine fertige Beispiel-Garderobe, falls du die App erst einmal mit Test-Kleidung ausprobieren möchtest:'}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(
                            [
                              'womenswear_capsule',
                              'menswear_unisex',
                              'unisex_essentials',
                              'combined_atelier',
                            ] as WardrobePresetKey[]
                          ).map((presetKey) => {
                            const preset = WARDROBE_PRESETS[presetKey];
                            const isSelected = selectedStartMode === presetKey;
                            return (
                              <button
                                key={presetKey}
                                type="button"
                                onClick={() => handleSelectPreset(presetKey)}
                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-500/15 border-amber-400 text-zinc-100 ring-1 ring-amber-400/40'
                                    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <p className="text-xs font-semibold text-zinc-200">
                                    {isEn ? preset.labelEn : preset.labelDe}
                                  </p>
                                  {isSelected && (
                                    <span className="text-[10px] text-amber-400 font-medium">
                                      ✓ Aktiv
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                                  {isEn ? preset.descriptionEn : preset.descriptionDe}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 1B: Für wen? Multi-Select (Frauen / Männer / Unisex) */}
              <div className="space-y-2.5 pt-4 border-t border-zinc-800/80">
                <div>
                  <label className="block text-xs font-semibold text-zinc-100">
                    {isEn
                      ? '2. Which clothing types do you wear? (Multi-Select)'
                      : '2. Welche Kleidungsstücke möchtest du nutzen? (Mehrfachauswahl möglich)'}
                  </label>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {isEn
                      ? 'Select all categories you want to include. Selecting all 3 unlocks the complete range of clothing.'
                      : 'Wähle alle Kategorien aus, die du tragen möchtest. Wenn du alle 3 anklickst, steht dir die komplette Auswahl an Kleidung zur Verfügung.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(['womenswear', 'menswear', 'unisex'] as WardrobeScopeTarget[]).map((scopeKey) => {
                    const isChecked = selectedScopes.includes(scopeKey);
                    const meta = WARDROBE_MULTI_SCOPE_META[scopeKey];
                    return (
                      <button
                        key={scopeKey}
                        type="button"
                        onClick={() => handleToggleScope(scopeKey)}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                          isChecked
                            ? 'bg-amber-500/15 border-amber-400 text-zinc-100 ring-1 ring-amber-400/30'
                            : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="text-xs font-semibold text-zinc-100">
                            {isEn ? meta.labelEn : meta.labelDe}
                          </span>
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors ${
                              isChecked
                                ? 'bg-amber-400 text-zinc-950 font-bold'
                                : 'border border-zinc-600 bg-zinc-950/60'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-snug">
                          {isEn ? meta.descEn : meta.descDe}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Scope selection summary badge */}
                <div className="text-[11px] text-zinc-400 pt-1 flex items-center gap-1.5">
                  <span className="text-zinc-500">Ausgewählt:</span>
                  <span className="text-amber-300 font-medium">
                    {selectedScopes.map((s) => WARDROBE_MULTI_SCOPE_META[s].shortDe).join(' + ')}
                  </span>
                  {selectedScopes.length === 3 && (
                    <span className="text-emerald-400 text-[10px] font-semibold bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded ml-1">
                      Komplette Auswahl aktiv
                    </span>
                  )}
                </div>
              </div>

              {/* 1C: Standard-Größen (Optional) */}
              <div className="space-y-2.5 pt-4 border-t border-zinc-800/80">
                <label className="block text-xs font-semibold text-zinc-100 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-amber-400" />
                  {isEn
                    ? '3. Your Standard Sizes (Optional – auto-fills when adding clothes)'
                    : '3. Deine normalen Größen (Optional – wird beim Kleidung-Anlegen vorgeschlagen)'}
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="block text-[11px] text-zinc-400 mb-1">
                      Oberteile (z. B. S, M, L, 38)
                    </span>
                    <input
                      type="text"
                      value={draftProfile.defaultSizes?.top || ''}
                      onChange={(e) =>
                        setDraftProfile({
                          ...draftProfile,
                          defaultSizes: {
                            ...draftProfile.defaultSizes,
                            top: e.target.value,
                          },
                        })
                      }
                      placeholder="z. B. M oder 38"
                      className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-zinc-400 mb-1">
                      Hosen / Röcke (z. B. M, 38, W32)
                    </span>
                    <input
                      type="text"
                      value={draftProfile.defaultSizes?.bottom || ''}
                      onChange={(e) =>
                        setDraftProfile({
                          ...draftProfile,
                          defaultSizes: {
                            ...draftProfile.defaultSizes,
                            bottom: e.target.value,
                          },
                        })
                      }
                      placeholder="z. B. M oder W32"
                      className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] text-zinc-400 mb-1">
                      Schuhe (z. B. 39, 42, 43)
                    </span>
                    <input
                      type="text"
                      value={draftProfile.defaultSizes?.shoes || ''}
                      onChange={(e) =>
                        setDraftProfile({
                          ...draftProfile,
                          defaultSizes: {
                            ...draftProfile.defaultSizes,
                            shoes: e.target.value,
                          },
                        })
                      }
                      placeholder="z. B. 39 oder 42"
                      className="w-full px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: EINFACH ERKLÄRTE FARB- & TYP-FRAGEN */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Top helper banner with AI Agent Prompt & Neutral Fallback */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-amber-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    Keine Lust auf manuelles Durchklicken?
                  </p>
                  <p className="text-[11px] text-zinc-300">
                    Lass deine Farbwerte anhand eines Fotos von einem KI-Agenten (ChatGPT, Gemini, Claude) bestimmen – oder klicke die 5 Alltagsfragen schnell durch.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAgentModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold shrink-0 cursor-pointer transition-colors shadow-sm"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    <span>KI-Agent Prompt kopieren</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftProfile({
                        ...draftProfile,
                        undertone: 'neutral',
                        contrastLevel: 'medium',
                        chromaLevel: 'muted',
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    Neutral setzen
                  </button>
                </div>
              </div>

              {/* 1. Skin Undertone explained with Veins, Sun & T-Shirt (No jewelry bias!) */}
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-100">
                    1. Dein Hautton &amp; Unterton (3 einfache Alltags-Checks – kein Schmuck nötig)
                  </label>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    <strong>1. Adern-Check am Handgelenk:</strong> Grünlich = Warm/Oliv · Bläulich/Violett = Kühl · Blaugrün = Neutral.<br />
                    <strong>2. Sonnen-Check:</strong> Wirst du schnell braun (Warm/Oliv) oder bekommst du schnell Sonnenbrand (Kühl)?<br />
                    <strong>3. T-Shirt-Check:</strong> Steht dir Off-White/Creme besser als grelles Reinweiß (Warm/Oliv) oder strahlendes Reinweiß (Kühl)?
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SKIN_PRESETS.map((sp) => {
                    const active = draftProfile.undertone === sp.undertone;
                    return (
                      <button
                        key={sp.undertone}
                        type="button"
                        onClick={() => handleSelectSkin(sp)}
                        className={`p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-500/15 border-amber-400 text-zinc-100 ring-1 ring-amber-400/30'
                            : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                        }`}
                      >
                        <span
                          className="w-7 h-7 rounded-full border border-white/25 shrink-0 mt-0.5"
                          style={{ backgroundColor: sp.skinHex }}
                        />
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-zinc-100">
                            {isEn ? sp.labelEn : sp.labelDe}
                          </p>
                          <p className="text-[11px] text-amber-300 font-medium">
                            {sp.veinAndSunHintDe}
                          </p>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            {isEn ? sp.descEn : sp.descDe}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            Metalle / Uhren: {sp.metalHintDe}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Haarfarbe (Warum beachten wir das?) */}
              <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                <div>
                  <label className="block text-xs font-semibold text-zinc-100">
                    2. Deine Haarfarbe (Warum beachten wir das?)
                  </label>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Zusammen mit deiner Haut bestimmt deine Haarfarbe deinen natürlichen Hell-Dunkel-Kontrast: Dunkle Haare auf heller Haut brauchen kräftige Kontraste (z. B. weißes Shirt unter dunkler Jacke), während ähnliche Töne (z. B. braune Haare &amp; gebräunte Haut) sanfte Ton-in-Ton-Outfits lieben.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {HAIR_PRESETS.map((hair) => {
                    const active =
                      draftProfile.hairHex?.toLowerCase() === hair.hex.toLowerCase();
                    return (
                      <button
                        key={hair.hex}
                        type="button"
                        onClick={() => handleSelectHair(hair)}
                        className={`inline-flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          active
                            ? 'bg-amber-500/15 border-amber-400 text-zinc-100 font-semibold ring-1 ring-amber-400/30'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                          style={{ backgroundColor: hair.hex }}
                        />
                        <span className="truncate">{hair.name.split(' / ')[0]}</span>
                      </button>
                    );
                  })}
                  {/* Dynamic chip if custom / KI hair color does not match any preset */}
                  {!HAIR_PRESETS.some(
                    (h) => h.hex.toLowerCase() === draftProfile.hairHex?.toLowerCase()
                  ) && draftProfile.hairHex && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 p-2.5 rounded-lg border text-xs bg-amber-500/15 border-amber-400 text-zinc-100 font-semibold ring-1 ring-amber-400/30 cursor-pointer"
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: draftProfile.hairHex }}
                      />
                      <span className="truncate">{draftProfile.hairColorName || 'Eigene Haarfarbe'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 3. Eye Color Presets */}
              <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                <div>
                  <span className="block text-xs font-semibold text-zinc-100">
                    3. Deine Augenfarbe (Warum fragen wir das?)
                  </span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Kleiner Styling-Trick: Wenn ein Pullover oder Shirt deine Augenfarbe aufgreift (z. B. Olivgrün bei grün-braunen Augen oder Blaugrau bei blauen Augen), wirken deine Augen sofort wacher und lebendiger.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {EYE_PRESETS.map((eye) => {
                    const active =
                      draftProfile.eyeHex?.toLowerCase() === eye.hex.toLowerCase() ||
                      draftProfile.eyeColorName?.toLowerCase().replace('-', '') ===
                        eye.name.toLowerCase().replace('-', '');
                    return (
                      <button
                        key={eye.hex}
                        type="button"
                        onClick={() =>
                          setDraftProfile({
                            ...draftProfile,
                            eyeColorName: eye.name,
                            eyeHex: eye.hex,
                          })
                        }
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          active
                            ? 'bg-amber-500/15 border-amber-400 text-zinc-100 font-semibold ring-1 ring-amber-400/30'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/25"
                          style={{ backgroundColor: eye.hex }}
                        />
                        <span>{eye.name}</span>
                      </button>
                    );
                  })}
                  {/* Dynamic chip if custom / KI eye color does not match any preset */}
                  {!EYE_PRESETS.some(
                    (e) =>
                      e.hex.toLowerCase() === draftProfile.eyeHex?.toLowerCase() ||
                      e.name.toLowerCase().replace('-', '') ===
                        draftProfile.eyeColorName?.toLowerCase().replace('-', '')
                  ) && draftProfile.eyeHex && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs bg-amber-500/15 border-amber-400 text-zinc-100 font-semibold ring-1 ring-amber-400/30 cursor-pointer"
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/25"
                        style={{ backgroundColor: draftProfile.eyeHex }}
                      />
                      <span>{draftProfile.eyeColorName || 'Eigene Augenfarbe'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4. Contrast & Chroma with automatic hair-skin hint */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/80">
                <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="block text-xs font-semibold text-zinc-100">
                      4. Kontrast (Hell-Dunkel-Unterschied)
                    </span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                      Auto-berechnet
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Wird automatisch aus deiner gewählten Haar- und Hautfarbe abgeleitet. Du kannst es hier nach deinen Wünschen anpassen.
                  </p>
                  <div className="space-y-1.5">
                    {(
                      [
                        {
                          id: 'low',
                          label: 'Sanft / Ähnlich (Haut & Haare haben ähnliche Helligkeit)',
                        },
                        {
                          id: 'medium',
                          label: 'Mittel / Normal (Ausgewogener Alltagskontrast)',
                        },
                        {
                          id: 'high',
                          label: 'Stark (z. B. dunkle Haare auf heller Haut)',
                        },
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setDraftProfile({
                            ...draftProfile,
                            contrastLevel: c.id as ContrastLevel,
                          })
                        }
                        className={`w-full px-3 py-2 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                          draftProfile.contrastLevel === c.id
                            ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-semibold'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2.5">
                  <div>
                    <span className="block text-xs font-semibold text-zinc-100">
                      5. Welche Farb-Intensität magst du lieber?
                    </span>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Manchen stehen ruhige, unaufdringliche Naturtöne besser, anderen leuchtende Farben.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {(
                      [
                        {
                          id: 'muted',
                          label: 'Ruhige, sanfte Naturtöne (Salbei, Beige, Navy, Grau – nichts Grelles)',
                        },
                        {
                          id: 'moderate',
                          label: 'Normale Alltagsfarben (weder verwaschen noch knallig)',
                        },
                        {
                          id: 'bright',
                          label: 'Kräftige Farben (Reines Weiß, Tiefschwarz, leuchtendes Rot/Blau)',
                        },
                      ] as const
                    ).map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() =>
                          setDraftProfile({
                            ...draftProfile,
                            chromaLevel: ch.id as ChromaLevel,
                          })
                        }
                        className={`w-full px-3 py-2 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                          draftProfile.chromaLevel === ch.id
                            ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-semibold'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                        }`}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>


              {/* 5. Haircut / Framing */}
              <div className="space-y-2">
                <div>
                  <span className="block text-xs font-semibold text-zinc-100">
                    5. Deine Haarlänge (Für passende Kragen &amp; Ausschnitte)
                  </span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Je nach Haarlänge sitzen Rundhals, V-Ausschnitt, Kapuze oder Hemdkragen unterschiedlich gut.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {HAIRCUT_OPTIONS.map((hc) => {
                    const active = draftProfile.haircutStyle === hc.id;
                    return (
                      <button
                        key={hc.id}
                        type="button"
                        onClick={() =>
                          setDraftProfile({ ...draftProfile, haircutStyle: hc.id })
                        }
                        className={`p-3 rounded-xl border text-left cursor-pointer ${
                          active
                            ? 'bg-amber-500/15 border-amber-400 text-zinc-100'
                            : 'bg-zinc-900/50 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                        }`}
                      >
                        <p className="text-xs font-semibold">
                          {isEn ? hc.labelEn : hc.labelDe}
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {isEn ? hc.descEn : hc.descDe}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Plain-Language Result Box */}
              <div className="p-4 rounded-xl bg-zinc-900/80 border border-amber-500/30 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold text-amber-400">
                      Dein Farb-Ergebnis (automatisch für deine Outfits genutzt):
                    </span>
                    <p className="text-sm font-bold text-zinc-100 mt-0.5">
                      {derivedPalette.seasonName}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {derivedPalette.powerColors.slice(0, 8).map((sw) => (
                      <span
                        key={sw.hex}
                        className="w-5 h-5 rounded-full border border-white/20"
                        style={{ backgroundColor: sw.hex }}
                        title={sw.name}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {derivedPalette.description}
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: LIEBLINGS-STIL */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  {isEn
                    ? 'Choose your favorite everyday style'
                    : '3. Wie ziehst du dich im Alltag am liebsten an?'}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {isEn
                    ? 'You can switch this anytime with 1 click on the start page.'
                    : 'Du kannst diese Stil-Richtung später jederzeit mit 1 Klick auf der Startseite umschalten.'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {(Object.keys(STYLE_VIBE_META) as StyleVibe[]).map((vibeKey) => {
                  const meta = STYLE_VIBE_META[vibeKey];
                  const active = selectedVibe === vibeKey;
                  return (
                    <button
                      key={vibeKey}
                      type="button"
                      onClick={() => setSelectedVibe(vibeKey)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-4 ${
                        active
                          ? 'bg-amber-500/15 border-amber-400 text-zinc-100'
                          : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-sm font-semibold text-zinc-100">
                            {isEn ? meta.labelEn : meta.labelDe}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          {isEn ? meta.subtitleEn : meta.subtitleDe}
                        </p>
                      </div>
                      {active && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: EIGENE KLEIDUNG DIREKT ANKLICKEN */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Shirt className="w-4 h-4 text-amber-400" />
                    {isEn
                      ? '4. Click Together Your Own Clothes & Accessories'
                      : '4. Klicke jetzt deine eigenen Kleidungsstücke & Accessoires zusammen'}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {isEn
                      ? '1. Tap a color (and optional brand) · 2. Tap a garment or accessory to add it. You can also import everything via AI prompt!'
                      : '1. Farbe & Marke wählen · 2. Kleidungsstück oder Accessoire antippen. Du kannst auch die gesamte Garderobe per KI importieren!'}
                  </p>
                </div>
              </div>

              {/* KI-Import Quick Banner for Clothes & Accessories */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-2.5">
                  <Bot className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <p className="text-xs font-semibold text-zinc-100">
                      Ganze Garderobe &amp; Accessoires per KI importieren?
                    </p>
                    <p className="text-[11px] text-zinc-400">
                      Foto von Schrank/Kleidung machen oder Stichwortliste einfügen → Prompt kopieren und alle Teile (inkl. Uhren, Brillen, Schmuck) mit 1 Klick anlegen.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAgentModalTab('clothes');
                    setShowAgentModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold shrink-0 cursor-pointer transition-colors shadow-sm"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Kleider-KI öffnen</span>
                </button>
              </div>

              {/* Readiness Bar for First Outfit */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-zinc-300 font-medium">
                  Check für dein erstes eigenes Outfit:
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={hasTop ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}>
                    {hasTop ? '✓ Oberteil dabei' : '○ Noch 1 Oberteil wählen'}
                  </span>
                  <span className={hasBottom ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}>
                    {hasBottom ? '✓ Hose/Rock dabei' : '○ Noch 1 Hose/Rock wählen'}
                  </span>
                  <span className={hasShoes ? 'text-emerald-400 font-semibold' : 'text-zinc-500'}>
                    {hasShoes ? '✓ Schuhe dabei' : '○ Noch 1 Paar Schuhe wählen'}
                  </span>
                </div>
              </div>

              {/* Color & Brand Picker */}
              <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-zinc-300">
                    1. Welche Farbe hat das Teil?{' '}
                    <strong className="text-amber-400">{quickColor.name.replace(' (Test)', '')}</strong>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {allColors.slice(0, 14).map((c) => {
                      const active = c.hex.toUpperCase() === quickColor.hex.toUpperCase();
                      return (
                        <button
                          key={`${c.name}_${c.hex}`}
                          type="button"
                          onClick={() => setQuickColor(c)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
                            active
                              ? 'bg-zinc-800 border-amber-400 text-zinc-100 ring-1 ring-amber-400/40'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span>{c.name.replace(' (Test)', '')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/60 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-zinc-400 mr-1">
                    Optional Marke:
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuickBrand('')}
                    className={`px-2 py-0.5 rounded-md border text-[11px] cursor-pointer ${
                      quickBrand === ''
                        ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-semibold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Ohne Marke
                  </button>
                  {['Nike', 'Adidas', "Levi's", 'Zara', 'H&M', 'Uniqlo', 'COS', 'Carhartt'].map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setQuickBrand(b)}
                      className={`px-2 py-0.5 rounded-md border text-[11px] cursor-pointer ${
                        quickBrand === b
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* 1-Click Garment Grid with inline Scope Switcher so user can override anytime */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-300">
                    2. Tippe auf ein Kleidungsstück, um es in deinen Schrank zu legen:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-zinc-500 mr-0.5">Auswahl:</span>
                    {(['menswear', 'womenswear', 'unisex'] as WardrobeScopeTarget[]).map(
                      (scopeKey) => {
                        const isChecked = selectedScopes.includes(scopeKey);
                        const meta = WARDROBE_MULTI_SCOPE_META[scopeKey];
                        return (
                          <button
                            key={scopeKey}
                            type="button"
                            onClick={() => handleToggleScope(scopeKey)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                              isChecked
                                ? 'bg-amber-500/15 border-amber-400 text-amber-200 font-semibold'
                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 text-amber-400" />}
                            <span>{isEn ? meta.labelEn : meta.labelDe}</span>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {quickItems
                    .filter((sub) => SMART_SUBCATEGORY_DEFAULTS[sub]?.category !== 'accessory')
                    .map((sub) => {
                      const cleanLabel = SUBCATEGORY_LABELS[sub].split(' (')[0];
                      const defaults = SMART_SUBCATEGORY_DEFAULTS[sub];
                      const autoSize = suggestSizeForGarment(defaults.category, quickBrand, draftProfile).suggestedSize;
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => handleAddWizardGarment(sub)}
                          className="group flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-amber-500/50 hover:bg-zinc-900 transition-all text-left cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-center shrink-0">
                            <GarmentVector
                              type={sub}
                              colorHex={quickColor.hex}
                              texture={defaults.texture}
                              className="w-8 h-8"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-zinc-200 group-hover:text-amber-300 truncate">
                              + {cleanLabel}
                            </p>
                            <p className="text-[10px] text-zinc-500 truncate">
                              {quickBrand ? `${quickBrand} · ` : ''}
                              {autoSize ? `Gr. ${autoSize}` : quickColor.name.replace(' (Test)', '')}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* 1-Click Accessories & Jewelry Grid */}
              <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    3. Accessoires, Uhren &amp; Schmuck antippen:
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    Farbe {quickColor.name.replace(' (Test)', '')}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ACCESSORY_QUICK_ITEMS.map((sub) => {
                    const cleanLabel = SUBCATEGORY_LABELS[sub].split(' (')[0];
                    const defaults = SMART_SUBCATEGORY_DEFAULTS[sub];
                    const autoSize = suggestSizeForGarment(defaults.category, quickBrand, draftProfile).suggestedSize;
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => handleAddWizardGarment(sub)}
                        className="group flex items-center gap-2 p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-amber-500/50 hover:bg-zinc-900 transition-all text-left cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-center shrink-0">
                          <GarmentVector
                            type={sub}
                            colorHex={quickColor.hex}
                            texture={defaults.texture}
                            className="w-7 h-7"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-zinc-200 group-hover:text-amber-300 truncate">
                            + {cleanLabel}
                          </p>
                          <p className="text-[10px] text-zinc-500 truncate">
                            {quickBrand ? `${quickBrand} · ` : ''}
                            {autoSize ? `Gr. ${autoSize}` : quickColor.name.replace(' (Test)', '')}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Added Garments List */}
              {wizardAddedGarments.length > 0 && (
                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                  <p className="text-xs font-semibold text-emerald-300">
                    Deine neu angelegten Kleidungsstücke ({wizardAddedGarments.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {wizardAddedGarments.map((item) => (
                      <div
                        key={item.id}
                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-white/20"
                          style={{ backgroundColor: item.colorHex }}
                        />
                        <span>{item.name}</span>
                        {item.brand && (
                          <span className="text-amber-300 text-[10px]">{item.brand}</span>
                        )}
                        {item.size && (
                          <span className="text-zinc-500 text-[10px]">Gr. {item.size}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveWizardGarment(item.id)}
                          className="text-zinc-500 hover:text-rose-400 cursor-pointer"
                          title="Wieder entfernen"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Sticky Bottom Action Bar (Thumb Zone) */}
        <div className="shrink-0 sticky bottom-0 z-10 px-4 sm:px-6 py-3.5 sm:py-4 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev === 4 ? 3 : prev === 3 ? 2 : 1))}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-700 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer touch-manipulation active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isEn ? 'Back' : 'Zurück'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 min-h-[42px] rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors text-center cursor-pointer touch-manipulation"
            >
              {isEn ? 'Cancel' : 'Abbrechen'}
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() =>
                setStep((prev) => (prev === 1 ? 2 : prev === 2 ? 3 : 4))
              }
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 min-h-[42px] rounded-lg bg-zinc-100 hover:bg-white text-xs font-semibold text-zinc-950 cursor-pointer touch-manipulation active:scale-95"
            >
              <span>
                {step === 3
                  ? isEn
                    ? 'Next: Add Your Own Clothes'
                    : 'Weiter: Eigene Kleidung anlegen'
                  : isEn
                  ? 'Next Step'
                  : 'Weiter'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleFinish(true)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[42px] rounded-lg bg-zinc-900 border border-zinc-700 hover:border-amber-400/60 text-xs font-medium text-zinc-200 cursor-pointer touch-manipulation active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {isEn
                    ? 'Finish & Open Detailed Photo Editor'
                    : 'Speichern & Teil mit Details/Foto'}
                </span>
              </button>

              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleFinish(false)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[42px] rounded-lg bg-amber-400 hover:bg-amber-300 text-xs font-semibold text-zinc-950 cursor-pointer touch-manipulation active:scale-95"
              >
                <UserCheck className="w-4 h-4" />
                <span>
                  {isEn
                    ? 'Finish & Show My Outfits'
                    : 'Fertigstellen & Outfits berechnen'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* AI AGENT PROMPT & JSON IMPORT DIALOG */}
      {showAgentModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="agent-modal-title"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
        >
          <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="shrink-0 px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between gap-3 bg-zinc-900/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="agent-modal-title" className="text-sm font-semibold text-zinc-100">
                    {agentModalTab === 'clothes'
                      ? 'KI-Agent: Kleidung & Accessoires per Foto / Liste'
                      : 'KI-Agent: Farb- & Stil-Analyse per Selfie'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {agentModalTab === 'clothes'
                      ? 'Kleiderschrank fotografieren oder Liste eingeben → Alle Teile auf einmal importieren'
                      : 'Prompt für ChatGPT, Google Gemini oder Claude kopieren und Werte direkt einfügen'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAgentModal(false);
                  setAgentJsonError(null);
                  setAgentJsonSuccess(null);
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 cursor-pointer"
                aria-label="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab Switcher: Biometrics vs Clothes */}
            <div className="shrink-0 px-5 pt-3 pb-2.5 bg-zinc-900/40 border-b border-zinc-800 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAgentModalTab('biometrics');
                  setAgentJsonError(null);
                  setAgentJsonSuccess(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 ${
                  agentModalTab === 'biometrics'
                    ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-sm'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>1. Farb-Biometrie (Selfie)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAgentModalTab('clothes');
                  setAgentJsonError(null);
                  setAgentJsonSuccess(null);
                }}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-2 ${
                  agentModalTab === 'clothes'
                    ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-sm'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Shirt className="w-3.5 h-3.5" />
                <span>2. Kleidung &amp; Accessoires (Garderobe)</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-zinc-300">
              {/* Step A: Copy Prompt */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="font-semibold text-zinc-100 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-400 text-zinc-950 text-[11px] font-bold flex items-center justify-center">
                      1
                    </span>
                    {agentModalTab === 'clothes'
                      ? 'Prompt für deine Kleidung & Accessoires kopieren:'
                      : 'Prompt für deine Selfie-Farbanalyse kopieren:'}
                  </label>
                  <button
                    type="button"
                    onClick={handleCopyAgentPrompt}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      copiedPrompt
                        ? 'bg-emerald-500 text-zinc-950 shadow'
                        : 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                    }`}
                  >
                    {copiedPrompt ? (
                      <>
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Prompt kopiert!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Prompt kopieren</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                  <p>
                    <strong>So einfach geht&apos;s:</strong>
                  </p>
                  <ol className="list-decimal list-inside space-y-0.5 text-zinc-300 pl-1">
                    <li>Klicke oben auf <strong className="text-amber-300">„Prompt kopieren“</strong>.</li>
                    <li>Öffne <strong>ChatGPT</strong>, <strong>Google Gemini</strong> oder <strong>Claude</strong>.</li>
                    {agentModalTab === 'clothes' ? (
                      <>
                        <li>Hänge ein Foto deines Schranks / deiner Kleidung an oder tippe kurz deine Lieblingsteile als Text ein.</li>
                        <li>Sende den Prompt ab. Die KI antwortet mit einem sauberen JSON-Array inkl. Farben, Schnitten &amp; Accessoires (Uhren, Brillen, Schmuck etc.).</li>
                      </>
                    ) : (
                      <>
                        <li>Hänge ein Selfie von dir an (am besten bei Tageslicht ohne Farbfilter).</li>
                        <li>Sende den Prompt ab. Die KI ermittelt Unterton, Kontrast, Haar- &amp; Augenfarbe.</li>
                      </>
                    )}
                  </ol>
                </div>

                {/* Prompt Preview Code Box */}
                <div className="relative">
                  <pre className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 text-[11px] font-mono text-zinc-300 max-h-44 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
                    {agentModalTab === 'clothes' ? CLOTHES_AI_AGENT_PROMPT : AI_AGENT_ANALYSIS_PROMPT}
                  </pre>
                </div>
              </div>

              {/* Step B: Paste & Apply */}
              <div className="space-y-2.5 pt-4 border-t border-zinc-800">
                <label className="font-semibold text-zinc-100 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-400 text-zinc-950 text-[11px] font-bold flex items-center justify-center">
                    2
                  </span>
                  KI-Antwort (JSON) hier einfügen:
                </label>
                <textarea
                  value={agentJsonInput}
                  onChange={(e) => {
                    setAgentJsonInput(e.target.value);
                    if (agentJsonError) setAgentJsonError(null);
                  }}
                  rows={6}
                  placeholder={
                    agentModalTab === 'clothes'
                      ? `[\n  {\n    "name": "Kupferfarbene Chronograph-Uhr",\n    "category": "accessory",\n    "subcategory": "watch",\n    "colorName": "Kupfer",\n    "colorHex": "#8C6244",\n    "brand": "Seiko",\n    "formality": 3\n  },\n  {\n    "name": "Schwarze Wayfarer Sonnenbrille",\n    "category": "accessory",\n    "subcategory": "sunglasses",\n    "colorName": "Schwarz",\n    "colorHex": "#141414"\n  }\n]`
                      : `{\n  "undertone": "warm",\n  "skinHex": "#D4A38B",\n  "hairColorName": "Kupferblond / Goldbraun",\n  "hairHex": "#8C6244",\n  "eyeColorName": "Blau-Grau",\n  "eyeHex": "#526878",\n  "contrastLevel": "medium",\n  "chromaLevel": "moderate",\n  "haircutStyle": "medium_textured_flow",\n  "wardrobeScopes": ["menswear", "unisex"],\n  "styleVibe": "minimal_capsule"\n}`
                  }
                  className="w-full p-3 rounded-xl bg-zinc-900/80 border border-zinc-700/80 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />

                {agentJsonError && (
                  <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                    <span className="font-bold">Fehler:</span>
                    <span>{agentJsonError}</span>
                  </div>
                )}

                {agentJsonSuccess && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                    <CheckCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{agentJsonSuccess}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 px-5 py-3.5 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAgentModal(false);
                  setAgentJsonError(null);
                  setAgentJsonSuccess(null);
                }}
                className="px-3.5 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleApplyAgentJson}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold cursor-pointer transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {agentModalTab === 'clothes'
                    ? 'Kleidung & Accessoires importieren'
                    : 'Werte übernehmen'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
