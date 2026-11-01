import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Sparkles,
  UserCheck,
  Wand2,
  X,
} from 'lucide-react';
import {
  STYLE_VIBE_META,
  WARDROBE_PRESETS,
  WardrobePresetKey,
} from '../data/seedData';
import { deriveSeasonPalette } from '../engine/colorMath';
import {
  AppLocale,
  BiometricProfile,
  ChromaLevel,
  ContrastLevel,
  Garment,
  HaircutStyle,
  StyleVibe,
  Undertone,
} from '../types/wardrobe';
import { GarmentVector } from './GarmentVector';

interface SetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: AppLocale;
  currentProfile: BiometricProfile;
  currentStyleVibe: StyleVibe;
  onCompleteSetup: (payload: {
    profile: BiometricProfile;
    styleVibe: StyleVibe;
    garmentsToLoad: Garment[] | null;
  }) => Promise<void>;
}

const SKIN_PRESETS: {
  undertone: Undertone;
  skinHex: string;
  labelDe: string;
  labelEn: string;
  descDe: string;
  descEn: string;
}[] = [
  {
    undertone: 'olive',
    skinHex: '#C8A98E',
    labelDe: 'Oliv / Warm-Neutral',
    labelEn: 'Olive / Warm-Neutral',
    descDe: 'Grünlich-goldener Unterton; steht Erd-, Salbei- & Rosttönen',
    descEn: 'Greenish-golden undertone; thrives in earth, sage & rust tones',
  },
  {
    undertone: 'warm',
    skinHex: '#D6AC88',
    labelDe: 'Warm / Golden',
    labelEn: 'Warm / Golden',
    descDe: 'Goldener/pfirsichfarbener Unterton; steht Kamel, Terrakotta & Creme',
    descEn: 'Golden/peachy undertone; thrives in camel, terracotta & cream',
  },
  {
    undertone: 'cool',
    skinHex: '#DFC2B8',
    labelDe: 'Kühl / Rosig-Bläulich',
    labelEn: 'Cool / Rosy-Blue',
    descDe: 'Kühler Unterton; steht Navy, Anthrazit, Tannengrün & Burgunder',
    descEn: 'Cool undertone; thrives in navy, charcoal, pine & burgundy',
  },
  {
    undertone: 'neutral',
    skinHex: '#C9A892',
    labelDe: 'Ausgewogen Neutral',
    labelEn: 'Balanced Neutral',
    descDe: 'Ausgeglichener Unterton; harmoniert mit gedämpften Warm- & Kühltönen',
    descEn: 'Balanced undertone; harmonizes with soft warm and cool shades',
  },
];

const EYE_PRESETS = [
  { name: 'Grün-Haselnuss (Green-Hazel)', hex: '#6E7D4E' },
  { name: 'Espresso-Braun (Deep Brown)', hex: '#4A3525' },
  { name: 'Eisblau / Stahlblau (Steel Blue)', hex: '#5B7C99' },
  { name: 'Grau-Grün (Sage Grey)', hex: '#6B7B6E' },
  { name: 'Bernstein / Hasel (Amber)', hex: '#8B6528' },
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
    labelDe: 'Short Fade + Struktur',
    labelEn: 'Short Fade + Structured Top',
    descDe: 'Betont Stehkragen, Heavy Crewnecks & Turtlenecks',
    descEn: 'Highlights stand collars, heavy crewnecks & turtlenecks',
  },
  {
    id: 'medium_textured_flow',
    labelDe: 'Medium / Texturierter Schnitt',
    labelEn: 'Medium Textured Flow',
    descDe: 'Harmoniert mit Reverskragen, Blusen, V-Neck & Feinstrick',
    descEn: 'Harmonizes with lapels, blouses, V-necks & fine knits',
  },
  {
    id: 'long_hair',
    labelDe: 'Langes Haar / Offene Länge',
    labelEn: 'Long Hair / Flowing Length',
    descDe: 'Ideal für V-Ausschnitt, Wickel-Tops, Blazer & offene Kragen',
    descEn: 'Ideal for V-necks, wrap tops, blazers & open necklines',
  },
  {
    id: 'buzz_very_short',
    labelDe: 'Buzzcut / Sehr kurz',
    labelEn: 'Buzzcut / Very Short',
    descDe: 'Maximale Wirkung bei Rollkragen, Hoodies & schweren Stoffen',
    descEn: 'Maximum framing with turtlenecks, hoodies & heavy fabrics',
  },
];

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({
  isOpen,
  onClose,
  locale,
  currentProfile,
  currentStyleVibe,
  onCompleteSetup,
}) => {
  const isEn = locale === 'en';
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [selectedPreset, setSelectedPreset] = useState<WardrobePresetKey | 'keep_current'>(
    'womenswear_capsule'
  );
  const [draftProfile, setDraftProfile] = useState<BiometricProfile>(currentProfile);
  const [selectedVibe, setSelectedVibe] = useState<StyleVibe>(
    currentStyleVibe === 'balanced' ? 'minimal_capsule' : currentStyleVibe
  );
  const [isSaving, setIsSaving] = useState(false);

  const derivedPalette = useMemo(
    () => deriveSeasonPalette(draftProfile),
    [draftProfile]
  );

  if (!isOpen) return null;

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      const garmentsToLoad =
        selectedPreset === 'keep_current'
          ? null
          : WARDROBE_PRESETS[selectedPreset].garments;

      const updatedScope =
        selectedPreset === 'keep_current'
          ? draftProfile.wardrobeScope || 'all'
          : WARDROBE_PRESETS[selectedPreset].scope;

      await onCompleteSetup({
        profile: {
          ...draftProfile,
          wardrobeScope: updatedScope,
        },
        styleVibe: selectedVibe,
        garmentsToLoad,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="setup-wizard-title"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl my-8 overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Wand2 className="w-4 h-4" />
            </div>
            <div>
              <h2 id="setup-wizard-title" className="text-base sm:text-lg font-semibold text-zinc-100">
                {isEn
                  ? 'Quick Start (3 Steps)'
                  : 'Schnell-Start (3 Schritte)'}
              </h2>
              <p className="text-xs text-zinc-400">
                {isEn
                  ? 'Choose your wardrobe type, your colors & your favorite everyday style'
                  : 'Wähle deinen Kleiderschrank-Typ, deine Farben und deinen Lieblingsstil'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Setup-Assistent schließen"
            className="p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="px-6 py-3 bg-zinc-900/25 border-b border-zinc-800/80 grid grid-cols-3 gap-2">
          {[
            {
              num: 1 as const,
              titleDe: '1. Kleiderschrank-Auswahl',
              titleEn: '1. Wardrobe Selection',
            },
            {
              num: 2 as const,
              titleDe: '2. Dein Typ & Farben',
              titleEn: '2. Your Colors & Type',
            },
            {
              num: 3 as const,
              titleDe: '3. Dein Stil',
              titleEn: '3. Your Style',
            },
          ].map((s) => {
            const active = step === s.num;
            const done = step > s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num)}
                className={`py-2 px-3 rounded-xl border text-left text-xs font-medium transition-colors cursor-pointer ${
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
        <div className="p-6 max-h-[68vh] overflow-y-auto space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  {isEn
                    ? 'Which example wardrobe would you like to start with?'
                    : 'Mit welchen Kleidungsstücken möchtest du starten?'}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {isEn
                    ? 'Includes normal everyday clothes like T-shirts, hoodies, blouses, sweaters, jeans, trousers, and sneakers.'
                    : 'Enthält ganz normale Alltags-Kleidung wie T-Shirts, Hoodies, Blusen, Pullover, Jeans, Stoffhosen und Sneaker.'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {(
                  [
                    'womenswear_capsule',
                    'menswear_unisex',
                    'unisex_essentials',
                    'combined_atelier',
                  ] as WardrobePresetKey[]
                ).map((presetKey) => {
                  const preset = WARDROBE_PRESETS[presetKey];
                  const isSelected = selectedPreset === presetKey;
                  const previewItems = preset.garments.slice(0, 6);
                  return (
                    <button
                      key={presetKey}
                      type="button"
                      onClick={() => setSelectedPreset(presetKey)}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-400 text-zinc-100'
                          : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-100">
                            {isEn ? preset.labelEn : preset.labelDe}
                          </span>
                          {isSelected && (
                            <span className="text-[11px] font-mono text-amber-300">
                              ✓ {isEn ? 'Selected' : 'Ausgewählt'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400">
                          {isEn ? preset.descriptionEn : preset.descriptionDe}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 bg-zinc-950/90 px-3 py-2 rounded-lg border border-zinc-800/80">
                        {previewItems.map((g) => (
                          <GarmentVector
                            key={g.id}
                            type={g.subcategory}
                            colorHex={g.colorHex}
                            texture={g.texture}
                            neckline={g.neckline}
                            className="w-8 h-8"
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setSelectedPreset('keep_current')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    selectedPreset === 'keep_current'
                      ? 'bg-amber-500/10 border-amber-400 text-zinc-100'
                      : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                  }`}
                >
                  <span className="text-xs font-medium">
                    {isEn
                      ? 'Keep my current wardrobe untouched'
                      : 'Meinen aktuellen Kleiderschrank unverändert beibehalten'}
                  </span>
                  {selectedPreset === 'keep_current' && (
                    <Check className="w-4 h-4 text-amber-400" />
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {/* Skin Undertone */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-200">
                  {isEn ? '1. Skin Undertone' : '1. Hautunterton'}
                </label>
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
                        className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                          active
                            ? 'bg-amber-500/10 border-amber-400 text-zinc-100'
                            : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                        }`}
                      >
                        <span
                          className="w-7 h-7 rounded-full border border-white/25 shrink-0 mt-0.5"
                          style={{ backgroundColor: sp.skinHex }}
                        />
                        <div>
                          <p className="text-xs font-semibold text-zinc-100">
                            {isEn ? sp.labelEn : sp.labelDe}
                          </p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {isEn ? sp.descEn : sp.descDe}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Contrast & Chroma Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-zinc-200">
                    {isEn
                      ? '2. Hair-to-Skin Contrast'
                      : '2. Haar-zu-Haut Kontrast'}
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                    {(
                      [
                        { id: 'low', labelDe: 'Niedrig', labelEn: 'Low' },
                        { id: 'medium', labelDe: 'Mittel', labelEn: 'Medium' },
                        { id: 'high', labelDe: 'Hoch', labelEn: 'High' },
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
                        className={`py-2 rounded-lg text-xs font-medium cursor-pointer ${
                          draftProfile.contrastLevel === c.id
                            ? 'bg-zinc-100 text-zinc-950 font-semibold'
                            : 'text-zinc-400 hover:text-zinc-100'
                        }`}
                      >
                        {isEn ? c.labelEn : c.labelDe}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-semibold text-zinc-200">
                    {isEn ? '3. Chroma / Saturation' : '3. Farb-Intensität (Chroma)'}
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                    {(
                      [
                        { id: 'muted', labelDe: 'Gedämpft', labelEn: 'Muted' },
                        { id: 'moderate', labelDe: 'Mittel', labelEn: 'Moderate' },
                        { id: 'bright', labelDe: 'Klar', labelEn: 'Bright' },
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
                        className={`py-2 rounded-lg text-xs font-medium cursor-pointer ${
                          draftProfile.chromaLevel === ch.id
                            ? 'bg-zinc-100 text-zinc-950 font-semibold'
                            : 'text-zinc-400 hover:text-zinc-100'
                        }`}
                      >
                        {isEn ? ch.labelEn : ch.labelDe}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Eye Color Presets */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-zinc-200">
                  {isEn ? '4. Eye Color (for Hue-Echo Bonus)' : '4. Augenfarbe (für Farb-Echo-Bonus)'}
                </span>
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
                        <span>{eye.name.split(' (')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Haircut / Framing */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-zinc-200">
                  {isEn ? '5. Haircut & Collar Framing' : '5. Haarschnitt & Kragen-Rahmung'}
                </span>
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
                        className={`p-2.5 rounded-xl border text-left cursor-pointer ${
                          active
                            ? 'bg-amber-500/10 border-amber-400 text-zinc-100'
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

              {/* Live Derived Season Palette Preview */}
              <div className="p-3.5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                    {isEn ? 'Derived 12-Season Type' : 'Berechneter 12-Jahreszeiten-Typ'}
                  </span>
                  <p className="text-sm font-bold text-zinc-100">
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
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  {isEn
                    ? 'Choose your preferred Style Direction (Vibe)'
                    : 'Wähle deine bevorzugte Stil-Richtung (Aesthetic Vibe)'}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {isEn
                    ? 'You can switch this vibe anytime with 1 click in the Daily Stylist.'
                    : 'Du kannst die Stil-Richtung jederzeit mit 1 Klick im Tages-Stylisten umschalten.'}
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
        </div>

        {/* Footer Controls */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-900/60 border-t border-zinc-800">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev === 3 ? 2 : 1))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-medium text-zinc-200 hover:bg-zinc-800 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isEn ? 'Back' : 'Zurück'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-100 cursor-pointer"
            >
              {isEn ? 'Cancel' : 'Abbrechen'}
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev === 1 ? 2 : 3))}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-xs font-semibold text-zinc-950 cursor-pointer"
            >
              <span>{isEn ? 'Next Step' : 'Weiter'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleFinish}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-xs font-semibold text-zinc-950 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>
                {isEn
                  ? 'Finish Setup & Generate Outfits'
                  : 'Setup abschließen & Outfits berechnen'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
