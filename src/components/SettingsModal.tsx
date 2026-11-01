import React, { useEffect, useState } from 'react';
import { Check, Palette, Plus, Settings2, Sparkles, Trash2, X } from 'lucide-react';
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

  // Selected color for 1-click quick add
  const [quickColor, setQuickColor] = useState<TextileColorPreset>(() => getAllColorPresets()[0]);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const loaded = loadCustomColors();
    setCustomColors(loaded);
    const all = getAllColorPresets();
    setAllColors(all);
    setQuickColor(all[0]);
    setFeedbackToast(null);
  }, [isOpen]);

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
    };

    await onQuickAddGarment(garment);
    showToast(
      isEn
        ? `Added "${garment.name}" to your closet!`
        : `„${garment.name}“ wurde deinem Schrank hinzugefügt!`
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-base font-semibold text-zinc-100">
                {isEn
                  ? 'Settings, Style Focus & Quick Closet Builder'
                  : 'Einstellungen, Kleidungs-Wahl & Schnell-Baukasten'}
              </h2>
              <p className="text-xs text-zinc-400">
                {isEn
                  ? 'Choose Women / Men / Unisex / Both, create custom colors & add clothes with 1 click'
                  : 'Wähle Frauen / Männer / Unisex / Beides, lege eigene Farben an & füge Kleidung mit 1 Klick hinzu'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? 'Close settings' : 'Einstellungen schließen'}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {feedbackToast && (
          <div className="mx-6 mt-4 px-4 py-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              {feedbackToast}
            </span>
          </div>
        )}

        <div className="p-6 space-y-7 max-h-[78vh] overflow-y-auto">
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

          {/* SECTION 2: 1-Klick Schnell-Baukasten (Kleidung sofort anlegen) */}
          <section className="space-y-3 pt-4 border-t border-zinc-800/80">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  {isEn
                    ? '2. Add Clothes with 1 Click'
                    : '2. Eigene Kleidungsstücke mit 1 Klick hinzufügen'}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {isEn
                    ? 'Pick a color below, then tap any garment icon to add it to your closet immediately.'
                    : 'Wähle erst eine Farbe aus und tippe dann einfach auf ein Kleidungsstück, um es sofort anzulegen.'}
                </p>
              </div>
            </div>

            {/* Color selector bar for Quick-Add */}
            <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-2">
              <div className="text-xs font-medium text-zinc-300">
                {isEn ? 'Selected color for Quick-Add:' : 'Gewählte Farbe für Schnell-Anlegen:'}{' '}
                <span className="text-amber-400 font-semibold">
                  {quickColor.name.replace(' (Test)', '')}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allColors.slice(0, 16).map((c) => {
                  const active = c.hex.toUpperCase() === quickColor.hex.toUpperCase();
                  return (
                    <button
                      key={`${c.name}_${c.hex}`}
                      type="button"
                      onClick={() => setQuickColor(c)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
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

            {/* 1-Click Garment Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {quickItems.map((sub) => {
                const cleanLabel = SUBCATEGORY_LABELS[sub].split(' (')[0];
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => handleInstantAdd(sub)}
                    className="group flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-amber-500/50 hover:bg-zinc-900 transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-center shrink-0">
                      <GarmentVector
                        type={sub}
                        colorHex={quickColor.hex}
                        texture={SMART_SUBCATEGORY_DEFAULTS[sub].texture}
                        className="w-8 h-8"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-zinc-200 group-hover:text-amber-300 truncate">
                        + {cleanLabel}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {quickColor.name.replace(' (Test)', '')}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* SECTION 3: Eigene Farben einfach anlegen */}
          <section className="space-y-3 pt-4 border-t border-zinc-800/80">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-400" />
                {isEn
                  ? '3. Create Your Own Colors (No Hex Codes Needed)'
                  : '3. Eigene Lieblingsfarben anlegen (ohne Hex-Codes)'}
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
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {isEn ? 'Save Color' : 'Farbe anlegen'}
                </button>
              </div>

              <div className="text-xs text-zinc-400 flex items-center justify-between">
                <span>{customColorPreviewBio.trace}</span>
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

          {/* SECTION 4: Sprache */}
          <section className="flex items-center justify-between pt-4 border-t border-zinc-800/80">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                {isEn ? '4. App Language' : '4. Sprache der App'}
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

        <div className="px-6 py-4 bg-zinc-900/60 border-t border-zinc-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-zinc-100 text-zinc-950 text-xs font-semibold hover:bg-white transition-colors"
          >
            {isEn ? 'Done' : 'Fertig'}
          </button>
        </div>
      </div>
    </div>
  );
};
