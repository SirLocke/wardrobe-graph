import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudRain,
  Info,
  Layers,
  LayoutGrid,
  Lock,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Unlock,
  Wand2,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  CATEGORY_LABELS_EN,
  OCCASION_LABELS,
  OCCASION_LABELS_EN,
  STYLE_VIBE_META,
  SUBCATEGORY_LABELS,
  TEXTURE_LABELS,
} from '../data/seedData';
import { generateOutfitsForContext } from '../engine/outfitGenerator';
import {
  AppLocale,
  BiometricProfile,
  Garment,
  GarmentCategory,
  OccasionType,
  OutfitContext,
  StyleVibe,
  WeatherCondition,
} from '../types/wardrobe';
import { GarmentVector } from './GarmentVector';
import { OutfitLayerStack } from './OutfitLayerStack';

interface DailyStylistViewProps {
  garments: Garment[];
  profile: BiometricProfile;
  context: OutfitContext;
  locale?: AppLocale;
  onChangeContext: (next: OutfitContext) => void;
  onMarkOutfitWorn: (garmentIds: string[]) => Promise<void>;
  onWashAllGarments: () => Promise<void>;
  onOpenAddModal: () => void;
  onOpenSetupWizard?: () => void;
  onOpenSettings?: () => void;
}

const TEMP_PRESETS = [
  { labelDe: 'Kalt (<8°C)', labelEn: 'Cold (<8°C)', temp: 5 },
  { labelDe: 'Kühl (9–15°C)', labelEn: 'Cool (9–15°C)', temp: 12 },
  { labelDe: 'Mild (16–21°C)', labelEn: 'Mild (16–21°C)', temp: 18 },
  { labelDe: 'Warm (>22°C)', labelEn: 'Warm (>22°C)', temp: 24 },
];

const ANATOMICAL_CATEGORY_ORDER: Record<GarmentCategory, number> = {
  outerwear: 1,
  mid_layer: 2,
  base_top: 3,
  bottom: 4,
  footwear: 5,
};

export const DailyStylistView: React.FC<DailyStylistViewProps> = ({
  garments,
  profile,
  context,
  locale = 'de',
  onChangeContext,
  onMarkOutfitWorn,
  onWashAllGarments,
  onOpenAddModal,
  onOpenSetupWizard,
  onOpenSettings,
}) => {
  const isEn = locale === 'en';
  const [showAnchorPicker, setShowAnchorPicker] = useState(false);
  const [wornFeedbackId, setWornFeedbackId] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'stacked' | 'grid'>('stacked');
  const [expandedDetailsIds, setExpandedDetailsIds] = useState<Record<string, boolean>>({});

  const activeVibe: StyleVibe = context.styleVibe || 'balanced';

  const outfits = useMemo(() => {
    return generateOutfitsForContext(garments, profile, context, 5);
  }, [garments, profile, context]);

  const dirtyCount = useMemo(
    () => garments.filter((g) => !g.isClean).length,
    [garments]
  );

  const lockedGarments = useMemo(
    () => garments.filter((g) => context.lockedGarmentIds.includes(g.id)),
    [garments, context.lockedGarmentIds]
  );

  const toggleLockGarment = (id: string) => {
    const exists = context.lockedGarmentIds.includes(id);
    let nextIds: string[];
    if (exists) {
      nextIds = context.lockedGarmentIds.filter((item) => item !== id);
    } else {
      nextIds = [...context.lockedGarmentIds.slice(-1), id];
    }
    onChangeContext({
      ...context,
      lockedGarmentIds: nextIds,
    });
  };

  const toggleOutfitDetails = (outfitId: string) => {
    setExpandedDetailsIds((prev) => ({
      ...prev,
      [outfitId]: !prev[outfitId],
    }));
  };

  const handleMarkWorn = async (outfitId: string, itemIds: string[]) => {
    await onMarkOutfitWorn(itemIds);
    setWornFeedbackId(outfitId);
    setTimeout(() => {
      setWornFeedbackId((prev) => (prev === outfitId ? null : prev));
    }, 2500);
  };

  const layeringArchitectureLabel = isEn
    ? context.temperatureC >= 21
      ? 'Light Summer Look (Top + Bottom + Shoes)'
      : context.temperatureC >= 14
      ? 'Everyday Look with Sweater / Jacket (Top + Sweater/Cardigan + Bottom + Shoes)'
      : 'Warm Weatherproof Look (Top + Sweater + Coat/Jacket + Bottom + Shoes)'
    : context.temperatureC >= 21
    ? 'Leichter Sommer-Look (Shirt/Bluse + Hose/Rock + Schuhe)'
    : context.temperatureC >= 14
    ? 'Alltags-Look mit Pullover oder Strickjacke (Shirt + Pullover/Blazer + Hose + Schuhe)'
    : 'Warmer Zwiebel-Look mit Jacke/Mantel (Shirt + Pullover + Jacke/Mantel + Hose + Schuhe)';

  return (
    <div className="space-y-8">
      {/* Context Control Panel */}
      <section
        aria-label="Wetter- und Anlass-Auswahl für deine Outfits"
        className="rounded-2xl bg-zinc-900/50 border border-zinc-800/90 p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
              {isEn ? 'What should I wear today?' : 'Was ziehe ich heute an?'}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              {layeringArchitectureLabel} · {outfits.length}{' '}
              {isEn
                ? 'matching outfit ideas from your closet'
                : 'passende Outfit-Ideen aus deinem Kleiderschrank'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenSetupWizard && (
              <button
                type="button"
                onClick={onOpenSetupWizard}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 text-xs font-medium text-amber-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                <span>{isEn ? 'Start Wizard' : 'Start-Assistent'}</span>
              </button>
            )}

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-600 text-xs font-medium text-zinc-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span>{isEn ? 'Settings & Colors' : 'Einstellungen & Farben'}</span>
              </button>
            )}

            {/* Outfit Presentation Toggle: Übereinander (Stacked) vs. Einzelteile */}
            <div
              className="inline-flex items-center p-0.5 rounded-lg bg-zinc-950 border border-zinc-800"
              role="group"
              aria-label="Outfit-Darstellungsmodus"
            >
              <button
                type="button"
                onClick={() => setDisplayMode('stacked')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  displayMode === 'stacked'
                    ? 'bg-zinc-100 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isEn ? 'Stacked Look' : 'Übereinander'}</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('grid')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  displayMode === 'grid'
                    ? 'bg-zinc-100 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{isEn ? 'Single Items' : 'Einzelteile'}</span>
              </button>
            </div>

            {dirtyCount > 0 && (
              <button
                type="button"
                onClick={onWashAllGarments}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {isEn
                    ? `Wash Laundry (${dirtyCount} worn)`
                    : `Wäsche waschen (${dirtyCount} getragen)`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAnchorPicker((prev) => !prev)}
              aria-expanded={showAnchorPicker}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                lockedGarments.length > 0
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {isEn ? 'Pick a piece to wear today' : 'Ein bestimmtes Teil heute tragen'}{' '}
                {lockedGarments.length > 0
                  ? `(${lockedGarments.length} ${isEn ? 'selected' : 'ausgewählt'})`
                  : ''}
              </span>
            </button>
          </div>
        </div>

        {/* Anchor Item Picker Drawer */}
        {showAnchorPicker && (
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-300">
                {isEn
                  ? 'Tap 1–2 clothes from your closet that you definitely want to wear today:'
                  : 'Tippe auf 1–2 Kleidungsstücke aus deinem Schrank, die im Outfit auf jeden Fall dabei sein sollen:'}
              </p>
              {lockedGarments.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChangeContext({ ...context, lockedGarmentIds: [] })}
                  className="text-xs text-amber-400 hover:underline cursor-pointer"
                >
                  {isEn ? 'Clear selection' : 'Auswahl aufheben'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-56 overflow-y-auto pr-1">
              {garments.map((g) => {
                const isLocked = context.lockedGarmentIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleLockGarment(g.id)}
                    className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      isLocked
                        ? 'bg-amber-500/15 border-amber-500/50 text-zinc-100'
                        : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <GarmentVector
                      type={g.subcategory}
                      colorHex={g.colorHex}
                      texture={g.texture}
                      neckline={g.neckline}
                      className="w-8 h-8 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{g.name}</p>
                      <p className="text-[10px] text-zinc-500 truncate">
                        {SUBCATEGORY_LABELS[g.subcategory]}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Controls Grid: Temperature, Weather, Occasion */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Temperature Presets + Slider (5 cols) */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <label htmlFor="temp-slider" className="text-xs font-medium text-zinc-300">
                {isEn ? 'Outside Temperature' : 'Wie warm ist es draußen?'}
              </label>
              <span className="text-sm font-mono font-semibold text-amber-400 tabular-nums">
                {context.temperatureC}°C
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800/80">
              {TEMP_PRESETS.map((preset) => {
                const isActive =
                  (preset.temp === 5 && context.temperatureC < 9) ||
                  (preset.temp === 12 && context.temperatureC >= 9 && context.temperatureC <= 15) ||
                  (preset.temp === 18 && context.temperatureC >= 16 && context.temperatureC <= 21) ||
                  (preset.temp === 24 && context.temperatureC >= 22);
                return (
                  <button
                    key={preset.temp}
                    type="button"
                    onClick={() => onChangeContext({ ...context, temperatureC: preset.temp })}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-zinc-100 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {isEn ? preset.labelEn : preset.labelDe}
                  </button>
                );
              })}
            </div>

            <input
              id="temp-slider"
              type="range"
              min={-5}
              max={32}
              value={context.temperatureC}
              onChange={(e) =>
                onChangeContext({ ...context, temperatureC: Number(e.target.value) })
              }
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Weather Toggle (3 cols) */}
          <div className="lg:col-span-3 space-y-2.5">
            <span className="block text-xs font-medium text-zinc-300">
              {isEn ? 'Weather' : 'Wetter'}
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800/80">
              {(
                [
                  { id: 'sunny_dry', labelDe: 'Trocken', labelEn: 'Dry', icon: Sun },
                  { id: 'cloudy_windy', labelDe: 'Windig', labelEn: 'Windy', icon: Cloud },
                  { id: 'rain_wet', labelDe: 'Regen', labelEn: 'Rain', icon: CloudRain },
                ] as const
              ).map(({ id, labelDe, labelEn, icon: Icon }) => {
                const active = context.weather === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChangeContext({ ...context, weather: id as WeatherCondition })}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-zinc-100 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{isEn ? labelEn : labelDe}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Occasion Selector (4 cols) */}
          <div className="lg:col-span-4 space-y-2.5">
            <span className="block text-xs font-medium text-zinc-300">
              {isEn ? 'Occasion' : 'Was hast du heute vor?'}
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800/80">
              {(Object.keys(OCCASION_LABELS) as OccasionType[]).map((occ) => {
                const active = context.occasion === occ;
                const occText = isEn ? OCCASION_LABELS_EN[occ] : OCCASION_LABELS[occ];
                return (
                  <button
                    key={occ}
                    type="button"
                    onClick={() => onChangeContext({ ...context, occasion: occ })}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap text-center truncate ${
                      active
                        ? 'bg-zinc-100 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {occText.split(' & ')[0]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Style Direction / Aesthetic Vibe Selector Bar */}
        <div className="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-medium text-zinc-300">
              {isEn ? 'Style Mood:' : 'Worauf hast du heute Lust? (Stil):'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 flex-1 sm:justify-end">
            {(Object.keys(STYLE_VIBE_META) as StyleVibe[]).map((vibeKey) => {
              const meta = STYLE_VIBE_META[vibeKey];
              const isSelected = activeVibe === vibeKey;
              return (
                <button
                  key={vibeKey}
                  type="button"
                  onClick={() =>
                    onChangeContext({
                      ...context,
                      styleVibe: vibeKey,
                    })
                  }
                  title={isEn ? meta.subtitleEn : meta.subtitleDe}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap border ${
                    isSelected
                      ? 'bg-amber-400/20 border-amber-400/60 text-amber-200 font-semibold'
                      : 'bg-zinc-950 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  {isEn ? meta.labelEn : meta.labelDe}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Generated Outfits Feed */}
      {outfits.length === 0 ? (
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800 p-10 text-center space-y-4">
          <SlidersHorizontal className="w-8 h-8 text-amber-400 mx-auto" />
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-base font-semibold text-zinc-100">
              {isEn
                ? 'No complete outfit found for this weather & occasion'
                : 'Für dieses Wetter & diesen Anlass fehlt gerade ein passendes Teil'}
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {isEn
                ? `For ${OCCASION_LABELS_EN[context.occasion]} at ${context.temperatureC}°C, a matching garment is missing or currently in the laundry.`
                : `Für „${OCCASION_LABELS[context.occasion]}“ bei ${context.temperatureC}°C (${
                    context.weather === 'rain_wet' ? 'Regenfest' : 'Trocken'
                  }) fehlt ein passendes Kleidungsstück oder deine passenden Teile sind gerade in der Wäsche.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {dirtyCount > 0 && (
              <button
                type="button"
                onClick={onWashAllGarments}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-100 cursor-pointer"
              >
                {isEn
                  ? 'Mark worn clothes as washed'
                  : 'Getragene Kleidung als gewaschen markieren'}
              </button>
            )}
            {context.lockedGarmentIds.length > 0 && (
              <button
                type="button"
                onClick={() => onChangeContext({ ...context, lockedGarmentIds: [] })}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-100 cursor-pointer"
              >
                {isEn ? 'Clear selected item' : 'Ausgewähltes Einzelteil lösen'}
              </button>
            )}
            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-xs font-semibold text-zinc-950 cursor-pointer"
            >
              {isEn ? '+ Add Garment' : '+ Neues Kleidungsstück anlegen'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {outfits.map((outfit, idx) => {
            const isWornJustNow = wornFeedbackId === outfit.id;
            const hasSandboxItem = outfit.items.some((i) => i.isWishlistSandbox);
            const isDetailsExpanded = Boolean(expandedDetailsIds[outfit.id]);
            const sortedAnatomicalItems = [...outfit.items].sort(
              (a, b) =>
                ANATOMICAL_CATEGORY_ORDER[a.category] -
                ANATOMICAL_CATEGORY_ORDER[b.category]
            );

            return (
              <article
                key={outfit.id}
                className="rounded-2xl bg-zinc-900/45 border border-zinc-800/90 p-5 sm:p-6 transition-colors hover:border-zinc-700/80 space-y-5"
              >
                {/* Clean Top Row without overwhelming math/scores */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-zinc-400">
                      <span className="text-sm font-bold text-zinc-100">
                        {idx + 1}. {isEn ? 'Outfit Idea' : 'Outfit-Vorschlag'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-300/90 font-medium">
                        {isEn
                          ? STYLE_VIBE_META[activeVibe].labelEn
                          : STYLE_VIBE_META[activeVibe].labelDe}
                      </span>
                      {hasSandboxItem && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-sky-300 font-medium">
                            {isEn ? 'Includes Test Item' : 'Mit Wunschlisten-Testteil'}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400">
                      {sortedAnatomicalItems.map((it) => it.name).join(' + ')}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleOutfitDetails(outfit.id)}
                      aria-expanded={isDetailsExpanded}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-xs font-medium text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Info className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        {isDetailsExpanded
                          ? isEn
                            ? 'Hide explanation & score'
                            : 'Erklärung & Punkte ausblenden'
                          : isEn
                          ? 'Why does this match? (Show score)'
                          : 'Warum passt das zusammen? (Erklärung)'}
                      </span>
                      {isDetailsExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleMarkWorn(
                          outfit.id,
                          outfit.items
                            .filter((i) => i.category === 'base_top' || i.category === 'mid_layer')
                            .map((i) => i.id)
                        )
                      }
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        isWornJustNow
                          ? 'bg-emerald-500 text-zinc-950 font-semibold'
                          : 'bg-zinc-100 text-zinc-950 hover:bg-white font-semibold'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {isWornJustNow
                          ? isEn
                            ? 'Marked as worn'
                            : 'Als getragen markiert'
                          : isEn
                          ? 'Wear Today'
                          : 'Heute anziehen'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Main Outfit Display: Stacked ("Übereinander") or Grid */}
                {displayMode === 'stacked' ? (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                    {/* Visual Vertical Outfit Stack ("Übereinander") */}
                    <div className="md:col-span-5">
                      <OutfitLayerStack
                        items={outfit.items}
                        profile={profile}
                        lockedGarmentIds={context.lockedGarmentIds}
                        onToggleLock={toggleLockGarment}
                      />
                    </div>

                    {/* Head-to-Toe Vertical Layer Breakdown ("Von Kopf bis Fuß") */}
                    <div className="md:col-span-7 flex flex-col justify-between gap-2.5">
                      {sortedAnatomicalItems.map((item, layerIdx) => {
                        const isLocked = context.lockedGarmentIds.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            className="group relative rounded-xl bg-zinc-950/90 border border-zinc-800/80 hover:border-zinc-700/90 p-3 flex items-center gap-3.5 transition-colors"
                          >
                            {/* Layer index + Miniature Garment Vector */}
                            <div className="relative flex items-center justify-center w-12 h-12 rounded-lg bg-zinc-900/70 border border-zinc-800/60 shrink-0">
                              {item.imageDataUrl ? (
                                <img
                                  src={item.imageDataUrl}
                                  alt={item.name}
                                  referrerPolicy="no-referrer"
                                  className="w-10 h-10 object-cover rounded"
                                />
                              ) : (
                                <GarmentVector
                                  type={item.subcategory}
                                  colorHex={item.colorHex}
                                  texture={item.texture}
                                  neckline={item.neckline}
                                  className="w-10 h-10"
                                />
                              )}
                              <span className="absolute -top-1 -left-1 w-4 h-4 rounded bg-zinc-900 border border-zinc-700 text-[9px] font-mono text-zinc-400 flex items-center justify-center">
                                {layerIdx + 1}
                              </span>
                            </div>

                            {/* Item Details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                                <span>
                                  {SUBCATEGORY_LABELS[item.subcategory]}
                                </span>
                                {item.isWishlistSandbox && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-sky-300">Wunschlisten-Testteil</span>
                                  </>
                                )}
                              </div>
                              <p className="text-sm font-semibold text-zinc-100 truncate mt-0.5">
                                {item.name}
                              </p>
                              <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                                  style={{ backgroundColor: item.colorHex }}
                                />
                                <span className="truncate">{item.colorName}</span>
                                <span aria-hidden="true">·</span>
                                <span className="truncate">
                                  {TEXTURE_LABELS[item.texture]}
                                </span>
                              </div>
                            </div>

                            {/* Lock Anchor Action */}
                            <button
                              type="button"
                              onClick={() => toggleLockGarment(item.id)}
                              title={
                                isLocked
                                  ? 'Auswahl aufheben'
                                  : 'Dieses Teil festhalten und andere Teile dazu kombinieren'
                              }
                              aria-label={`${item.name} ${isLocked ? 'lösen' : 'festhalten'}`}
                              className="p-2 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-zinc-900 transition-colors cursor-pointer shrink-0"
                            >
                              {isLocked ? (
                                <Lock className="w-4 h-4 text-amber-400" />
                              ) : (
                                <Unlock className="w-4 h-4 opacity-60 group-hover:opacity-100" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {outfit.items.map((item) => {
                      const isLocked = context.lockedGarmentIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className="group relative rounded-xl bg-zinc-950/90 border border-zinc-800/80 p-3 flex flex-col justify-between"
                        >
                          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2">
                            <span className="truncate">
                              {(isEn ? CATEGORY_LABELS_EN : CATEGORY_LABELS)[
                                item.category
                              ].split(',')[0]}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleLockGarment(item.id)}
                              title={
                                isLocked
                                  ? 'Auswahl aufheben'
                                  : 'Dieses Teil festhalten'
                              }
                              aria-label={`${item.name} ${isLocked ? 'lösen' : 'festhalten'}`}
                              className="text-zinc-500 hover:text-amber-400 transition-colors cursor-pointer"
                            >
                              {isLocked ? (
                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                              )}
                            </button>
                          </div>

                          <div className="my-2 flex items-center justify-center h-20">
                            {item.imageDataUrl ? (
                              <img
                                src={item.imageDataUrl}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                className="h-20 w-20 object-cover rounded-lg"
                              />
                            ) : (
                              <GarmentVector
                                type={item.subcategory}
                                colorHex={item.colorHex}
                                texture={item.texture}
                                neckline={item.neckline}
                                className="w-16 h-16"
                              />
                            )}
                          </div>

                          <div className="mt-2 pt-2 border-t border-zinc-900 space-y-1">
                            <p className="text-xs font-medium text-zinc-100 line-clamp-2 min-h-[2rem] leading-snug">
                              {item.name}
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                                style={{ backgroundColor: item.colorHex }}
                              />
                              <span className="truncate">{item.colorName}</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 truncate">
                              {SUBCATEGORY_LABELS[item.subcategory]}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Collapsible Details & Score Breakdown (Hidden by default, opens on click) */}
                {isDetailsExpanded && (
                  <div className="rounded-xl bg-zinc-950/80 border border-zinc-800/90 p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
                      <h3 className="text-xs font-semibold text-zinc-200">
                        {isEn
                          ? 'Why this outfit works for you (Details & Score)'
                          : 'Warum dieses Outfit gut zu dir passt (Herleitung & Bewertung)'}
                      </h3>
                      <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                        <span className="text-emerald-400 font-semibold">
                          {outfit.totalScore} / 100 {isEn ? 'Points' : 'Punkte'}
                        </span>
                        <span className="text-zinc-500">·</span>
                        <span className="text-zinc-400">
                          {isEn ? 'Light-Dark Contrast:' : 'Hell-Dunkel-Kontrast:'}{' '}
                          {outfit.breakdown.lightnessDelta}%
                        </span>
                      </div>
                    </div>

                    <ul className="space-y-2 text-xs text-zinc-300 leading-relaxed">
                      {outfit.traces.map((trace, tIdx) => (
                        <li key={tIdx} className="flex items-start gap-2">
                          <span className="text-amber-400 font-mono select-none">→</span>
                          <span>{trace}</span>
                        </li>
                      ))}
                    </ul>

                    {/* 5-Pillar Breakdown in plain German */}
                    <div className="pt-3 border-t border-zinc-800/80 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center font-mono tabular-nums">
                      <div className="p-2 rounded-lg bg-zinc-900/60">
                        <p className="text-[10px] text-zinc-400">
                          {isEn ? 'Your Colors & Type' : 'Typ & Hautton'}
                        </p>
                        <p className="text-xs text-zinc-100 font-semibold mt-0.5">
                          {outfit.breakdown.biometricBase} / 35
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-zinc-900/60">
                        <p className="text-[10px] text-zinc-400">
                          {isEn ? 'Contrast' : 'Hell-Dunkel-Kontrast'}
                        </p>
                        <p className="text-xs text-zinc-100 font-semibold mt-0.5">
                          {outfit.breakdown.contrastCalibration} / 20
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-zinc-900/60">
                        <p className="text-[10px] text-zinc-400">
                          {isEn ? 'Color Harmony' : 'Farbharmonie'}
                        </p>
                        <p className="text-xs text-zinc-100 font-semibold mt-0.5">
                          {outfit.breakdown.colorHarmony} / 20
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-zinc-900/60">
                        <p className="text-[10px] text-zinc-400">
                          {isEn ? 'Cut & Proportions' : 'Schnitt & Passform'}
                        </p>
                        <p className="text-xs text-zinc-100 font-semibold mt-0.5">
                          {outfit.breakdown.silhouetteBalance} / 15
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-zinc-900/60">
                        <p className="text-[10px] text-zinc-400">
                          {isEn ? 'Fabric Mix' : 'Stoff-Kombination'}
                        </p>
                        <p className="text-xs text-zinc-100 font-semibold mt-0.5">
                          {outfit.breakdown.textureContrast} / 10
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

