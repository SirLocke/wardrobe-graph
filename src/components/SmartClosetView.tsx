import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  FileCode2,
  HelpCircle,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  FIT_LABELS,
  NECKLINE_LABELS,
  SUBCATEGORY_LABELS,
  TEXTURE_LABELS,
  WARDROBE_PRESETS,
  WardrobePresetKey,
} from '../data/seedData';
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
type SortMode = 'biometric_desc' | 'biometric_asc' | 'outfits_desc' | 'name_asc';

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
  const [cleanFilter, setCleanFilter] = useState<CleanFilter>('all');
  const [seasonFilter, setSeasonFilter] = useState<SeasonFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('outfits_desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});

  const toggleCardDetails = (id: string) => {
    setExpandedCardIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
        if (cleanFilter === 'clean' && !garment.isClean) return false;
        if (cleanFilter === 'dirty' && garment.isClean) return false;
        if (cleanFilter === 'sandbox' && !garment.isWishlistSandbox) return false;

        if (seasonFilter === 'warm_weather' && garment.thermalRating > 2) return false;
        if (seasonFilter === 'transition' && (garment.thermalRating < 2 || garment.thermalRating > 3)) {
          return false;
        }
        if (seasonFilter === 'cold_weather' && garment.thermalRating < 3) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = garment.name.toLowerCase().includes(q);
          const matchColor = garment.colorName.toLowerCase().includes(q);
          const matchSub = SUBCATEGORY_LABELS[garment.subcategory].toLowerCase().includes(q);
          if (!matchName && !matchColor && !matchSub) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortMode === 'biometric_desc') return b.bio.score - a.bio.score;
        if (sortMode === 'biometric_asc') return a.bio.score - b.bio.score;
        if (sortMode === 'outfits_desc') return b.validOutfits - a.validOutfits;
        return a.garment.name.localeCompare(b.garment.name, 'de');
      });
  }, [enrichedGarments, categoryFilter, cleanFilter, seasonFilter, sortMode, searchQuery]);

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
              {garments.filter((g) => g.isClean).length}{' '}
              {isEn ? 'clean & ready to wear' : 'frisch gewaschen & tragbar'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenImportExportModal}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-medium text-zinc-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileCode2 className="w-4 h-4 text-amber-400" />
              <span>{isEn ? 'Backup / Import' : 'Backup & Import'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-xs font-semibold text-zinc-950 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>{isEn ? '+ Add Garment' : '+ Neues Kleidungsstück'}</span>
            </button>
          </div>
        </div>

        {/* Starter Collection Switcher */}
        {onLoadCollectionPreset && (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800/70">
            <span className="text-xs font-medium text-zinc-400">
              {isEn
                ? 'Load example wardrobe:'
                : 'Beispiel-Kleiderschrank laden (zum Ausprobieren):'}
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
        <div className="space-y-4">
          {/* Category Segmented Filter */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800/80">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
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

          {/* Search, Clean Status, Seasonality, Sort */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Kleiderschrank durchsuchen"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Suche nach T-Shirt, Jeans, Farbe..."
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 pl-9 pr-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-600"
              />
            </div>

            <select
              aria-label="Status-Filter"
              value={cleanFilter}
              onChange={(e) => setCleanFilter(e.target.value as CleanFilter)}
              className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
            >
              <option value="all">Wäsche-Status: Alle</option>
              <option value="clean">Nur frisch gewaschen</option>
              <option value="dirty">Im Wäschekorb</option>
              <option value="sandbox">Nur Test-Stücke</option>
            </select>

            <select
              aria-label="Saisonalitäts-Filter"
              value={seasonFilter}
              onChange={(e) => setSeasonFilter(e.target.value as SeasonFilter)}
              className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
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
              className="rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
            >
              <option value="outfits_desc">Sortierung: Vielseitig kombinierbar</option>
              <option value="biometric_desc">Sortierung: Beste Farben für mich</option>
              <option value="name_asc">Sortierung: Alphabetisch (A–Z)</option>
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
            const isExpanded = Boolean(expandedCardIds[garment.id]);

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
                          <span className="text-amber-400">Einzelstück (wenig Kombi-Partner)</span>
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
                        onClick={() => onEditGarment(garment)}
                        aria-label={`${garment.name} bearbeiten`}
                        className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteGarment(garment.id)}
                        aria-label={`${garment.name} löschen`}
                        className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
                          texture={garment.texture}
                          neckline={garment.neckline}
                          className="w-14 h-14"
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="text-sm font-semibold text-zinc-100 truncate">
                        {garment.name}
                      </h2>
                      <p className="text-xs text-zinc-400 truncate">
                        {SUBCATEGORY_LABELS[garment.subcategory]} · {FIT_LABELS[garment.fit].split(' (')[0]}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-zinc-300">
                        <span
                          className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                          style={{ backgroundColor: garment.colorHex }}
                        />
                        <span className="truncate">{garment.colorName}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {TEXTURE_LABELS[garment.texture].split(' (')[0]}
                        {garment.neckline !== 'none'
                          ? ` · ${NECKLINE_LABELS[garment.neckline].split(' (')[0]}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  {/* Collapsible Color & Fit Check */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleCardDetails(garment.id)}
                      aria-expanded={isExpanded}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-950/60 hover:bg-zinc-950 border border-zinc-800/70 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          {isEn
                            ? 'Why does this color suit me? (Details)'
                            : 'Passt diese Farbe zu meinem Typ? (Erklärung)'}
                        </span>
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 rounded-lg bg-zinc-950/90 border border-zinc-800/80 p-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="text-zinc-400">Typ- & Farb-Harmonie:</span>
                          <span
                            className={
                              bio.score >= 82
                                ? 'text-emerald-400 font-semibold'
                                : bio.score >= 68
                                ? 'text-amber-300 font-semibold'
                                : 'text-rose-400 font-semibold'
                            }
                          >
                            {bio.score}% Passung
                          </span>
                        </div>
                        <p className="text-zinc-300 leading-relaxed">{bio.reasons[0]}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleClean(garment.id, !garment.isClean)}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer ${
                      garment.isClean ? 'text-emerald-400 hover:text-emerald-300' : 'text-amber-400 hover:text-amber-300'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{garment.isClean ? 'Frisch im Schrank' : 'Im Wäschekorb (Waschen)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLockAndStyle(garment.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Outfit darum bauen</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
