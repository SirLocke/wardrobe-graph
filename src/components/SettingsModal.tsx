import React, { useEffect, useState } from 'react';
import { Check, Palette, Plus, Ruler, Settings2, Sparkles, Tag, Trash2, X } from 'lucide-react';
import {
  getAllColorPresets,
  loadCustomColors,
  saveCustomColors,
  SMART_SUBCATEGORY_DEFAULTS,
  SUBCATEGORY_LABELS,
  TextileColorPreset,
  WARDROBE_PRESETS,
  WARDROBE_SCOPE_META,
  WardrobePresetKey,
} from '../data/seedData';
import {
  POPULAR_BRANDS,
  removeBrandSizeRule,
  suggestSizeForGarment,
  upsertBrandSizeRule,
} from '../engine/brandSizeMatcher';
import { classifyColorTemp, hexToHsl, scoreGarmentBiometrics } from '../engine/colorMath';
import {
  AppLocale,
  BiometricProfile,
  Garment,
  GarmentSubcategory,
  WardrobeScope,
} from '../types/wardrobe';
import { GarmentVector } from './GarmentVector';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BiometricProfile;
  locale: AppLocale;
  onLocaleChange: (locale: AppLocale) => void;
  onSaveProfile: (profile: BiometricProfile) => Promise<void>;
  onLoadPreset: (presetKey: WardrobePresetKey) => Promise<void>;
  onQuickAddGarment: (garment: Garment) => Promise<void>;
}

const QUICK_ADD_ITEMS_BY_SCOPE: Record<WardrobeScope, GarmentSubcategory[]> = {
  womenswear: [
    'hoodie',
    't_shirt',
    'blouse',
    'blazer',
    'knit_sweater',
    'trenchcoat',
    'denim',
    'wide_leg_trousers',
    'midi_skirt',
    'sneaker_clean',
    'heeled_ankle_boot',
    'ballet_flat',
  ],
  menswear: [
    'hoodie',
    'heavyweight_tee',
    't_shirt',
    'overshirt',
    'button_down_shirt',
    'knit_sweater',
    'blazer',
    'parka',
    'chino',
    'denim',
    'sneaker_clean',
    'boots',
  ],
  unisex: [
    'hoodie',
    'heavyweight_tee',
    't_shirt',
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
    'hoodie',
    't_shirt',
    'blouse',
    'blazer',
    'overshirt',
    'knit_sweater',
    'trenchcoat',
    'denim',
    'wide_leg_trousers',
    'midi_skirt',
    'sneaker_clean',
    'heeled_ankle_boot',
  ],
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  locale,
  onLocaleChange,
  onSaveProfile,
  onLoadPreset,
  onQuickAddGarment,
}) => {
  const isEn = locale === 'en';
  const activeScope: WardrobeScope = profile.wardrobeScope || 'all';

  const [customColors, setCustomColors] = useState<TextileColorPreset[]>(() => loadCustomColors());
  const [allColors, setAllColors] = useState<TextileColorPreset[]>(() => getAllColorPresets());
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#6B8E78');

  // Standard sizes & brand-specific size rule states
  const [defaultTopSize, setDefaultTopSize] = useState(profile.defaultSizes?.top || 'M');
  const [defaultBottomSize, setDefaultBottomSize] = useState(profile.defaultSizes?.bottom || 'M');
  const [defaultShoeSize, setDefaultShoeSize] = useState(profile.defaultSizes?.shoes || '42');
  const [ruleBrandInput, setRuleBrandInput] = useState('Nike');
  const [ruleSizeInput, setRuleSizeInput] = useState('L');

  // Selected color & optional brand for 1-click quick add
  const [quickColor, setQuickColor] = useState<TextileColorPreset>(() => getAllColorPresets()[0]);
  const [quickBrand, setQuickBrand] = useState<string>('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const loaded = loadCustomColors();
    setCustomColors(loaded);
    const all = getAllColorPresets();
    setAllColors(all);
    setQuickColor(all[0]);
    setDefaultTopSize(profile.defaultSizes?.top || 'M');
    setDefaultBottomSize(profile.defaultSizes?.bottom || 'M');
    setDefaultShoeSize(profile.defaultSizes?.shoes || '42');
    setFeedbackToast(null);
  }, [isOpen, profile.defaultSizes]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    window.setTimeout(() => {
      setFeedbackToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const handleScopeChange = async (newScope: WardrobeScope, alsoLoadStarter: boolean) => {
    await onSaveProfile({
      ...profile,
      wardrobeScope: newScope,
    });
    if (alsoLoadStarter) {
      const presetKey = WARDROBE_SCOPE_META[newScope].defaultPreset;
      await onLoadPreset(presetKey);
      showToast(
        isEn
          ? `Switched to "${WARDROBE_SCOPE_META[newScope].shortEn}" and loaded starter wardrobe!`
          : `Auf „${WARDROBE_SCOPE_META[newScope].shortDe}“ umgestellt & passende Garderobe geladen!`
      );
    } else {
      showToast(
        isEn
          ? `Style filter set to "${WARDROBE_SCOPE_META[newScope].shortEn}".`
          : `Kleidungs-Ausrichtung auf „${WARDROBE_SCOPE_META[newScope].shortDe}“ gesetzt.`
      );
    }
  };

  const handleSaveDefaultSizes = async (nextTop: string, nextBottom: string, nextShoes: string) => {
    setDefaultTopSize(nextTop);
    setDefaultBottomSize(nextBottom);
    setDefaultShoeSize(nextShoes);
    await onSaveProfile({
      ...profile,
      defaultSizes: {
        top: nextTop.trim() || undefined,
        bottom: nextBottom.trim() || undefined,
        shoes: nextShoes.trim() || undefined,
      },
    });
    showToast(isEn ? 'Standard sizes saved!' : 'Standard-Größen gespeichert!');
  };

  const handleAddBrandSizeRule = async () => {
    const cleanBrand = ruleBrandInput.trim();
    const cleanSize = ruleSizeInput.trim();
    if (!cleanBrand || !cleanSize) return;

    const nextRules = upsertBrandSizeRule(profile.brandSizeRules, {
      brand: cleanBrand,
      size: cleanSize,
      categoryGroup: 'all',
    });

    await onSaveProfile({
      ...profile,
      brandSizeRules: nextRules,
    });

    showToast(
      isEn
        ? `Saved rule: Always size "${cleanSize}" for ${cleanBrand}!`
        : `Gespeichert: „Bei ${cleanBrand} habe ich immer Größe ${cleanSize}“!`
    );
  };

  const handleDeleteBrandSizeRule = async (brand: string) => {
    const nextRules = removeBrandSizeRule(profile.brandSizeRules, brand, 'all');
    await onSaveProfile({
      ...profile,
      brandSizeRules: nextRules,
    });
  };

  const handleCreateCustomColor = () => {
    const trimmed = newColorName.trim() || (isEn ? 'My Custom Color' : 'Meine Wunschfarbe');
    const entry: TextileColorPreset = {
      name: trimmed,
      hex: newColorHex.toUpperCase(),
      group: 'Accent',
    };
    const nextCustom = [entry, ...customColors.filter((c) => c.name !== trimmed)];
    saveCustomColors(nextCustom);
    setCustomColors(nextCustom);
    const updatedAll = getAllColorPresets();
    setAllColors(updatedAll);
    setQuickColor(entry);
    setNewColorName('');
    showToast(
      isEn
        ? `Color "${trimmed}" saved and selected!`
        : `Farbe „${trimmed}“ gespeichert & ausgewählt!`
    );
  };

  const handleDeleteCustomColor = (nameToRemove: string) => {
    const nextCustom = customColors.filter((c) => c.name !== nameToRemove);
    saveCustomColors(nextCustom);
    setCustomColors(nextCustom);
    setAllColors(getAllColorPresets());
  };

  const handleInstantAdd = async (subcategory: GarmentSubcategory) => {
    const defaults = SMART_SUBCATEGORY_DEFAULTS[subcategory];
    const hsl = hexToHsl(quickColor.hex);
    const colorTemp = classifyColorTemp(hsl);
    const cleanSubLabel = SUBCATEGORY_LABELS[subcategory].split(' (')[0];
    const cleanColor = quickColor.name.replace(' (Test)', '');
    const sizeSuggestion = suggestSizeForGarment(defaults.category, quickBrand, profile);

    const garment: Garment = {
      id: `quick_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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
      size: sizeSuggestion.suggestedSize || undefined,
    };

    await onQuickAddGarment(garment);
    const brandNote = garment.brand ? ` (${garment.brand}${garment.size ? `, Gr. ${garment.size}` : ''})` : garment.size ? ` (Gr. ${garment.size})` : '';
    showToast(
      isEn
        ? `Added "${garment.name}"${brandNote} to your closet!`
        : `„${garment.name}“${brandNote} wurde deinem Schrank hinzugefügt!`
    );
  };

  // Preview how the new color harmonizes with user's skin undertone
  const customColorPreviewBio = scoreGarmentBiometrics(
    {
      category: 'mid_layer',
      colorName: newColorName || 'Wunschfarbe',
      colorHex: newColorHex,
      hsl: hexToHsl(newColorHex),
      colorTemp: classifyColorTemp(hexToHsl(newColorHex)),
      neckline: 'crewneck',
      texture: 'smooth_cotton',
    },
    profile
  );

  const quickItems = QUICK_ADD_ITEMS_BY_SCOPE[activeScope];
  const savedBrandRules = profile.brandSizeRules || [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto sm:overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full h-full sm:h-auto sm:max-h-[90vh] max-w-3xl rounded-none sm:rounded-2xl bg-zinc-950 border-0 sm:border sm:border-zinc-800 shadow-2xl my-0 sm:my-8 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="shrink-0 sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-800/80 bg-zinc-950/95 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-sm sm:text-base font-semibold text-zinc-100">
                {isEn
                  ? 'Settings & Quick Closet Builder'
                  : 'Einstellungen & Schnell-Baukasten'}
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400">
                {isEn
                  ? 'Scope, brand sizes ("Nike = L") & add clothes'
                  : 'Bereich, Marken-Größen & Kleidung per Klick anlegen'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? 'Close settings' : 'Einstellungen schließen'}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors touch-manipulation cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {feedbackToast && (
          <div className="mx-4 sm:mx-6 mt-3 px-4 py-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between shrink-0">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              {feedbackToast}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-7">
          {/* SECTION 1: Frauen / Männer / Unisex / Beides */}
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                {isEn
                  ? '1. Who are we putting outfits together for?'
                  : '1. Für wen stellen wir Outfits zusammen?'}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isEn
                  ? 'Tap a box to choose which clothing types are suggested (Women automatically includes cozy Hoodies, T-Shirts, Jeans & Sneakers).'
                  : 'Tippe einfach auf ein Feld, um festzulegen, welche Kleidungsstücke vorgeschlagen werden (bei „Frauen“ sind selbstverständlich auch Hoodies, T-Shirts, Pullover, Jeans & Sneaker dabei).'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(['womenswear', 'menswear', 'unisex', 'all'] as WardrobeScope[]).map((scopeKey) => {
                const meta = WARDROBE_SCOPE_META[scopeKey];
                const isSelected = activeScope === scopeKey;
                return (
                  <button
                    key={scopeKey}
                    type="button"
                    onClick={() => handleScopeChange(scopeKey, false)}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 ring-1 ring-amber-400/30'
                        : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="text-sm font-semibold text-zinc-100">
                        {isEn ? meta.labelEn : meta.labelDe}
                      </span>
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-400 text-zinc-950 text-[11px] font-semibold shrink-0">
                          <Check className="w-3 h-3" />
                          {isEn ? 'Selected' : 'Ausgewählt'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-500 shrink-0">
                          {isEn ? 'Tap to select' : 'Antippen zum Wählen'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {isEn ? meta.descEn : meta.descDe}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Separate, unmistakable box to optionally fill closet with normal example clothes */}
            <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-zinc-200">
                  {isEn
                    ? 'Want to test with normal everyday example clothes?'
                    : 'Möchtest du direkt mit typischen Alltags-Kleidungsstücken testen?'}
                </p>
                <p className="text-[11px] text-zinc-400">
                  {isEn
                    ? WARDROBE_PRESETS[WARDROBE_SCOPE_META[activeScope].defaultPreset].descriptionEn
                    : WARDROBE_PRESETS[WARDROBE_SCOPE_META[activeScope].defaultPreset].descriptionDe}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleScopeChange(activeScope, true)}
                className="px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-colors shrink-0 cursor-pointer whitespace-nowrap"
              >
                {isEn
                  ? `Load ${WARDROBE_PRESETS[WARDROBE_SCOPE_META[activeScope].defaultPreset].garments.length} example items (${WARDROBE_SCOPE_META[activeScope].shortEn})`
                  : `Beispiel-Kleidung für „${WARDROBE_SCOPE_META[activeScope].shortDe}“ laden (${WARDROBE_PRESETS[WARDROBE_SCOPE_META[activeScope].defaultPreset].garments.length} Teile)`}
              </button>
            </div>
          </section>

          {/* SECTION 2: Größen & Marken-Größen ("Bei Nike habe ich immer Größe X") */}
          <section className="space-y-3.5 pt-4 border-t border-zinc-800/80">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-amber-400" />
                {isEn
                  ? '2. My Sizes & Brand Size Memory ("For Nike I always wear L")'
                  : '2. Meine Größen & Marken-Größen („Bei Nike habe ich immer Größe …“)'}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isEn
                  ? 'Optional: Save your usual sizes and brand-specific sizes so the app automatically suggests the right size when adding clothes.'
                  : 'Optional: Hinterlege deine normalen Größen oder Marken-Größen – beim Anlegen neuer Kleidung wird die passende Größe automatisch vorgeschlagen.'}
              </p>
            </div>

            {/* Standard Sizes Row */}
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-3">
              <p className="text-xs font-medium text-zinc-300">
                {isEn ? 'Your usual standard sizes (optional):' : 'Deine normalen Standard-Größen (optional):'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    {isEn ? 'Tops / Jackets (e.g. S, M, L, 38)' : 'Oberteile & Jacken (z.B. S, M, L, 38)'}
                  </label>
                  <input
                    type="text"
                    value={defaultTopSize}
                    onChange={(e) =>
                      handleSaveDefaultSizes(e.target.value, defaultBottomSize, defaultShoeSize)
                    }
                    placeholder="z.B. M oder 38"
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    {isEn ? 'Trousers / Jeans (e.g. M, 38, W32)' : 'Hosen & Röcke (z.B. M, 38, W32/L32)'}
                  </label>
                  <input
                    type="text"
                    value={defaultBottomSize}
                    onChange={(e) =>
                      handleSaveDefaultSizes(defaultTopSize, e.target.value, defaultShoeSize)
                    }
                    placeholder="z.B. M, 38 oder W32"
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    {isEn ? 'Shoes (e.g. 39, 42, 43)' : 'Schuhe (z.B. 39, 41, 42, 44)'}
                  </label>
                  <input
                    type="text"
                    value={defaultShoeSize}
                    onChange={(e) =>
                      handleSaveDefaultSizes(defaultTopSize, defaultBottomSize, e.target.value)
                    }
                    placeholder="z.B. 39 oder 42"
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Brand-specific size memory */}
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-zinc-200 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  {isEn
                    ? 'Brand-Specific Size Rules ("For Nike I always wear size X"):'
                    : 'Marken-Größen merken (z.B. „Bei Nike habe ich immer Größe L“):'}
                </p>
              </div>

              {/* Popular brand quick buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {POPULAR_BRANDS.slice(0, 10).map((b) => {
                  const isSelected = ruleBrandInput.toLowerCase() === b.toLowerCase();
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setRuleBrandInput(b)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-400 text-amber-200'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs text-zinc-400 whitespace-nowrap">
                    {isEn ? 'For brand' : 'Bei Marke'}
                  </span>
                  <input
                    type="text"
                    value={ruleBrandInput}
                    onChange={(e) => setRuleBrandInput(e.target.value)}
                    placeholder="z.B. Nike, Adidas, Zara..."
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-2 sm:w-48">
                  <span className="text-xs text-zinc-400 whitespace-nowrap">
                    {isEn ? 'always size' : 'immer Größe'}
                  </span>
                  <input
                    type="text"
                    value={ruleSizeInput}
                    onChange={(e) => setRuleSizeInput(e.target.value)}
                    placeholder="z.B. L, M, 42, W32..."
                    className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddBrandSizeRule}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isEn ? 'Save Brand Size' : 'Marken-Größe merken'}
                </button>
              </div>

              {savedBrandRules.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/70 space-y-1.5">
                  <p className="text-[11px] text-zinc-400">
                    {isEn ? 'Saved brand sizes (auto-suggested when adding clothes):' : 'Gespeicherte Marken-Größen (werden beim Anlegen automatisch vorgeschlagen):'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {savedBrandRules.map((rule) => (
                      <div
                        key={`${rule.brand}_${rule.categoryGroup || 'all'}`}
                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
                      >
                        <span className="font-semibold text-amber-300">{rule.brand}</span>
                        <span className="text-zinc-500">→</span>
                        <span>Gr. {rule.size}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteBrandSizeRule(rule.brand)}
                          className="text-zinc-500 hover:text-rose-400 cursor-pointer"
                          title={isEn ? 'Remove brand size' : 'Marken-Größe löschen'}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* SECTION 3: 1-Klick Schnell-Baukasten (Kleidung sofort anlegen) */}
          <section className="space-y-3 pt-4 border-t border-zinc-800/80">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  {isEn
                    ? '3. Add Clothes with 1 Click'
                    : '3. Eigene Kleidungsstücke mit 1 Klick hinzufügen'}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {isEn
                    ? 'Pick a color (and optional brand), then tap any garment icon to add it with your matching size.'
                    : 'Wähle Farbe (und optional eine Marke) und tippe auf ein Kleidungsstück, um es inklusive passender Größe sofort anzulegen.'}
                </p>
              </div>
            </div>

            {/* Color & Optional Brand selector bar for Quick-Add */}
            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-3">
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-zinc-300">
                  {isEn ? 'Selected color for Quick-Add:' : 'Gewählte Farbe für Schnell-Anlegen:'}{' '}
                  <span className="text-amber-400 font-semibold">
                    {quickColor.name.replace(' (Test)', '')}
                  </span>
                </div>
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
                  {isEn ? 'Optional brand tag:' : 'Optional Marke vergeben:'}
                </span>
                <button
                  type="button"
                  onClick={() => setQuickBrand('')}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer ${
                    quickBrand === ''
                      ? 'bg-zinc-100 text-zinc-950 border-zinc-100 font-semibold'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {isEn ? 'No brand' : 'Ohne Marke'}
                </button>
                {['Nike', 'Adidas', "Levi's", 'Zara', 'H&M', 'Uniqlo', 'COS', 'Carhartt'].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setQuickBrand(b)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium cursor-pointer ${
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

            {/* 1-Click Garment Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {quickItems.map((sub) => {
                const cleanLabel = SUBCATEGORY_LABELS[sub].split(' (')[0];
                const defaults = SMART_SUBCATEGORY_DEFAULTS[sub];
                const autoSize = suggestSizeForGarment(defaults.category, quickBrand, profile).suggestedSize;
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => handleInstantAdd(sub)}
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
          </section>

          {/* SECTION 4: Eigene Farben einfach anlegen */}
          <section className="space-y-3 pt-4 border-t border-zinc-800/80">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-400" />
                {isEn
                  ? '4. Create Your Own Colors (No Hex Codes Needed)'
                  : '4. Eigene Lieblingsfarben anlegen (ohne Hex-Codes)'}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                {isEn
                  ? 'Tap the color circle, type a name (e.g. "Ice Blue" or "Soft Rose"), and save it for all garments.'
                  : 'Tippe einfach auf den Farbkreis, gib deiner Farbe einen Namen (z.B. „Eisblau“, „Altrosa“, „Senfgelb“) und speichere sie.'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <label className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer shrink-0">
                  <input
                    type="color"
                    value={newColorHex}
                    onChange={(e) => setNewColorHex(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <span className="text-xs font-medium text-zinc-200">
                    {isEn ? 'Pick color visually' : 'Farbe im Farbrad wählen'}
                  </span>
                </label>

                <input
                  type="text"
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                  placeholder={
                    isEn
                      ? 'Color name (e.g. Ice Blue, Dusty Rose...)'
                      : 'Name der Farbe (z.B. Eisblau, Altrosa, Tannengrün...)'
                  }
                  className="flex-1 px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />

                <button
                  type="button"
                  onClick={handleCreateCustomColor}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {isEn ? 'Save Color' : 'Farbe anlegen'}
                </button>
              </div>

              <div className="text-xs text-zinc-400 flex items-center justify-between">
                <span>{customColorPreviewBio.reasons?.[0] || ''}</span>
                <span className="font-medium text-zinc-300">
                  {isEn ? 'Match with your skin tone:' : 'Passung zu deinem Typ:'}{' '}
                  {customColorPreviewBio.score}%
                </span>
              </div>

              {customColors.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
                  <p className="text-[11px] font-medium text-zinc-400">
                    {isEn ? 'Your saved custom colors:' : 'Deine eigenen gespeicherten Farben:'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {customColors.map((cc) => (
                      <div
                        key={cc.name}
                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/20"
                          style={{ backgroundColor: cc.hex }}
                        />
                        <span>{cc.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomColor(cc.name)}
                          className="text-zinc-500 hover:text-rose-400"
                          title={isEn ? 'Remove color' : 'Farbe löschen'}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* SECTION 5: Sprache */}
          <section className="flex items-center justify-between pt-4 border-t border-zinc-800/80">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                {isEn ? '5. App Language' : '5. Sprache der App'}
              </h3>
              <p className="text-xs text-zinc-400">
                {isEn ? 'Switch between German and English' : 'Zwischen Deutsch und Englisch wechseln'}
              </p>
            </div>
            <div className="inline-flex rounded-xl bg-zinc-900 border border-zinc-800 p-1">
              <button
                type="button"
                onClick={() => onLocaleChange('de')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  locale === 'de' ? 'bg-zinc-100 text-zinc-950 font-semibold' : 'text-zinc-400'
                }`}
              >
                Deutsch
              </button>
              <button
                type="button"
                onClick={() => onLocaleChange('en')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  locale === 'en' ? 'bg-zinc-100 text-zinc-950 font-semibold' : 'text-zinc-400'
                }`}
              >
                English
              </button>
            </div>
          </section>
        </div>

        {/* Sticky bottom action bar (Thumb Zone) */}
        <div className="shrink-0 sticky bottom-0 z-10 px-4 sm:px-6 py-3.5 sm:py-4 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 flex items-center justify-end pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 min-h-[42px] rounded-lg bg-zinc-100 text-zinc-950 text-xs font-semibold hover:bg-white transition-colors cursor-pointer touch-manipulation active:scale-95"
          >
            {isEn ? 'Done' : 'Fertig'}
          </button>
        </div>
      </div>
    </div>
  );
};
