import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  Check,
  CheckSquare,
  Cloud,
  CloudRain,
  Compass,
  Heart,
  Layers,
  LayoutGrid,
  Lock,
  Luggage,
  Minus,
  Palmtree,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Square,
  Sun,
  Trees,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  CATEGORY_LABELS_EN,
  SUBCATEGORY_LABELS,
} from '../data/seedData';
import {
  generateTravelCapsule,
  TRAVEL_LUGGAGE_SPACE_META,
  TRAVEL_TRIP_TYPE_META,
} from '../engine/travelPacker';
import {
  AppLocale,
  BiometricProfile,
  FavoriteOutfitRecord,
  Garment,
  GarmentCategory,
  TravelLuggageSpace,
  TravelPackConfig,
  TravelTripType,
  WeatherCondition,
} from '../types/wardrobe';
import { GarmentVector } from './GarmentVector';
import { OutfitLayerStack } from './OutfitLayerStack';
import { buildOutfitSignature } from './WardrobeStatsView';

interface TravelPackerViewProps {
  garments: Garment[];
  profile: BiometricProfile;
  locale?: AppLocale;
  onUpdateProfile?: (nextProfile: BiometricProfile) => Promise<void>;
  onToggleFavoriteOutfit?: (fav: FavoriteOutfitRecord) => Promise<void>;
  onEditGarment?: (garment: Garment) => void;
}

const DAY_PRESETS = [3, 5, 7, 10, 14];

const TEMP_PRESETS = [
  { labelDe: 'Kalt <8°', labelEn: 'Cold <8°', temp: 5 },
  { labelDe: 'Kühl 9–15°', labelEn: 'Cool 9–15°', temp: 12 },
  { labelDe: 'Mild 16–21°', labelEn: 'Mild 16–21°', temp: 18 },
  { labelDe: 'Warm >22°', labelEn: 'Warm >22°', temp: 24 },
];

const PACKING_CATEGORY_ORDER: GarmentCategory[] = [
  'bottom',
  'base_top',
  'mid_layer',
  'outerwear',
  'footwear',
  'accessory',
];

export const TravelPackerView: React.FC<TravelPackerViewProps> = ({
  garments,
  profile,
  locale = 'de',
  onUpdateProfile,
  onToggleFavoriteOutfit,
  onEditGarment,
}) => {
  const isEn = locale === 'en';
  const savedState = profile.travelPackState;

  const [days, setDays] = useState<number>(savedState?.days || 7);
  const [luggageSpace, setLuggageSpace] = useState<TravelLuggageSpace>(
    savedState?.luggageSpace || 'balanced'
  );
  const [tripType, setTripType] = useState<TravelTripType>(
    savedState?.tripType || 'city_trip'
  );
  const [temperatureC, setTemperatureC] = useState<number>(
    savedState?.temperatureC ?? 18
  );
  const [weather, setWeather] = useState<WeatherCondition>(
    savedState?.weather || 'sunny_dry'
  );
  const [includeEveningLook, setIncludeEveningLook] = useState<boolean>(
    savedState?.includeEveningLook ?? true
  );
  const [includeLaundryItems, setIncludeLaundryItems] = useState<boolean>(
    savedState?.includeLaundryItems ?? true
  );
  const [lockedGarmentIds, setLockedGarmentIds] = useState<string[]>(
    savedState?.lockedGarmentIds || []
  );
  const [checkedGarmentIds, setCheckedGarmentIds] = useState<string[]>(
    savedState?.checkedGarmentIds || []
  );
  const [variationSeed, setVariationSeed] = useState<number>(0);
  const [showLockPicker, setShowLockPicker] = useState<boolean>(false);
  const [expandedDayNumbers, setExpandedDayNumbers] = useState<number[]>([1]);
  const [viewMode, setViewMode] = useState<'compact' | 'stacked'>('compact');

  const persistTravelState = (
    overrides: Partial<NonNullable<BiometricProfile['travelPackState']>>
  ) => {
    if (!onUpdateProfile) return;
    const nextState: NonNullable<BiometricProfile['travelPackState']> = {
      days,
      luggageSpace,
      tripType,
      temperatureC,
      weather,
      includeEveningLook,
      includeLaundryItems,
      lockedGarmentIds,
      checkedGarmentIds,
      ...overrides,
    };
    void onUpdateProfile({
      ...profile,
      travelPackState: nextState,
    });
  };

  const config = useMemo<TravelPackConfig>(
    () => ({
      days,
      luggageSpace,
      tripType,
      temperatureC,
      weather,
      includeEveningLook,
      includeLaundryItems,
      lockedGarmentIds,
      variationSeed,
    }),
    [
      days,
      luggageSpace,
      tripType,
      temperatureC,
      weather,
      includeEveningLook,
      includeLaundryItems,
      lockedGarmentIds,
      variationSeed,
    ]
  );

  const plan = useMemo(
    () => generateTravelCapsule(garments, profile, config),
    [garments, profile, config]
  );

  const favoriteSignatures = useMemo(() => {
    const set = new Set<string>();
    for (const fav of profile.favoriteOutfits || []) {
      set.add(fav.id);
      set.add(buildOutfitSignature(fav.garmentIds));
    }
    return set;
  }, [profile.favoriteOutfits]);

  const checkedSet = useMemo(() => new Set(checkedGarmentIds), [checkedGarmentIds]);

  const packedCheckedCount = useMemo(
    () => plan.packedGarments.filter((g) => checkedSet.has(g.id)).length,
    [plan.packedGarments, checkedSet]
  );

  const handleToggleChecked = (id: string) => {
    const next = checkedSet.has(id)
      ? checkedGarmentIds.filter((item) => item !== id)
      : [...checkedGarmentIds, id];
    setCheckedGarmentIds(next);
    persistTravelState({ checkedGarmentIds: next });
  };

  const handleResetChecked = () => {
    setCheckedGarmentIds([]);
    persistTravelState({ checkedGarmentIds: [] });
  };

  const handleCheckAll = () => {
    const allIds = plan.packedGarments.map((g) => g.id);
    setCheckedGarmentIds(allIds);
    persistTravelState({ checkedGarmentIds: allIds });
  };

  const handleToggleLockGarment = (id: string) => {
    const exists = lockedGarmentIds.includes(id);
    const next = exists
      ? lockedGarmentIds.filter((item) => item !== id)
      : [...lockedGarmentIds.slice(-3), id];
    setLockedGarmentIds(next);
    persistTravelState({ lockedGarmentIds: next });
  };

  const handleDaysChange = (nextDays: number) => {
    const clamped = Math.max(2, Math.min(14, nextDays));
    setDays(clamped);
    persistTravelState({ days: clamped });
  };

  const handleSpaceChange = (nextSpace: TravelLuggageSpace) => {
    setLuggageSpace(nextSpace);
    persistTravelState({ luggageSpace: nextSpace });
  };

  const handleTripTypeChange = (nextType: TravelTripType) => {
    setTripType(nextType);
    persistTravelState({ tripType: nextType });
  };

  const handleTempChange = (nextTemp: number) => {
    setTemperatureC(nextTemp);
    persistTravelState({ temperatureC: nextTemp });
  };

  const handleWeatherChange = (nextWeather: WeatherCondition) => {
    setWeather(nextWeather);
    persistTravelState({ weather: nextWeather });
  };

  const toggleDayExpanded = (dayNum: number) => {
    setExpandedDayNumbers((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum]
    );
  };

  const getTripIcon = (t: TravelTripType) => {
    switch (t) {
      case 'city_trip':
        return Compass;
      case 'beach_sun':
        return Palmtree;
      case 'business_trip':
        return Briefcase;
      case 'outdoor_nature':
        return Trees;
      default:
        return Sparkles;
    }
  };

  return (
    <div className="space-y-5">
      {/* Compact Travel Configuration Panel */}
      <section
        aria-label={isEn ? 'Travel & Packing Configuration' : 'Reise- & Koffer-Einstellungen'}
        className="rounded-2xl bg-zinc-900/55 border border-zinc-800/90 p-3.5 sm:p-4 space-y-3"
      >
        {/* Row 1: Header + Days + Luggage Space + Reshuffle CTA */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Luggage className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-zinc-100 tracking-tight">
                {isEn ? 'Travel Capsule & Suitcase Planner' : 'Reise- & Koffer-Planer'}
              </h1>
              <p className="text-[11px] text-zinc-400">
                {isEn
                  ? plan.summaryNotesEn[0]
                  : plan.summaryNotesDe[0]}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setVariationSeed((prev) => prev + 1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] rounded-lg bg-amber-400 hover:bg-amber-300 text-xs font-semibold text-zinc-950 transition-colors cursor-pointer whitespace-nowrap touch-manipulation active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              <span>{isEn ? 'Remix Capsule' : 'Koffer neu kombinieren'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLockPicker((prev) => !prev)}
              aria-expanded={showLockPicker}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[34px] rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap touch-manipulation active:scale-95 ${
                lockedGarmentIds.length > 0
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {isEn ? 'Must-pack pieces' : 'Pflicht-Teile wählen'}
                {lockedGarmentIds.length > 0 ? ` (${lockedGarmentIds.length})` : ''}
              </span>
            </button>
          </div>
        </div>

        {/* Row 2: Trip Duration (Days) + Luggage Space + Weather/Temp */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Duration selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center gap-0.5 p-0.5 bg-zinc-950 rounded-xl border border-zinc-800/80">
              <button
                type="button"
                onClick={() => handleDaysChange(days - 1)}
                disabled={days <= 2}
                aria-label={isEn ? 'Fewer days' : 'Weniger Tage'}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 disabled:opacity-40 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 py-0.5 text-xs font-mono font-semibold text-amber-400 tabular-nums">
                {days} {isEn ? 'Days' : 'Tage'}
              </span>
              <button
                type="button"
                onClick={() => handleDaysChange(days + 1)}
                disabled={days >= 14}
                aria-label={isEn ? 'More days' : 'Mehr Tage'}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <span className="w-px h-4 bg-zinc-800 mx-0.5" />
              {DAY_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleDaysChange(d)}
                  className={`px-2 py-1 min-h-[28px] rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    days === d
                      ? 'bg-zinc-100 text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>

            {/* Luggage Space Selector */}
            <div
              className="inline-flex items-center gap-0.5 p-0.5 bg-zinc-950 rounded-xl border border-zinc-800/80"
              role="group"
              aria-label={isEn ? 'Luggage space' : 'Gepäckgröße'}
            >
              {(['minimal', 'balanced', 'spacious'] as TravelLuggageSpace[]).map((sp) => {
                const active = luggageSpace === sp;
                const shortLabel =
                  sp === 'minimal'
                    ? isEn
                      ? 'Carry-On (Minimal)'
                      : 'Wenig Platz (Handgepäck)'
                    : sp === 'balanced'
                    ? isEn
                      ? 'Balanced'
                      : 'Normaler Koffer'
                    : isEn
                    ? 'Large Suitcase'
                    : 'Viel Platz';
                return (
                  <button
                    key={sp}
                    type="button"
                    title={
                      isEn
                        ? TRAVEL_LUGGAGE_SPACE_META[sp].descEn
                        : TRAVEL_LUGGAGE_SPACE_META[sp].descDe
                    }
                    onClick={() => handleSpaceChange(sp)}
                    className={`px-2.5 py-1 min-h-[30px] rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap touch-manipulation active:scale-95 ${
                      active
                        ? 'bg-amber-400 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Destination Temperature & Weather */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex items-center gap-0.5 p-0.5 bg-zinc-950 rounded-xl border border-zinc-800/80">
              {TEMP_PRESETS.map((preset) => {
                const isActive =
                  (preset.temp === 5 && temperatureC < 9) ||
                  (preset.temp === 12 && temperatureC >= 9 && temperatureC <= 15) ||
                  (preset.temp === 18 && temperatureC >= 16 && temperatureC <= 21) ||
                  (preset.temp === 24 && temperatureC >= 22);
                return (
                  <button
                    key={preset.temp}
                    type="button"
                    onClick={() => handleTempChange(preset.temp)}
                    className={`px-2 py-1 min-h-[28px] text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
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

            <div className="inline-flex items-center gap-0.5 p-0.5 bg-zinc-950 rounded-xl border border-zinc-800/80">
              {(
                [
                  { id: 'sunny_dry', labelDe: 'Trocken', labelEn: 'Dry', icon: Sun },
                  { id: 'cloudy_windy', labelDe: 'Windig', labelEn: 'Windy', icon: Cloud },
                  { id: 'rain_wet', labelDe: 'Regen', labelEn: 'Rain', icon: CloudRain },
                ] as const
              ).map(({ id, labelDe, labelEn, icon: Icon }) => {
                const active = weather === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleWeatherChange(id)}
                    className={`inline-flex items-center gap-1 py-1 px-2 min-h-[28px] rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
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
        </div>

        {/* Row 3: Trip Occasion / Style + Evening & Laundry Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/70">
          <div className="flex flex-wrap items-center gap-1">
            {(Object.keys(TRAVEL_TRIP_TYPE_META) as TravelTripType[]).map((tKey) => {
              const meta = TRAVEL_TRIP_TYPE_META[tKey];
              const Icon = getTripIcon(tKey);
              const active = tripType === tKey;
              return (
                <button
                  key={tKey}
                  type="button"
                  title={isEn ? meta.descEn : meta.descDe}
                  onClick={() => handleTripTypeChange(tKey)}
                  className={`inline-flex items-center gap-1.5 py-1 px-2.5 min-h-[30px] rounded-lg text-xs font-medium border transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-semibold'
                      : 'bg-zinc-950 border-zinc-800/90 text-zinc-300 hover:text-zinc-100 hover:border-zinc-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{isEn ? meta.labelEn : meta.labelDe}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const next = !includeEveningLook;
                setIncludeEveningLook(next);
                persistTravelState({ includeEveningLook: next });
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 min-h-[28px] rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                includeEveningLook
                  ? 'bg-amber-400/20 border-amber-400/60 text-amber-200 font-semibold'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {includeEveningLook && <Check className="w-3 h-3 text-amber-400" />}
              <span>{isEn ? '+ Evening Look' : '+ Abend-Look einplanen'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !includeLaundryItems;
                setIncludeLaundryItems(next);
                persistTravelState({ includeLaundryItems: next });
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 min-h-[28px] rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                includeLaundryItems
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200 font-semibold'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {includeLaundryItems && <Check className="w-3 h-3 text-emerald-400" />}
              <span>{isEn ? 'Include laundry items' : 'Inkl. Wäschekorb'}</span>
            </button>
          </div>
        </div>

        {/* Optional Must-Pack Garment Picker Drawer */}
        {showLockPicker && (
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-300">
                {isEn
                  ? 'Pick 1–4 favorite pieces that must go into your suitcase — the rest of the capsule will be matched around them:'
                  : 'Wähle 1–4 Lieblingsteile, die unbedingt mit in den Koffer sollen – alle anderen Teile werden passend dazu abgestimmt:'}
              </p>
              {lockedGarmentIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setLockedGarmentIds([]);
                    persistTravelState({ lockedGarmentIds: [] });
                  }}
                  className="text-xs text-amber-400 hover:underline cursor-pointer"
                >
                  {isEn ? 'Clear selection' : 'Auswahl aufheben'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-52 overflow-y-auto pr-1">
              {garments.map((g) => {
                const isLocked = lockedGarmentIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleToggleLockGarment(g.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      isLocked
                        ? 'bg-amber-500/15 border-amber-500/50 text-zinc-100'
                        : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <GarmentVector
                      type={g.subcategory}
                      colorHex={g.colorHex}
                      accentColorHex={g.accentColorHex}
                      pattern={g.pattern}
                      texture={g.texture}
                      neckline={g.neckline}
                      hasPrint={g.hasPrint}
                      hasLogo={g.hasLogo}
                      className="w-7 h-7 shrink-0"
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
      </section>

      {/* Main 2-Column Content: Left = Interactive Packing List, Right = Day-by-Day Outfits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Column 1: Suitcase Packing List with Checkboxes & Multi-Day Usage Badges (5 cols) */}
        <section
          aria-label={isEn ? 'Suitcase Packing List' : 'Koffer-Packliste'}
          className="lg:col-span-5 rounded-2xl bg-zinc-900/45 border border-zinc-800/90 p-4 sm:p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>
                  {isEn ? 'Suitcase Packing List' : 'Koffer-Packliste'} (
                  {plan.coreGarmentCount}{' '}
                  {isEn ? 'Clothes' : 'Kleidungsstücke'})
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {isEn
                  ? `${packedCheckedCount} of ${plan.packedGarments.length} packed · up to ${plan.totalPossibleCombinations} combinations`
                  : `${packedCheckedCount} von ${plan.packedGarments.length} eingepackt · bis zu ${plan.totalPossibleCombinations} Kombinationen`}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {packedCheckedCount < plan.packedGarments.length ? (
                <button
                  type="button"
                  onClick={handleCheckAll}
                  className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-[11px] font-medium text-zinc-300 cursor-pointer"
                >
                  {isEn ? 'Check all' : 'Alle abhaken'}
                </button>
              ) : null}
              {packedCheckedCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetChecked}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{isEn ? 'Reset' : 'Zurücksetzen'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 rounded-full bg-zinc-950 overflow-hidden border border-zinc-800/70">
            <div
              className="h-full bg-emerald-400 transition-all duration-300"
              style={{
                width: `${
                  plan.packedGarments.length > 0
                    ? Math.round((packedCheckedCount / plan.packedGarments.length) * 100)
                    : 0
                }%`,
              }}
            />
          </div>

          {/* Grouped Capsule Items */}
          <div className="space-y-4">
            {PACKING_CATEGORY_ORDER.map((cat) => {
              const items = plan.packedByCategory[cat] || [];
              if (items.length === 0) return null;
              const catLabel = isEn
                ? CATEGORY_LABELS_EN[cat].split(' (')[0]
                : CATEGORY_LABELS[cat].split(' (')[0];

              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                    <span>{catLabel}</span>
                    <span className="text-[11px] font-mono text-amber-400">
                      {items.length}×
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {items.map(({ garment: g, wornOnDays }) => {
                      const isChecked = checkedSet.has(g.id);
                      const isLocked = lockedGarmentIds.includes(g.id);
                      return (
                        <div
                          key={g.id}
                          onClick={() => handleToggleChecked(g.id)}
                          role="checkbox"
                          aria-checked={isChecked}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleToggleChecked(g.id);
                            }
                          }}
                          className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer select-none ${
                            isChecked
                              ? 'bg-emerald-950/20 border-emerald-500/40 text-zinc-400'
                              : 'bg-zinc-950/90 border-zinc-800/80 hover:border-zinc-700 text-zinc-100'
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-zinc-500 shrink-0" />
                          )}

                          <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800/80 flex items-center justify-center shrink-0">
                            <GarmentVector
                              type={g.subcategory}
                              colorHex={g.colorHex}
                              accentColorHex={g.accentColorHex}
                              pattern={g.pattern}
                              texture={g.texture}
                              neckline={g.neckline}
                              hasPrint={g.hasPrint}
                              hasLogo={g.hasLogo}
                              className="w-7 h-7"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p
                                className={`text-xs font-semibold truncate ${
                                  isChecked ? 'line-through text-zinc-400' : 'text-zinc-100'
                                }`}
                              >
                                {g.name}
                              </p>
                              {isLocked && (
                                <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400">
                              <span>{g.colorName}</span>
                              {g.brand && <span>· {g.brand}</span>}
                              {g.size && <span>· Gr. {g.size}</span>}
                              {!g.isClean && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-medium">
                                  {isEn ? 'Wash before trip' : 'Vor Reise waschen'}
                                </span>
                              )}
                            </div>
                          </div>

                          {wornOnDays.length > 0 && (
                            <span
                              className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-amber-300 shrink-0"
                              title={
                                isEn
                                  ? `Worn on Day ${wornOnDays.join(', ')}`
                                  : `Eingeplant an Tag ${wornOnDays.join(', ')}`
                              }
                            >
                              {isEn ? 'Day' : 'Tag'} {wornOnDays.join(', ')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Column 2: Day-by-Day Coordinated Outfit Plan (7 cols) */}
        <section
          aria-label={isEn ? 'Day-by-Day Travel Outfits' : 'Outfits für jeden Reisetag'}
          className="lg:col-span-7 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-100">
                {isEn
                  ? `${days}-Day Coordinated Outfit Plan`
                  : `Dein ${days}-Tage-Outfit-Plan (alles kombinierbar)`}
              </h2>
              <p className="text-xs text-zinc-400">
                {isEn ? plan.summaryNotesEn[1] : plan.summaryNotesDe[1]}
              </p>
            </div>

            <div
              className="inline-flex items-center p-0.5 rounded-lg bg-zinc-950 border border-zinc-800"
              role="group"
              aria-label="Darstellungsmodus"
            >
              <button
                type="button"
                onClick={() => setViewMode('compact')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  viewMode === 'compact'
                    ? 'bg-zinc-100 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{isEn ? 'Compact' : 'Kompakt'}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('stacked')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer ${
                  viewMode === 'stacked'
                    ? 'bg-zinc-100 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isEn ? 'Stacked' : 'Übereinander'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {plan.dailyOutfits.map((dayEntry) => {
              const coreItems = dayEntry.outfit.items.filter(
                (i) => i.category !== 'accessory'
              );
              const outfitSig = buildOutfitSignature(
                coreItems.length > 0
                  ? coreItems.map((i) => i.id)
                  : dayEntry.outfit.items.map((i) => i.id)
              );
              const isFavorite =
                favoriteSignatures.has(dayEntry.outfit.id) ||
                favoriteSignatures.has(outfitSig);
              const isExpanded =
                viewMode === 'stacked' || expandedDayNumbers.includes(dayEntry.dayNumber);

              return (
                <article
                  key={`day_${dayEntry.dayNumber}_${dayEntry.outfit.id}`}
                  className={`rounded-2xl border p-3.5 sm:p-4 transition-colors space-y-3 ${
                    dayEntry.isEveningOrSpecial
                      ? 'bg-amber-950/15 border-amber-500/40'
                      : 'bg-zinc-900/45 border-zinc-800/90 hover:border-zinc-700/80'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
                          dayEntry.isEveningOrSpecial
                            ? 'bg-amber-400 text-zinc-950'
                            : 'bg-zinc-100 text-zinc-950'
                        }`}
                      >
                        {isEn ? dayEntry.dayLabelEn : dayEntry.dayLabelDe}
                      </span>
                      <h3 className="text-sm font-semibold text-zinc-100">
                        {dayEntry.outfitTitle}
                      </h3>
                      <span className="px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300">
                        {isEn ? dayEntry.occasionLabelEn : dayEntry.occasionLabelDe}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {onToggleFavoriteOutfit && (
                        <button
                          type="button"
                          onClick={() =>
                            onToggleFavoriteOutfit({
                              id: outfitSig,
                              title: `${isEn ? dayEntry.dayLabelEn : dayEntry.dayLabelDe}: ${
                                dayEntry.outfitTitle
                              }`,
                              garmentIds: dayEntry.outfit.items.map((i) => i.id),
                              garments: dayEntry.outfit.items,
                              savedAt: new Date().toISOString(),
                              totalScore: dayEntry.outfit.totalScore,
                              occasion: dayEntry.occasion,
                              temperatureC,
                            })
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer ${
                            isFavorite
                              ? 'bg-rose-500/15 border-rose-500/50 text-rose-200 font-semibold'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                          }`}
                        >
                          <Heart
                            className={`w-3.5 h-3.5 ${
                              isFavorite ? 'fill-rose-400 text-rose-400' : 'text-rose-400'
                            }`}
                          />
                          <span>
                            {isFavorite
                              ? isEn
                                ? 'Saved'
                                : 'Favorit'
                              : isEn
                              ? 'Save'
                              : 'Merken'}
                          </span>
                        </button>
                      )}

                      {viewMode === 'compact' && (
                        <button
                          type="button"
                          onClick={() => toggleDayExpanded(dayEntry.dayNumber)}
                          className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 cursor-pointer"
                        >
                          {isExpanded
                            ? isEn
                              ? 'Compact'
                              : 'Kompakt'
                            : isEn
                            ? 'Stacked View'
                            : 'Übereinander'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Item Strip (Always visible in compact mode) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {dayEntry.outfit.items.map((item) => {
                      const upperCount = dayEntry.outfit.items.filter(
                        (i) =>
                          i.category === 'base_top' ||
                          i.category === 'mid_layer' ||
                          i.category === 'outerwear'
                      ).length;
                      const firstBaseTop = dayEntry.outfit.items.find(
                        (i) => i.category === 'base_top'
                      );
                      const isUnderneathBaseTop =
                        upperCount > 1 && firstBaseTop?.id === item.id;

                      return (
                        <div
                          key={`${dayEntry.dayNumber}_${item.id}`}
                          className="flex items-center gap-2 p-2 rounded-xl bg-zinc-950/90 border border-zinc-800/80"
                        >
                          <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800/70 flex items-center justify-center shrink-0">
                            <GarmentVector
                              type={item.subcategory}
                              colorHex={item.colorHex}
                              accentColorHex={item.accentColorHex}
                              pattern={item.pattern}
                              texture={item.texture}
                              neckline={item.neckline}
                              hasPrint={item.hasPrint}
                              hasLogo={item.hasLogo}
                              wornOpen={item.wornOpen}
                              className="w-7 h-7"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-zinc-100 truncate">
                              {item.name}
                            </p>
                            <p className="text-[10px] text-zinc-400 truncate">
                              {item.colorName}
                              {isUnderneathBaseTop
                                ? isEn
                                  ? ' · Underneath'
                                  : ' · Drunter'
                                : item.wornOpen !== undefined
                                ? item.wornOpen
                                  ? isEn
                                    ? ' · Open'
                                    : ' · Offen'
                                  : isEn
                                  ? ' · Closed'
                                  : ' · Geschlossen'
                                : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Optional Expanded Stacked View */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-zinc-800/70 max-w-sm mx-auto">
                      <OutfitLayerStack
                        items={dayEntry.outfit.items}
                        profile={profile}
                        locale={locale}
                        lockedGarmentIds={lockedGarmentIds}
                        onToggleLock={handleToggleLockGarment}
                        onEditGarment={onEditGarment}
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
