import React, { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Flame,
  Heart,
  History,
  Lock,
  Palette,
  RotateCcw,
  Shirt,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  CATEGORY_LABELS_EN,
  OCCASION_LABELS,
  OCCASION_LABELS_EN,
  SUBCATEGORY_LABELS,
} from '../data/seedData';
import {
  AppLocale,
  BiometricProfile,
  FavoriteOutfitRecord,
  Garment,
  GarmentCategory,
  GeneratedOutfit,
  OccasionType,
  WornOutfitRecord,
} from '../types/wardrobe';
import { GarmentVector } from './GarmentVector';
import { OutfitLayerStack } from './OutfitLayerStack';

interface WardrobeStatsViewProps {
  garments: Garment[];
  profile: BiometricProfile;
  wornHistory: WornOutfitRecord[];
  locale?: AppLocale;
  onToggleFavoriteOutfit: (fav: FavoriteOutfitRecord) => Promise<void>;
  onWearOutfitToday: (
    items: Garment[],
    title: string,
    totalScore?: number
  ) => Promise<WornOutfitRecord>;
  onDeleteWornRecord: (recordId: string) => Promise<void>;
  onLockItemInStylist: (garmentId: string) => void;
  onJumpToStylist: () => void;
}

const CORE_CATEGORIES: GarmentCategory[] = [
  'base_top',
  'mid_layer',
  'outerwear',
  'bottom',
  'footwear',
  'accessory',
];

function formatDateShort(dateIso?: string, locale: AppLocale = 'de'): string {
  if (!dateIso) return '—';
  try {
    const d = new Date(dateIso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 20 && now.getDate() === d.getDate()) {
      return locale === 'en' ? 'Today' : 'Heute';
    }
    if (
      diffHours < 44 &&
      (now.getDate() - d.getDate() === 1 || (diffHours >= 16 && diffHours < 36))
    ) {
      return locale === 'en' ? 'Yesterday' : 'Gestern';
    }
    return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'de-DE', {
      day: 'numeric',
      month: 'short',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return dateIso.slice(0, 10);
  }
}

export function buildOutfitSignature(garmentIds: string[]): string {
  return [...garmentIds].sort().join('|');
}

export const WardrobeStatsView: React.FC<WardrobeStatsViewProps> = ({
  garments,
  profile,
  wornHistory,
  locale = 'de',
  onToggleFavoriteOutfit,
  onWearOutfitToday,
  onDeleteWornRecord,
  onLockItemInStylist,
  onJumpToStylist,
}) => {
  const isEn = locale === 'en';
  const [justWornBanner, setJustWornBanner] = useState<{
    recordId: string;
    title: string;
    dirtyCount: number;
  } | null>(null);
  const [justWornSig, setJustWornSig] = useState<string | null>(null);

  const realGarments = useMemo(
    () => garments.filter((g) => !g.isWishlistSandbox),
    [garments]
  );

  const garmentsById = useMemo(
    () => new Map(garments.map((g) => [g.id, g])),
    [garments]
  );

  const favoriteOutfits = useMemo<FavoriteOutfitRecord[]>(
    () => (Array.isArray(profile.favoriteOutfits) ? profile.favoriteOutfits : []),
    [profile.favoriteOutfits]
  );

  const favoriteSignatures = useMemo(() => {
    const set = new Set<string>();
    for (const fav of favoriteOutfits) {
      set.add(fav.id);
      set.add(buildOutfitSignature(fav.garmentIds));
    }
    return set;
  }, [favoriteOutfits]);

  // Aggregate wear statistics
  const totalWearsAcrossCloset = useMemo(
    () => realGarments.reduce((sum, g) => sum + (g.wearCount || 0), 0),
    [realGarments]
  );

  const wornGarmentsCount = useMemo(
    () => realGarments.filter((g) => (g.wearCount || 0) > 0).length,
    [realGarments]
  );

  const closetUtilizationPct = useMemo(() => {
    if (realGarments.length === 0) return 0;
    return Math.round((wornGarmentsCount / realGarments.length) * 100);
  }, [realGarments.length, wornGarmentsCount]);

  const avgWornHarmony = useMemo(() => {
    const scored = wornHistory.filter((r) => typeof r.totalScore === 'number');
    if (scored.length === 0) return null;
    const sum = scored.reduce((acc, r) => acc + (r.totalScore || 0), 0);
    return Math.round(sum / scored.length);
  }, [wornHistory]);

  // Group wornHistory by combination signature to find most-worn outfits
  const mostWornOutfits = useMemo(() => {
    const map = new Map<
      string,
      {
        signature: string;
        title: string;
        count: number;
        lastWornDate: string;
        garmentIds: string[];
        garments: Garment[];
        totalScore?: number;
        occasion?: OccasionType;
        temperatureC?: number;
      }
    >();

    for (const rec of wornHistory) {
      const coreIds = rec.garmentIds.filter((id) => {
        const g = garmentsById.get(id) || rec.garments.find((item) => item.id === id);
        return g ? g.category !== 'accessory' : true;
      });
      const sig = buildOutfitSignature(coreIds.length > 0 ? coreIds : rec.garmentIds);
      const existing = map.get(sig);
      const liveGarments = rec.garmentIds
        .map((id) => garmentsById.get(id) || rec.garments.find((item) => item.id === id))
        .filter((g): g is Garment => Boolean(g));

      if (!existing) {
        map.set(sig, {
          signature: sig,
          title: rec.outfitTitle,
          count: 1,
          lastWornDate: rec.wornDate,
          garmentIds: rec.garmentIds,
          garments: liveGarments.length > 0 ? liveGarments : rec.garments,
          totalScore: rec.totalScore,
          occasion: rec.contextSummary?.occasion,
          temperatureC: rec.contextSummary?.temperatureC,
        });
      } else {
        existing.count += 1;
        if (rec.wornDate > existing.lastWornDate) {
          existing.lastWornDate = rec.wornDate;
          existing.title = rec.outfitTitle;
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.count - a.count || b.lastWornDate.localeCompare(a.lastWornDate)
    );
  }, [wornHistory, garmentsById]);

  const wearCountBySignature = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of mostWornOutfits) {
      map.set(entry.signature, entry.count);
    }
    return map;
  }, [mostWornOutfits]);

  // Top worn individual garments
  const topWornGarments = useMemo(() => {
    return [...realGarments]
      .filter((g) => (g.wearCount || 0) > 0)
      .sort((a, b) => {
        const diff = (b.wearCount || 0) - (a.wearCount || 0);
        if (diff !== 0) return diff;
        return (b.lastWornDate || '').localeCompare(a.lastWornDate || '');
      })
      .slice(0, 8);
  }, [realGarments]);

  const maxGarmentWearCount = useMemo(
    () => Math.max(1, ...topWornGarments.map((g) => g.wearCount || 0)),
    [topWornGarments]
  );

  // Category champions (most worn item in each category)
  const categoryChampions = useMemo(() => {
    return CORE_CATEGORIES.map((cat) => {
      const items = realGarments
        .filter((g) => g.category === cat && (g.wearCount || 0) > 0)
        .sort((a, b) => (b.wearCount || 0) - (a.wearCount || 0));
      return {
        category: cat,
        champion: items[0] || null,
        totalCategoryWears: items.reduce((s, g) => s + (g.wearCount || 0), 0),
      };
    }).filter((entry) => entry.champion !== null);
  }, [realGarments]);

  // Unworn garments (0x worn)
  const unwornGarments = useMemo(
    () =>
      realGarments
        .filter((g) => !g.wearCount || g.wearCount === 0)
        .filter((g) => g.category !== 'accessory')
        .slice(0, 8),
    [realGarments]
  );

  // Color wear breakdown
  const colorStats = useMemo(() => {
    const map = new Map<
      string,
      { colorName: string; colorHex: string; wears: number; itemCount: number }
    >();
    for (const g of realGarments) {
      const key = g.colorName.toLowerCase();
      const existing = map.get(key);
      const wears = g.wearCount || 0;
      if (!existing) {
        map.set(key, {
          colorName: g.colorName,
          colorHex: g.colorHex,
          wears,
          itemCount: 1,
        });
      } else {
        existing.wears += wears;
        existing.itemCount += 1;
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.wears - a.wears || b.itemCount - a.itemCount)
      .slice(0, 6);
  }, [realGarments]);

  const maxColorWears = useMemo(
    () => Math.max(1, ...colorStats.map((c) => c.wears)),
    [colorStats]
  );

  // Brand wear breakdown
  const brandStats = useMemo(() => {
    const map = new Map<string, { brand: string; wears: number; itemCount: number }>();
    for (const g of realGarments) {
      if (!g.brand?.trim()) continue;
      const key = g.brand.trim().toLowerCase();
      const existing = map.get(key);
      const wears = g.wearCount || 0;
      if (!existing) {
        map.set(key, {
          brand: g.brand.trim(),
          wears,
          itemCount: 1,
        });
      } else {
        existing.wears += wears;
        existing.itemCount += 1;
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.wears - a.wears || b.itemCount - a.itemCount)
      .slice(0, 6);
  }, [realGarments]);

  const maxBrandWears = useMemo(
    () => Math.max(1, ...brandStats.map((b) => b.wears)),
    [brandStats]
  );

  // Occasion breakdown from wornHistory
  const occasionStats = useMemo(() => {
    const map = new Map<OccasionType, number>();
    for (const rec of wornHistory) {
      const occ = rec.contextSummary?.occasion || 'casual';
      map.set(occ, (map.get(occ) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([occasion, count]) => ({ occasion, count }))
      .sort((a, b) => b.count - a.count);
  }, [wornHistory]);

  const handleWearFromStats = async (
    items: Garment[],
    title: string,
    sig: string,
    totalScore?: number
  ) => {
    const record = await onWearOutfitToday(items, title, totalScore);
    setJustWornSig(sig);
    setJustWornBanner({
      recordId: record.id,
      title,
      dirtyCount: record.dirtyMarkedGarmentIds?.length || 0,
    });
    setTimeout(() => {
      setJustWornSig((prev) => (prev === sig ? null : prev));
    }, 3000);
  };

  return (
    <div className="space-y-7">
      {/* Header */}
      <section className="rounded-2xl bg-zinc-900/50 border border-zinc-800/90 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
              {isEn
                ? 'Statistics & Favorite Outfits'
                : 'Statistiken & Lieblings-Outfits'}
            </h1>
            <p className="text-xs text-zinc-400">
              {isEn
                ? 'Your saved favorite looks, most-worn pieces, color habits & wear history.'
                : 'Deine gespeicherten Lieblings-Outfits, meistgetragenen Einzelteile, Farb-Gewohnheiten & Trage-Historie.'}
            </p>
          </div>
        </div>

        {/* Instant Worn Feedback Banner */}
        {justWornBanner && (
          <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-emerald-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>„{justWornBanner.title}“</strong>{' '}
                {isEn
                  ? 'logged as worn for today'
                  : 'für heute als getragen eingetragen'}{' '}
                {justWornBanner.dirtyCount > 0
                  ? isEn
                    ? `(${justWornBanner.dirtyCount} item(s) moved to laundry)`
                    : `(${justWornBanner.dirtyCount} ${
                        justWornBanner.dirtyCount === 1 ? 'Teil' : 'Teile'
                      } in den Wäschekorb gelegt)`
                  : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await onDeleteWornRecord(justWornBanner.recordId);
                  setJustWornBanner(null);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-xs text-zinc-200 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isEn ? 'Undo' : 'Rückgängig'}</span>
              </button>
            </div>
          </div>
        )}

        {/* 4 Summary KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-xl bg-zinc-950/80 border border-zinc-800/80 p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{isEn ? 'Outfits Worn' : 'Getragene Outfits'}</span>
              <History className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-zinc-100 tabular-nums">
              {wornHistory.length}
            </p>
            <p className="text-[11px] text-zinc-500">
              {wornHistory[0]
                ? `${isEn ? 'Last:' : 'Zuletzt:'} ${formatDateShort(
                    wornHistory[0].wornDate,
                    locale
                  )}`
                : isEn
                ? 'No entries yet'
                : 'Noch kein Eintrag'}
            </p>
          </div>

          <div className="rounded-xl bg-zinc-950/80 border border-zinc-800/80 p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{isEn ? 'Favorite Outfits' : 'Lieblings-Outfits'}</span>
              <Heart className="w-4 h-4 text-rose-400 fill-rose-400/20" />
            </div>
            <p className="text-2xl font-bold font-mono text-zinc-100 tabular-nums">
              {favoriteOutfits.length}
            </p>
            <p className="text-[11px] text-zinc-500">
              {mostWornOutfits[0]
                ? `${isEn ? 'Top Look:' : 'Top-Look:'} ${mostWornOutfits[0].count}× ${
                    isEn ? 'worn' : 'getragen'
                  }`
                : isEn
                ? 'Save looks with ♥'
                : 'Mit ♥ beim Outfit merken'}
            </p>
          </div>

          <div className="rounded-xl bg-zinc-950/80 border border-zinc-800/80 p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{isEn ? 'Closet Utilization' : 'Schrank-Nutzung'}</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-zinc-100 tabular-nums">
              {closetUtilizationPct}%
            </p>
            <p className="text-[11px] text-zinc-500">
              {wornGarmentsCount} {isEn ? 'of' : 'von'} {realGarments.length}{' '}
              {isEn ? 'items worn' : 'Teilen getragen'} ({totalWearsAcrossCloset}×{' '}
              {isEn ? 'total' : 'gesamt'})
            </p>
          </div>

          <div className="rounded-xl bg-zinc-950/80 border border-zinc-800/80 p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>{isEn ? 'Avg. Outfit Harmony' : 'Ø Outfit-Harmonie'}</span>
              <Award className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              {avgWornHarmony !== null ? `${avgWornHarmony}%` : '—'}
            </p>
            <p className="text-[11px] text-zinc-500">
              {isEn ? 'Across worn looks' : 'Deiner getragenen Looks'}
            </p>
          </div>
        </div>
      </section>

      {/* Section 1: Saved Favorite Outfits & Most-Worn Combinations */}
      <section className="rounded-2xl bg-zinc-900/45 border border-zinc-800/90 p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Heart className="w-4 h-4 fill-rose-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">
                {isEn
                  ? 'Your Favorite & Most-Worn Outfits'
                  : 'Deine Lieblings- & meistgetragenen Outfits'}
              </h2>
              <p className="text-xs text-zinc-400">
                {isEn
                  ? 'Saved favorites (♥) and the combinations you wear most often.'
                  : 'Gespeicherte Favoriten (♥) sowie die Kombinationen, die du am häufigsten trägst.'}
              </p>
            </div>
          </div>
        </div>

        {/* Saved Favorites Grid */}
        {favoriteOutfits.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 fill-rose-400 text-rose-400" />
              <span>
                {isEn
                  ? `Saved Favorite Outfits (${favoriteOutfits.length})`
                  : `Gespeicherte Lieblings-Outfits (${favoriteOutfits.length})`}
              </span>
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {favoriteOutfits.map((fav) => {
                const liveItems = fav.garmentIds
                  .map(
                    (id) =>
                      garmentsById.get(id) || fav.garments.find((item) => item.id === id)
                  )
                  .filter((g): g is Garment => Boolean(g));
                const coreIds = liveItems
                  .filter((g) => g.category !== 'accessory')
                  .map((g) => g.id);
                const sig = buildOutfitSignature(
                  coreIds.length > 0 ? coreIds : fav.garmentIds
                );
                const timesWorn = wearCountBySignature.get(sig) || 0;
                const isJustWorn = justWornSig === sig;

                return (
                  <div
                    key={fav.id}
                    className={`rounded-xl border p-4 space-y-4 transition-colors ${
                      isJustWorn
                        ? 'bg-emerald-950/20 border-emerald-500/60'
                        : 'bg-zinc-950/80 border-zinc-800/90 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-zinc-100 truncate">
                            {fav.title}
                          </h4>
                          {timesWorn > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-[11px] font-mono font-semibold text-amber-300">
                              {timesWorn}× {isEn ? 'worn' : 'getragen'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {fav.occasion
                            ? isEn
                              ? OCCASION_LABELS_EN[fav.occasion]
                              : OCCASION_LABELS[fav.occasion]
                            : isEn
                            ? 'Favorite Look'
                            : 'Lieblings-Look'}
                          {fav.temperatureC !== undefined ? ` · ${fav.temperatureC}°C` : ''}
                          {fav.totalScore ? ` · ${fav.totalScore}% Harmonie` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleFavoriteOutfit(fav)}
                          title={
                            isEn ? 'Remove from favorites' : 'Aus Favoriten entfernen'
                          }
                          className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                        >
                          <Heart className="w-4 h-4 fill-rose-400 text-rose-400" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleWearFromStats(
                              liveItems,
                              fav.title,
                              sig,
                              fav.totalScore
                            )
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isJustWorn
                              ? 'bg-emerald-500 text-zinc-950'
                              : 'bg-zinc-100 hover:bg-white text-zinc-950'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {isJustWorn
                              ? isEn
                                ? 'Worn Today ✓'
                                : 'Heute angezogen ✓'
                              : isEn
                              ? 'Wear Today'
                              : 'Heute anziehen'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                      <div className="sm:col-span-5">
                        <OutfitLayerStack
                          items={liveItems}
                          profile={profile}
                          lockedGarmentIds={[]}
                          onToggleLock={() => {}}
                        />
                      </div>
                      <div className="sm:col-span-7 space-y-2">
                        {liveItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900/70 border border-zinc-800/70 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <GarmentVector
                                type={item.subcategory}
                                colorHex={item.colorHex}
                                accentColorHex={item.accentColorHex}
                                pattern={item.pattern}
                                texture={item.texture}
                                neckline={item.neckline}
                                className="w-6 h-6 shrink-0"
                              />
                              <span className="text-zinc-200 font-medium truncate">
                                {item.name}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-amber-400 shrink-0">
                              {item.wearCount || 0}×
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Most-Worn Combinations from Wear History */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {isEn
                ? 'Most-Worn Outfit Combinations'
                : 'Am häufigsten getragene Outfit-Kombinationen'}
            </span>
          </h3>

          {mostWornOutfits.length === 0 ? (
            <div className="rounded-xl bg-zinc-950/60 border border-dashed border-zinc-800 p-6 text-center space-y-2">
              <p className="text-xs font-medium text-zinc-300">
                {isEn
                  ? 'No worn outfits recorded yet.'
                  : 'Noch keine getragenen Outfits aufgezeichnet.'}
              </p>
              <p className="text-xs text-zinc-500">
                {isEn
                  ? 'Click "Wear Today" or the ♥ icon on any outfit suggestion to build your personal statistics.'
                  : 'Klicke bei einem Outfit-Vorschlag auf „Heute anziehen“ oder das ♥-Symbol, um deine Statistik aufzubauen.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {mostWornOutfits.slice(0, 6).map((combo, idx) => {
                const isFav = favoriteSignatures.has(combo.signature);
                const isJustWorn = justWornSig === combo.signature;
                return (
                  <div
                    key={combo.signature}
                    className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                      isJustWorn
                        ? 'bg-emerald-950/20 border-emerald-500/60'
                        : 'bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[11px] font-mono font-bold">
                            #{idx + 1} · {combo.count}× {isEn ? 'worn' : 'getragen'}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            {isEn ? 'Last:' : 'Zuletzt:'}{' '}
                            {formatDateShort(combo.lastWornDate, locale)}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-zinc-100 mt-1.5 truncate">
                          {combo.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleFavoriteOutfit({
                              id: combo.signature,
                              title: combo.title,
                              garmentIds: combo.garmentIds,
                              garments: combo.garments,
                              savedAt: new Date().toISOString(),
                              totalScore: combo.totalScore,
                              occasion: combo.occasion,
                              temperatureC: combo.temperatureC,
                            })
                          }
                          title={
                            isFav
                              ? isEn
                                ? 'Remove from favorites'
                                : 'Aus Lieblings-Outfits entfernen'
                              : isEn
                              ? 'Save as favorite outfit'
                              : 'Als Lieblings-Outfit speichern'
                          }
                          className={`p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                            isFav
                              ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-rose-300 hover:border-zinc-700'
                          }`}
                        >
                          <Heart
                            className={`w-3.5 h-3.5 ${
                              isFav ? 'fill-rose-400 text-rose-400' : ''
                            }`}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleWearFromStats(
                              combo.garments,
                              combo.title,
                              combo.signature,
                              combo.totalScore
                            )
                          }
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isJustWorn
                              ? 'bg-emerald-500 text-zinc-950'
                              : 'bg-zinc-100 hover:bg-white text-zinc-950'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {isJustWorn
                              ? isEn
                                ? 'Worn ✓'
                                : 'Getragen ✓'
                              : isEn
                              ? 'Wear Today'
                              : 'Heute anziehen'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {combo.garments.map((g) => (
                        <div
                          key={g.id}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800/80 text-[11px]"
                        >
                          <GarmentVector
                            type={g.subcategory}
                            colorHex={g.colorHex}
                            accentColorHex={g.accentColorHex}
                            texture={g.texture}
                            neckline={g.neckline}
                            className="w-5 h-5 shrink-0"
                          />
                          <span className="text-zinc-300">
                            {g.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Top Worn Garments & Category Champions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top 8 Most Worn Pieces (7 cols) */}
        <section className="lg:col-span-7 rounded-2xl bg-zinc-900/45 border border-zinc-800/90 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shirt className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-zinc-100">
                {isEn ? 'Most-Worn Garments' : 'Meistgetragene Kleidungsstücke'}
              </h2>
            </div>
            <span className="text-xs text-zinc-400">
              {isEn ? 'Top pieces by wear count' : 'Deine Dauerbrenner im Schrank'}
            </span>
          </div>

          {topWornGarments.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">
              {isEn
                ? 'No wear counts recorded yet.'
                : 'Noch keine Trage-Zähler vorhanden.'}
            </p>
          ) : (
            <div className="space-y-2.5">
              {topWornGarments.map((item, idx) => {
                const count = item.wearCount || 0;
                const widthPct = Math.max(12, Math.round((count / maxGarmentWearCount) * 100));
                return (
                  <div
                    key={item.id}
                    className="rounded-xl bg-zinc-950/80 border border-zinc-800/80 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-zinc-500 w-5 shrink-0">
                          #{idx + 1}
                        </span>
                        <GarmentVector
                          type={item.subcategory}
                          colorHex={item.colorHex}
                          accentColorHex={item.accentColorHex}
                          pattern={item.pattern}
                          texture={item.texture}
                          neckline={item.neckline}
                          className="w-9 h-9 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-zinc-100 truncate">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-zinc-400 truncate">
                            {item.brand ? `${item.brand} · ` : ''}
                            {item.colorName} · {SUBCATEGORY_LABELS[item.subcategory]}
                            {item.lastWornDate
                              ? ` · ${isEn ? 'Last:' : 'Zuletzt:'} ${formatDateShort(
                                  item.lastWornDate,
                                  locale
                                )}`
                              : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-1 rounded-lg bg-amber-400/15 border border-amber-400/40 text-xs font-mono font-bold text-amber-300">
                          {count}×
                        </span>
                        <button
                          type="button"
                          onClick={() => onLockItemInStylist(item.id)}
                          title={
                            isEn
                              ? 'Style outfits with this item'
                              : 'Outfits mit diesem Teil kombinieren'
                          }
                          className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-amber-400/50 text-zinc-400 hover:text-amber-300 cursor-pointer"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-zinc-900 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Category Champions & Unworn Closet Sleepers (5 cols) */}
        <section className="lg:col-span-5 rounded-2xl bg-zinc-900/45 border border-zinc-800/90 p-5 sm:p-6 space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-zinc-100">
                {isEn ? 'Favorites by Category' : 'Spitzenreiter pro Kategorie'}
              </h2>
            </div>

            <div className="space-y-2">
              {categoryChampions.map(({ category, champion, totalCategoryWears }) => (
                <div
                  key={category}
                  className="rounded-xl bg-zinc-950/80 border border-zinc-800/80 p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <GarmentVector
                      type={champion.subcategory}
                      colorHex={champion.colorHex}
                      accentColorHex={champion.accentColorHex}
                      texture={champion.texture}
                      neckline={champion.neckline}
                      className="w-8 h-8 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-zinc-400">
                        {(isEn ? CATEGORY_LABELS_EN : CATEGORY_LABELS)[category].split(' (')[0]}
                      </p>
                      <p className="text-xs font-semibold text-zinc-100 truncate">
                        {champion.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {champion.wearCount || 0}×
                    </span>
                    <p className="text-[10px] text-zinc-500">
                      ({totalCategoryWears}× {isEn ? 'in cat.' : 'Kategorie'})
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {unwornGarments.length > 0 && (
            <div className="pt-4 border-t border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-300">
                  {isEn
                    ? `Unworn Pieces (0× worn)`
                    : `Noch ungetragen im Schrank (0×)`}
                </h3>
                <span className="text-[11px] text-zinc-500">
                  {isEn ? 'Tap to style today' : 'Klicken zum Kombinieren'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {unwornGarments.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onLockItemInStylist(g.id)}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-amber-400/50 text-xs text-zinc-300 hover:text-zinc-100 cursor-pointer"
                  >
                    <GarmentVector
                      type={g.subcategory}
                      colorHex={g.colorHex}
                      accentColorHex={g.accentColorHex}
                      texture={g.texture}
                      neckline={g.neckline}
                      className="w-4 h-4 shrink-0"
                    />
                    <span className="truncate max-w-[140px]">{g.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Section 3: Color, Brand & Occasion Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Colors Worn */}
        <section className="rounded-2xl bg-zinc-900/45 border border-zinc-800/90 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-zinc-100">
              {isEn ? 'Most-Worn Colors' : 'Meistgetragene Farben'}
            </h2>
          </div>
          <div className="space-y-3">
            {colorStats.map((c) => {
              const pct = Math.max(10, Math.round((c.wears / maxColorWears) * 100));
              return (
                <div key={c.colorName} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: c.colorHex }}
                      />
                      <span className="text-zinc-200 font-medium truncate">
                        {c.colorName}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                      {c.wears}× ({c.itemCount} {c.itemCount === 1 ? 'Teil' : 'Teile'})
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-zinc-950 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: c.colorHex,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Brands Worn */}
        <section className="rounded-2xl bg-zinc-900/45 border border-zinc-800/90 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-zinc-100">
              {isEn ? 'Most-Worn Brands' : 'Meistgetragene Marken'}
            </h2>
          </div>
          {brandStats.length === 0 ? (
            <p className="text-xs text-zinc-500">
              {isEn ? 'No brand tags recorded yet.' : 'Noch keine Marken hinterlegt.'}
            </p>
          ) : (
            <div className="space-y-3">
              {brandStats.map((b) => {
                const pct = Math.max(10, Math.round((b.wears / maxBrandWears) * 100));
                return (
                  <div key={b.brand} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-200 font-medium truncate">
                        {b.brand}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                        {b.wears}× ({b.itemCount} {b.itemCount === 1 ? 'Teil' : 'Teile'})
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-950 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400/80"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Occasions Worn */}
        <section className="rounded-2xl bg-zinc-900/45 border border-zinc-800/90 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-zinc-100">
              {isEn ? 'Worn by Occasion' : 'Anlässe in der Historie'}
            </h2>
          </div>
          {occasionStats.length === 0 ? (
            <p className="text-xs text-zinc-500">
              {isEn ? 'No history entries yet.' : 'Noch keine Einträge.'}
            </p>
          ) : (
            <div className="space-y-2.5">
              {occasionStats.map(({ occasion, count }) => (
                <div
                  key={occasion}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-xs"
                >
                  <span className="text-zinc-200 font-medium">
                    {isEn ? OCCASION_LABELS_EN[occasion] : OCCASION_LABELS[occasion]}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-400/15 text-amber-300 font-mono font-semibold">
                    {count}×
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Section 4: Full Chronological Wear Logbook */}
      <section className="rounded-2xl bg-zinc-900/45 border border-zinc-800/90 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-bold text-zinc-100">
              {isEn ? 'Complete Wear History' : 'Chronologisches Trage-Logbuch'}
            </h2>
          </div>
          <span className="text-xs text-zinc-400 font-mono">
            {wornHistory.length} {isEn ? 'entries' : 'Einträge'}
          </span>
        </div>

        {wornHistory.length === 0 ? (
          <p className="text-xs text-zinc-500 py-4 text-center">
            {isEn ? 'No outfits logged yet.' : 'Noch keine Outfits eingetragen.'}
          </p>
        ) : (
          <div className="space-y-2.5">
            {wornHistory.map((record) => {
              const coreIds = record.garmentIds.filter((id) => {
                const g =
                  garmentsById.get(id) ||
                  record.garments.find((item) => item.id === id);
                return g ? g.category !== 'accessory' : true;
              });
              const sig = buildOutfitSignature(
                coreIds.length > 0 ? coreIds : record.garmentIds
              );
              const isFav = favoriteSignatures.has(sig);

              return (
                <div
                  key={record.id}
                  className="rounded-xl bg-zinc-950/75 border border-zinc-800/80 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-amber-300">
                        {formatDateShort(record.wornDate, locale)}
                      </span>
                      {record.contextSummary?.temperatureC !== undefined && (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-300">
                          {record.contextSummary.temperatureC}°C
                        </span>
                      )}
                      {record.contextSummary?.occasion && (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400">
                          {isEn
                            ? OCCASION_LABELS_EN[record.contextSummary.occasion]
                            : OCCASION_LABELS[record.contextSummary.occasion]}
                        </span>
                      )}
                      {record.totalScore && (
                        <span className="text-[10px] text-emerald-400 font-mono">
                          {record.totalScore}%
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-zinc-100 truncate">
                      {record.outfitTitle}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {record.garments.map((g) => (
                        <div
                          key={g.id}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800/80 text-[11px]"
                        >
                          <GarmentVector
                            type={g.subcategory}
                            colorHex={g.colorHex}
                            accentColorHex={g.accentColorHex}
                            texture={g.texture}
                            neckline={g.neckline}
                            className="w-5 h-5 shrink-0"
                          />
                          <span className="text-zinc-300">
                            {g.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        onToggleFavoriteOutfit({
                          id: sig,
                          title: record.outfitTitle,
                          garmentIds: record.garmentIds,
                          garments: record.garments,
                          savedAt: new Date().toISOString(),
                          totalScore: record.totalScore,
                          occasion: record.contextSummary?.occasion,
                          temperatureC: record.contextSummary?.temperatureC,
                        })
                      }
                      title={
                        isFav
                          ? isEn
                            ? 'Remove from favorites'
                            : 'Aus Favoriten entfernen'
                          : isEn
                          ? 'Save as favorite outfit'
                          : 'Als Lieblings-Outfit speichern'
                      }
                      className={`p-2 rounded-lg border text-xs cursor-pointer ${
                        isFav
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-rose-300'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          isFav ? 'fill-rose-400 text-rose-400' : ''
                        }`}
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteWornRecord(record.id)}
                      title={
                        isEn
                          ? 'Remove entry & restore wear counts'
                          : 'Eintrag löschen & Zähler korrigieren'
                      }
                      className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-rose-900/50 text-zinc-400 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
