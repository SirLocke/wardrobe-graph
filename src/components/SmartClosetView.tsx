import React, { useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  FileCode2,
  HelpCircle,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  canGarmentUseLaundry,
  CATEGORY_LABELS,
  FIT_LABELS,
  NECKLINE_LABELS,
  SUBCATEGORY_LABELS,
  TEXTURE_LABELS,
  WARDROBE_PRESETS,
  WardrobePresetKey,
} from '../data/seedData';
import { matchesGarmentSearch, normalizeBrandKey } from '../engine/brandSizeMatcher';
import { scoreGarmentBiometrics } from '../engine/colorMath';
import {
  AppLocale,
  BiometricProfile,
  Garment,
  GarmentCategory,
} from '../types/wardrobe';
import { GarmentVector } from './GarmentVector';

interface SmartClosetViewProps {
  garments: Garment[];
  profile: BiometricProfile;
  locale?: AppLocale;
  outfitCountsByGarmentId: Record<string, number>;
  onOpenAddModal: () => void;
  onOpenImportExportModal: () => void;
  onOpenSetupWizard?: () => void;
  onLoadCollectionPreset?: (presetKey: WardrobePresetKey) => Promise<void>;
  onEditGarment: (garment: Garment) => void;
  onDeleteGarment: (id: string) => Promise<void>;
  onToggleClean: (id: string, nextClean: boolean) => Promise<void>;
  onLockAndStyle: (id: string) => void;
}

type CleanFilter = 'all' | 'clean' | 'dirty' | 'sandbox';
type SeasonFilter = 'all' | 'warm_weather' | 'transition' | 'cold_weather';
type SortMode =
  | 'biometric_desc'
  | 'biometric_asc'
  | 'outfits_desc'
  | 'name_asc'
  | 'wear_desc'
  | 'wear_asc'
  | 'last_worn_desc';

export const SmartClosetView: React.FC<SmartClosetViewProps> = ({
  garments,
  profile,
  locale = 'de',
  outfitCountsByGarmentId,
  onOpenAddModal,
  onOpenImportExportModal,
  onLoadCollectionPreset,
  onEditGarment,
  onDeleteGarment,
  onToggleClean,
  onLockAndStyle,
}) => {
  const isEn = locale === 'en';
  const [categoryFilter, setCategoryFilter] = useState<GarmentCategory | 'all'>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [cleanFilter, setCleanFilter] = useState<CleanFilter>('all');
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('outfits_desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Small closable popup modal for garment color & fit explanation
  const [popupEntry, setPopupEntry] = useState<{
    garment: Garment;
    bio: ReturnType<typeof scoreGarmentBiometrics>;
    validOutfits: number;
  } | null>(null);

  const availableBrands = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of garments) {
      if (g.brand && g.brand.trim()) {
        const key = normalizeBrandKey(g.brand);
        if (!map.has(key)) {
          map.set(key, g.brand.trim());
        }
      }
    }
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [garments]);

  const enrichedGarments = useMemo(() => {
    return garments.map((g) => ({
      garment: g,
      bio: scoreGarmentBiometrics(g, profile),
      validOutfits: outfitCountsByGarmentId[g.id] || 0,
    }));
  }, [garments, profile, outfitCountsByGarmentId]);

  const filtered = useMemo(() => {
    return enrichedGarments
      .filter(({ garment }) => {
        if (categoryFilter !== 'all' && garment.category !== categoryFilter) return false;
        if (
          brandFilter !== 'all' &&
          normalizeBrandKey(garment.brand) !== brandFilter
        ) {
          return false;
        }
        const usesLaundry = canGarmentUseLaundry(garment);
        const effectivelyClean = usesLaundry ? garment.isClean : true;
        if (cleanFilter === 'clean' && !effectivelyClean) return false;
        if (cleanFilter === 'dirty' && (!usesLaundry || effectivelyClean)) return false;
        if (cleanFilter === 'sandbox' && !garment.isWishlistSandbox) return false;

        if (seasonFilter === 'warm_weather' && garment.thermalRating > 2) return false;
        if (seasonFilter === 'transition' && (garment.thermalRating < 2 || garment.thermalRating > 3)) {
          return false;
        }
        if (seasonFilter === 'cold_weather' && garment.thermalRating < 3) return false;

        if (searchQuery.trim()) {
          if (
            !matchesGarmentSearch(
              garment,
              searchQuery,
              SUBCATEGORY_LABELS[garment.subcategory]
            )
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortMode === 'wear_desc') {
          return (b.garment.wearCount || 0) - (a.garment.wearCount || 0);
        }
        if (sortMode === 'wear_asc') {
          return (a.garment.wearCount || 0) - (b.garment.wearCount || 0);
        }
        if (sortMode === 'last_worn_desc') {
          const dateA = a.garment.lastWornDate ? new Date(a.garment.lastWornDate).getTime() : 0;
          const dateB = b.garment.lastWornDate ? new Date(b.garment.lastWornDate).getTime() : 0;
          return dateB - dateA;
        }
        if (sortMode === 'biometric_desc') return b.bio.score - a.bio.score;
        if (sortMode === 'biometric_asc') return a.bio.score - b.bio.score;
        if (sortMode === 'outfits_desc') return b.validOutfits - a.validOutfits;
        return a.garment.name.localeCompare(b.garment.name, 'de');
      });
  }, [
    enrichedGarments,
    categoryFilter,
    brandFilter,
    cleanFilter,
    seasonFilter,
    sortMode,
    searchQuery,
  ]);

  return (
    <div className="space-y-6">
      {/* Header & Summary Strip */}
      <section className="rounded-2xl bg-zinc-900/50 border border-zinc-800/90 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
              {isEn ? 'My Wardrobe' : 'Mein Kleiderschrank'}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              {garments.length} {isEn ? 'items in wardrobe' : 'Kleidungsstücke im Schrank'} ·{' '}
              {garments.filter((g) => (canGarmentUseLaundry(g) ? g.isClean : true)).length}{' '}
              {isEn ? 'clean & ready to wear' : 'tragebereit im Schrank'}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={onOpenImportExportModal}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-colors cursor-pointer whitespace-nowrap touch-manipulation active:scale-95"
            >
              <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
              <span>{isEn ? 'Backup' : 'Backup'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenAddModal}
              title={isEn ? 'Add Garment' : 'Neues Kleidungsstück anlegen'}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg bg-zinc-100 hover:bg-white text-xs font-semibold text-zinc-950 transition-colors cursor-pointer whitespace-nowrap touch-manipulation active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                <span className="inline sm:hidden">{isEn ? 'Add' : 'Neu'}</span>
                <span className="hidden sm:inline">{isEn ? 'Add Garment' : 'Kleidungsstück'}</span>
              </span>
            </button>
          </div>
        </div>

        {/* Starter Collection Switcher (Only visible in Demo mode so it doesn't look like a gender filter in own closet) */}
        {onLoadCollectionPreset && profile.isDemoMode !== false && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800/70">
            <span className="text-xs font-medium text-zinc-400">
              {isEn
                ? 'Load example wardrobe:'
                : 'Beispiel-Kleiderschrank laden (Demo-Auswahl):'}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  'womenswear_capsule',
                  'menswear_unisex',
                  'unisex_essentials',
                  'combined_atelier',
                ] as WardrobePresetKey[]
              ).map((presetKey) => {
                const preset = WARDROBE_PRESETS[presetKey];
                return (
                  <button
                    key={presetKey}
                    type="button"
                    onClick={() => onLoadCollectionPreset(presetKey)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-amber-400/60 text-xs text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {isEn ? preset.labelEn : preset.labelDe}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="space-y-3.5">
          {/* Category Segmented Filter - Horizontal Touch Swipe on Mobile */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800/80 overflow-x-auto scrollbar-none flex-nowrap">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 touch-manipulation active:scale-95 ${
                categoryFilter === 'all'
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              Alle ({garments.length})
            </button>
            {(Object.keys(CATEGORY_LABELS) as GarmentCategory[]).map((cat) => {
              const count = garments.filter((g) => g.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 touch-manipulation active:scale-95 ${
                    categoryFilter === cat
                      ? 'bg-zinc-100 text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {CATEGORY_LABELS[cat].split(' (')[0]} ({count})
                </button>
              );
            })}
          </div>

          {/* Brand Quick Filter Bar - Smooth Horizontal Touch Scroll */}
          {availableBrands.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-nowrap py-1">
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 mr-1 shrink-0">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                {isEn ? 'Brands:' : 'Marken:'}
              </span>
              <button
                type="button"
                onClick={() => setBrandFilter('all')}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 touch-manipulation active:scale-95 ${
                  brandFilter === 'all'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {isEn ? 'All Brands' : 'Alle Marken'}
              </button>
              {availableBrands.map(({ key, label }) => {
                const active = brandFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setBrandFilter(active ? 'all' : key)}
                    className={`px-3 py-1.5 min-h-[36px] rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 touch-manipulation active:scale-95 ${
                      active
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Search, Clean Status, Seasonality, Sort */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                aria-label="Kleiderschrank durchsuchen"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isEn
                    ? 'Search Nike, Adidas, size L, jeans...'
                    : 'Suche nach Marke (Nike, Adidas), Größe, Jeans...'
                }
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 pl-9 pr-8 py-2.5 min-h-[42px] text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Suche löschen"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-100 rounded cursor-pointer touch-manipulation"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              aria-label="Status-Filter"
              value={cleanFilter}
              onChange={(e) => setCleanFilter(e.target.value as CleanFilter)}
              className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2.5 min-h-[42px] text-xs text-zinc-200 cursor-pointer"
            >
              <option value="all">Wäsche-Status: Alle</option>
              <option value="clean">Nur tragebereit / frisch</option>
              <option value="dirty">Im Wäschekorb</option>
              <option value="sandbox">Nur Test-Stücke</option>
            </select>

            <select
              aria-label="Saisonalitäts-Filter"
              value={seasonFilter}
              onChange={(e) => setSeasonFilter(e.target.value as SeasonFilter)}
              className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2.5 min-h-[42px] text-xs text-zinc-200 cursor-pointer"
            >
              <option value="all">Wetter: Für jedes Wetter</option>
              <option value="warm_weather">Für warme Tage (&gt;18°C)</option>
              <option value="transition">Für Übergangswetter (10–20°C)</option>
              <option value="cold_weather">Für kalte Tage (&lt;14°C)</option>
            </select>

            <select
              aria-label="Sortierung"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2.5 min-h-[42px] text-xs text-zinc-200 cursor-pointer"
            >
              <option value="outfits_desc">
                {isEn ? 'Sort: Most versatile outfits' : 'Sortierung: Vielseitig kombinierbar'}
              </option>
              <option value="wear_desc">
                {isEn ? 'Sort: Most worn (Favorites)' : 'Sortierung: Meistgetragen (Favoriten)'}
              </option>
              <option value="wear_asc">
                {isEn ? 'Sort: Rarely / Never worn (Unused)' : 'Sortierung: Selten / Nie getragen (Schrankhüter)'}
              </option>
              <option value="last_worn_desc">
                {isEn ? 'Sort: Recently worn' : 'Sortierung: Zuletzt getragen'}
              </option>
              <option value="biometric_desc">
                {isEn ? 'Sort: Best colors for me' : 'Sortierung: Beste Farben für mich'}
              </option>
              <option value="name_asc">
                {isEn ? 'Sort: Alphabetical (A–Z)' : 'Sortierung: Alphabetisch (A–Z)'}
              </option>
            </select>
          </div>
        </div>
      </section>

      {/* Garments Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800 p-10 text-center space-y-3">
          <p className="text-sm font-medium text-zinc-200">
            Keine Kleidungsstücke für diese Filterauswahl gefunden.
          </p>
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('all');
              setBrandFilter('all');
              setCleanFilter('all');
              setSeasonFilter('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-100 cursor-pointer"
          >
            Filter zurücksetzen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(({ garment, bio, validOutfits }) => {
            const isOrphan = bio.score >= 70 && validOutfits <= 2;
            const supportsLaundry = canGarmentUseLaundry(garment);
            const isRainReady = Boolean(
              garment.rainproof ||
                garment.waterResistant ||
                garment.texture === 'tech_waterproof' ||
                garment.subcategory === 'rain_jacket'
            );

            return (
              <article
                key={garment.id}
                className="rounded-2xl bg-zinc-900/45 border border-zinc-800/90 p-5 flex flex-col justify-between hover:border-zinc-700 transition-colors"
              >
                <div>
                  {/* Top Metadata Line */}
                  <div className="flex items-center justify-between gap-2 text-xs text-zinc-400 pb-3 border-b border-zinc-800/80">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-medium text-zinc-300">
                        Passt in {validOutfits} {validOutfits === 1 ? 'Outfit' : 'Outfits'}
                      </span>
                      {isOrphan && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-400">Einzelstück</span>
                        </>
                      )}
                      {garment.isWishlistSandbox && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-sky-400">Test-Stück</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setPopupEntry({ garment, bio, validOutfits })
                        }
                        title={isEn ? 'Color & type check' : 'Farb-Check öffnen'}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-[11px] text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer"
                      >
                        <HelpCircle className="w-3 h-3 text-amber-400" />
                        <span>{isEn ? 'Color Check' : 'Farb-Check'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditGarment(garment)}
                        title={isEn ? 'Edit garment' : 'Kleidungsstück bearbeiten'}
                        aria-label={`${garment.name} bearbeiten`}
                        className="min-w-[38px] min-h-[38px] flex items-center justify-center p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer touch-manipulation active:scale-95"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteGarment(garment.id)}
                        aria-label={`${garment.name} löschen`}
                        className="min-w-[38px] min-h-[38px] flex items-center justify-center p-2 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer touch-manipulation active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Center Visual + Specs */}
                  <div className="flex items-center gap-4 py-4">
                    <div className="w-20 h-20 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-center shrink-0">
                      {garment.imageDataUrl ? (
                        <img
                          src={garment.imageDataUrl}
                          alt={garment.name}
                          referrerPolicy="no-referrer"
                          className="w-18 h-18 object-cover rounded-lg"
                        />
                      ) : (
                        <GarmentVector
                          type={garment.subcategory}
                          colorHex={garment.colorHex}
                          accentColorHex={garment.accentColorHex}
                          texture={garment.texture}
                          neckline={garment.neckline}
                          hasPrint={garment.hasPrint}
                          hasLogo={garment.hasLogo}
                          wornOpen={garment.wornOpen}
                          className="w-14 h-14"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="text-sm font-semibold text-zinc-100 truncate">
                        {garment.name}
                      </h2>
                      <p className="text-xs text-zinc-400 truncate">
                        {SUBCATEGORY_LABELS[garment.subcategory].split(' (')[0]}
                        {garment.category !== 'accessory'
                          ? ` · ${FIT_LABELS[garment.fit].split(' (')[0]}`
                          : ''}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-300">
                        <span
                          className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                          style={{ backgroundColor: garment.colorHex }}
                        />
                        <span className="truncate">{garment.colorName}</span>
                        {garment.accentColorHex && (
                          <>
                            <span className="text-zinc-500">+</span>
                            <span
                              className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                              style={{ backgroundColor: garment.accentColorHex }}
                            />
                            <span className="truncate text-zinc-300">
                              {garment.accentColorName || 'Akzent'}
                            </span>
                          </>
                        )}
                        {garment.brand && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800/90 border border-zinc-700/80 text-[10px] font-medium text-amber-300">
                            {garment.brand}
                          </span>
                        )}
                        {garment.size && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-400 font-mono">
                            Gr. {garment.size}
                          </span>
                        )}
                        {garment.hasPrint && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-[10px] text-purple-300 font-medium">
                            Print
                          </span>
                        )}
                        {garment.hasLogo && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-[10px] text-indigo-300 font-medium">
                            Logo
                          </span>
                        )}
                        {garment.wornOpen !== undefined && (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-300 font-medium">
                            {garment.wornOpen ? 'Offen getragen' : 'Geschlossen'}
                          </span>
                        )}
                        {isRainReady && garment.category !== 'accessory' && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-[10px] text-sky-300 font-medium">
                            Regenfest
                          </span>
                        )}
                        {garment.windproof && (
                          <span className="px-1.5 py-0.5 rounded bg-teal-500/15 border border-teal-500/30 text-[10px] text-teal-300 font-medium">
                            Winddicht
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1 ${
                            (garment.wearCount || 0) > 0
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50'
                          }`}
                        >
                          {(garment.wearCount || 0) > 0
                            ? `${garment.wearCount}× getragen`
                            : isEn
                            ? 'Never worn'
                            : 'Nie getragen'}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {TEXTURE_LABELS[garment.texture].split(' (')[0]}
                        {garment.neckline !== 'none'
                          ? ` · ${NECKLINE_LABELS[garment.neckline].split(' (')[0]}`
                          : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="mt-2 pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                  {supportsLaundry ? (
                    <button
                      type="button"
                      onClick={() => onToggleClean(garment.id, !garment.isClean)}
                      className={`inline-flex items-center gap-1.5 min-h-[42px] px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer touch-manipulation active:scale-95 ${
                        garment.isClean ? 'text-emerald-400 hover:text-emerald-300' : 'text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>{garment.isClean ? 'Frisch im Schrank' : 'Im Wäschekorb'}</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 min-h-[42px] px-2.5 py-1.5 text-xs text-zinc-400">
                      <Check className="w-3.5 h-3.5 text-emerald-400/80" />
                      <span>{isEn ? 'Always ready' : 'Immer tragebereit'}</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => onLockAndStyle(garment.id)}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[42px] px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors cursor-pointer whitespace-nowrap touch-manipulation active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Outfit darum bauen</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Small Closable Popup Modal for Garment Color & Type Check (Mobile-friendly) */}
      {popupEntry && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="garment-popup-title"
          onClick={() => setPopupEntry(null)}
        >
          <div
            className="w-full sm:max-w-md max-h-[90vh] rounded-t-2xl sm:rounded-2xl bg-zinc-950 border-t sm:border border-zinc-800 shadow-2xl flex flex-col overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-start justify-between gap-3 border-b border-zinc-800/80 px-5 py-4 bg-zinc-900/40">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                  <GarmentVector
                    type={popupEntry.garment.subcategory}
                    colorHex={popupEntry.garment.colorHex}
                    accentColorHex={popupEntry.garment.accentColorHex}
                    texture={popupEntry.garment.texture}
                    neckline={popupEntry.garment.neckline}
                    hasPrint={popupEntry.garment.hasPrint}
                    hasLogo={popupEntry.garment.hasLogo}
                    wornOpen={popupEntry.garment.wornOpen}
                    className="w-9 h-9"
                  />
                </div>
                <div>
                  <h3 id="garment-popup-title" className="text-sm font-semibold text-zinc-100">
                    {popupEntry.garment.name}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {popupEntry.garment.brand ? `${popupEntry.garment.brand} · ` : ''}
                    {popupEntry.garment.size ? `Gr. ${popupEntry.garment.size} · ` : ''}
                    {popupEntry.bio.score}% Typ-Harmonie
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPopupEntry(null)}
                aria-label="Popup schließen"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 text-xs text-zinc-300">
              <div className="flex items-center justify-between rounded-xl bg-zinc-900/60 border border-zinc-800/80 px-3 py-2">
                <span className="text-zinc-400">Farb- &amp; Schnitt-Passung:</span>
                <span className="font-semibold text-emerald-400">
                  {popupEntry.bio.score}%
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-zinc-900/60 border border-zinc-800/80 px-3 py-2">
                <span className="text-zinc-400">{isEn ? 'Wear count:' : 'Tragehäufigkeit:'}</span>
                <span className="font-semibold text-amber-300">
                  {(popupEntry.garment.wearCount || 0) > 0
                    ? `${popupEntry.garment.wearCount}× getragen`
                    : (isEn ? 'Never worn' : 'Noch nie getragen')}
                </span>
              </div>
              {popupEntry.bio.reasons.map((r, idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-zinc-900/60 border border-zinc-800/80 p-3 leading-relaxed"
                >
                  {r}
                </div>
              ))}
              <p className="text-[11px] text-zinc-400 pt-1">
                Kombinierbarkeit: Passt aktuell in{' '}
                <strong className="text-zinc-200">{popupEntry.validOutfits} Outfits</strong> in deinem Kleiderschrank.
              </p>
            </div>

            <div className="shrink-0 flex justify-end p-4 border-t border-zinc-800/80 bg-zinc-900/40">
              <button
                type="button"
                onClick={() => setPopupEntry(null)}
                className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-colors cursor-pointer touch-manipulation active:scale-95"
              >
                {isEn ? 'Close' : 'Schließen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
