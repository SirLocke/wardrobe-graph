import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
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
  getAllColorPresets,
  SMART_SUBCATEGORY_DEFAULTS,
  STYLE_VIBE_META,
  SUBCATEGORY_LABELS,
  TextileColorPreset,
  WARDROBE_PRESETS,
  WARDROBE_SCOPE_META,
  WardrobePresetKey,
} from '../data/seedData';
import { suggestSizeForGarment } from '../engine/brandSizeMatcher';
import { classifyColorTemp, deriveSeasonPalette, hexToHsl } from '../engine/colorMath';
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

const WIZARD_QUICK_ITEMS_BY_SCOPE: Record<WardrobeScope, GarmentSubcategory[]> = {
  womenswear: [
    't_shirt',
    'hoodie',
    'blouse',
    'knit_sweater',
    'cardigan',
    'blazer',
    'trenchcoat',
    'denim',
    'wide_leg_trousers',
    'midi_skirt',
    'sneaker_clean',
    'heeled_ankle_boot',
  ],
  menswear: [
    't_shirt',
    'heavyweight_tee',
    'hoodie',
    'crewneck_sweater',
    'knit_sweater',
    'button_down_shirt',
    'overshirt',
    'blazer',
    'denim',
    'chino',
    'sneaker_clean',
    'boots',
  ],
  unisex: [
    't_shirt',
    'heavyweight_tee',
    'hoodie',
    'crewneck_sweater',
    'knit_sweater',
    'overshirt',
    'trenchcoat',
    'puffer_jacket',
    'denim',
    'wide_leg_trousers',
    'sneaker_clean',
    'boots',
  ],
  all: [
    't_shirt',
    'hoodie',
    'blouse',
    'knit_sweater',
    'cardigan',
    'blazer',
    'overshirt',
    'trenchcoat',
    'denim',
    'wide_leg_trousers',
    'sneaker_clean',
    'heeled_ankle_boot',
  ],
};

const SKIN_PRESETS: {
  undertone: Undertone;
  skinHex: string;
  labelDe: string;
  labelEn: string;
  descDe: string;
  descEn: string;
  jewelryHintDe: string;
}[] = [
  {
    undertone: 'olive',
    skinHex: '#C8A98E',
    labelDe: 'Leicht gebräunt / Oliv (Warm-Neutral)',
    labelEn: 'Olive / Light Tan (Warm-Neutral)',
    descDe: 'Du wirst im Sommer schnell braun. Dir stehen Naturtöne wie Olivgrün, Salbei, Beige & Braun besonders gut.',
    descEn: 'You tan easily. Earth tones like olive, sage, beige & brown suit you best.',
    jewelryHintDe: 'Gold- & Kupferschmuck sehen meistens sehr harmonisch aus',
  },
  {
    undertone: 'warm',
    skinHex: '#D6AC88',
    labelDe: 'Warm / Goldig',
    labelEn: 'Warm / Golden',
    descDe: 'Warmer Teint (oft mit warmbraunen, goldblonden oder rötlichen Haaren). Creme, Kamel & warme Töne lassen dich strahlen.',
    descEn: 'Warm complexion. Cream, camel & warm tones make you glow.',
    jewelryHintDe: 'Goldschmuck steht dir deutlich besser als kühles Silber',
  },
  {
    undertone: 'cool',
    skinHex: '#DFC2B8',
    labelDe: 'Kühl / Hell & Rosig',
    labelEn: 'Cool / Fair & Rosy',
    descDe: 'Eher helle oder rosige Haut. Dir stehen klare, kühle Farben wie Dunkelblau, Grau, Schwarz, Weiß & Weinrot.',
    descEn: 'Fair or rosy skin. Navy, grey, black, crisp white & burgundy suit you best.',
    jewelryHintDe: 'Silberschmuck oder Weißgold steht dir besonders gut',
  },
  {
    undertone: 'neutral',
    skinHex: '#C9A892',
    labelDe: 'Ausgewogen Neutral („Mir steht beides“)',
    labelEn: 'Balanced Neutral ("Both suit me")',
    descDe: 'Weder stark warm noch stark kühl. Du kannst sowohl Dunkelblau & Grau als auch Beige & Olivgrün super tragen.',
    descEn: 'Balanced skin tone. Both cool classics and warm earth tones work well.',
    jewelryHintDe: 'Dir stehen sowohl Gold- als auch Silberschmuck gut',
  },
];

const EYE_PRESETS = [
  { name: 'Grün-Braun / Haselnuss', hex: '#6E7D4E' },
  { name: 'Dunkelbraun', hex: '#4A3525' },
  { name: 'Blau / Blaugrau', hex: '#5B7C99' },
  { name: 'Grün / Graugrün', hex: '#6B7B6E' },
  { name: 'Hellbraun / Bernstein', hex: '#8B6528' },
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

  const [selectedStartMode, setSelectedStartMode] = useState<WizardStartMode>('own_empty');
  const [draftProfile, setDraftProfile] = useState<BiometricProfile>(currentProfile);
  const [selectedVibe, setSelectedVibe] = useState<StyleVibe>(
    currentStyleVibe === 'balanced' ? 'minimal_capsule' : currentStyleVibe
  );

  // Step 4: Quick-Add own clothes right inside the wizard
  const [allColors, setAllColors] = useState<TextileColorPreset[]>(() => getAllColorPresets());
  const [quickColor, setQuickColor] = useState<TextileColorPreset>(() => getAllColorPresets()[0]);
  const [quickBrand, setQuickBrand] = useState<string>('');
  const [wizardAddedGarments, setWizardAddedGarments] = useState<Garment[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setDraftProfile(currentProfile);
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

  if (!isOpen) return null;

  const activeScope: WardrobeScope = draftProfile.wardrobeScope || 'all';
  const quickItems = WIZARD_QUICK_ITEMS_BY_SCOPE[activeScope];

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
        // A preset was chosen
        const presetGarments = WARDROBE_PRESETS[selectedStartMode].garments;
        garmentsToLoad = [...wizardAddedGarments, ...presetGarments];
        isDemo = wizardAddedGarments.length === 0;
      }

      const updatedScope =
        selectedStartMode !== 'own_empty' && selectedStartMode !== 'keep_current'
          ? WARDROBE_PRESETS[selectedStartMode].scope
          : draftProfile.wardrobeScope || 'all';

      await onCompleteSetup({
        profile: {
          ...draftProfile,
          wardrobeScope: updatedScope,
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

                  {/* Option 3: Or pick an example preset */}
                  <div className="pt-2">
                    <p className="text-[11px] font-medium text-zinc-400 mb-2">
                      {isEn
                        ? 'Or load an example wardrobe for testing:'
                        : 'Oder eine Beispiel-Garderobe zum Ausprobieren laden:'}
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
                            onClick={() => {
                              setSelectedStartMode(presetKey);
                              setDraftProfile((prev) => ({
                                ...prev,
                                wardrobeScope: preset.scope,
                              }));
                            }}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/15 border-amber-400 text-zinc-100'
                                : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                            }`}
                          >
                            <p className="text-xs font-semibold text-zinc-200">
                              {isEn ? preset.labelEn : preset.labelDe}
                            </p>
                            <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                              {isEn ? preset.descriptionEn : preset.descriptionDe}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* 1B: Für wen? (Frauen / Männer / Unisex / Beides) */}
              <div className="space-y-2.5 pt-4 border-t border-zinc-800/80">
                <label className="block text-xs font-semibold text-zinc-100">
                  {isEn
                    ? '2. Which clothing selection should we show you?'
                    : '2. Welche Kleidungsstücke möchtest du nutzen? (Bei „Frauen“ sind auch Hoodies, Shirts & Sneaker dabei)'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['womenswear', 'menswear', 'unisex', 'all'] as WardrobeScope[]).map((sc) => {
                    const active = (draftProfile.wardrobeScope || 'all') === sc;
                    const meta = WARDROBE_SCOPE_META[sc];
                    return (
                      <button
                        key={sc}
                        type="button"
                        onClick={() =>
                          setDraftProfile({ ...draftProfile, wardrobeScope: sc })
                        }
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-500/15 border-amber-400 text-zinc-100 font-semibold'
                            : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <p className="text-xs font-semibold text-zinc-100">
                          {isEn ? meta.shortEn : meta.shortDe}
                        </p>
                      </button>
                    );
                  })}
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
              {/* Top helper banner for people who don't know their color type */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-amber-200 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    Keine Ahnung von Farbtypen? Kein Problem!
                  </p>
                  <p className="text-[11px] text-zinc-300">
                    Beantworte die 5 kurzen Alltags-Fragen nach Bauchgefühl – oder klicke rechts auf „Neutral-Standard“, wenn du dir unsicher bist.
                  </p>
                </div>
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
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-amber-400/50 text-xs font-medium text-amber-200 hover:bg-zinc-800 shrink-0 cursor-pointer whitespace-nowrap"
                >
                  Unsicher? „Neutral“ wählen
                </button>
              </div>

              {/* 1. Skin Undertone explained with Jewelry & Sun test */}
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-zinc-100">
                    1. Dein Hautton – Welcher Schmuck &amp; welche Farben lassen dich frisch aussehen?
                  </label>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Alltags-Test: Schau, ob dir an dir selbst eher Goldschmuck (warm) oder Silberschmuck (kühl) gefällt – oder beides gleich gut (neutral).
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {SKIN_PRESETS.map((sp) => {
                    const active = draftProfile.undertone === sp.undertone;
                    return (
                      <button
                        key={sp.undertone}
                        type="button"
                        onClick={() =>
                          setDraftProfile({
                            ...draftProfile,
                            undertone: sp.undertone,
                            skinHex: sp.skinHex,
                          })
                        }
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
                          <p className="text-[11px] text-amber-300/90 font-medium">
                            {sp.jewelryHintDe}
                          </p>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            {isEn ? sp.descEn : sp.descDe}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Contrast & 3. Chroma with plain explanations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-2.5">
                  <div>
                    <span className="block text-xs font-semibold text-zinc-100">
                      2. Unterschied zwischen Haarfarbe &amp; Haut
                    </span>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Bestimmt, ob dir eher sanfte Ton-in-Ton-Outfits oder starke Hell-Dunkel-Kontraste (z. B. weißes Shirt + dunkle Jacke) stehen.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {(
                      [
                        {
                          id: 'low',
                          label: 'Sanft / Ähnlich (z. B. helle Haut & blonde/hellbraune Haare)',
                        },
                        {
                          id: 'medium',
                          label: 'Mittel / Normal (z. B. mittlere Haut & braune/dunkelblonde Haare)',
                        },
                        {
                          id: 'high',
                          label: 'Stark (z. B. sehr dunkle/schwarze Haare & helle Haut)',
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
                      3. Welche Farben magst du lieber an dir?
                    </span>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Manchen stehen ruhige, unaufdringliche Töne besser, anderen kräftige, leuchtende Farben.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {(
                      [
                        {
                          id: 'muted',
                          label: 'Ruhige, sanfte Töne (Salbei, Beige, Dunkelblau, Grau – nichts Grelles)',
                        },
                        {
                          id: 'moderate',
                          label: 'Normale Alltagsfarben (weder verwaschen noch knallig)',
                        },
                        {
                          id: 'bright',
                          label: 'Kräftige, klare Farben (Reines Weiß, Tiefschwarz, leuchtendes Rot/Blau)',
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

              {/* 4. Eye Color Presets */}
              <div className="space-y-2">
                <div>
                  <span className="block text-xs font-semibold text-zinc-100">
                    4. Deine Augenfarbe (Warum fragen wir das?)
                  </span>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Kleiner Styling-Trick: Wenn ein Pullover oder Shirt deine Augenfarbe leicht aufgreift (z. B. Olivgrün bei grün-braunen Augen oder Blaugrau bei blauen Augen), wirken deine Augen sofort wacher.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {EYE_PRESETS.map((eye) => {
                    const active =
                      draftProfile.eyeHex.toLowerCase() === eye.hex.toLowerCase();
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
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${
                          active
                            ? 'bg-amber-500/15 border-amber-400 text-zinc-100 font-semibold'
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
                      ? '4. Click Together Your Own Clothes (1-Click Builder)'
                      : '4. Klicke jetzt direkt deine eigenen Kleidungsstücke zusammen'}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {isEn
                      ? '1. Tap a color (and optional brand) · 2. Tap a garment to add it to your closet. Add at least 1 top, 1 bottom & 1 pair of shoes!'
                      : '1. Farbe (und optional Marke) wählen · 2. Kleidungsstück antippen. Tipp: Lege mindestens 1 Oberteil, 1 Hose/Rock und 1 Paar Schuhe an!'}
                  </p>
                </div>
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

              {/* 1-Click Garment Grid */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-zinc-300">
                  2. Tippe auf ein Kleidungsstück, um es in deinen Schrank zu legen:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {quickItems.map((sub) => {
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
    </div>
  );
};
