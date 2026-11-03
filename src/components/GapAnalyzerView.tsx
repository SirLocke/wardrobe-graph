import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  FlaskConical,
  HelpCircle,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  FIT_LABELS,
  SUBCATEGORY_LABELS,
  TEXTURE_LABELS,
} from '../data/seedData';
import {
  ArchetypeRecommendation,
  ContextBottleneck,
  GapAnalysisReport,
  Garment,
  GarmentCategory,
  OrphanPieceAnalysis,
} from '../types/wardrobe';
import { buildBrandOrShopUrl } from '../engine/outfitShare';
import { GarmentVector } from './GarmentVector';

interface GapAnalyzerViewProps {
  report: GapAnalysisReport;
  garments: Garment[];
  onToggleSandboxGarment: (virtualGarment: Garment) => Promise<void>;
  onJumpToContext: (bucket: ContextBottleneck) => void;
  onLockOrphanInStylist: (garmentId: string) => void;
}

const RECOMMENDATION_CATEGORY_TABS: Array<{
  id: 'all' | GarmentCategory;
  label: string;
}> = [
  { id: 'all', label: 'Alle Top-Tipps' },
  { id: 'base_top', label: 'T-Shirts & Tops' },
  { id: 'mid_layer', label: 'Pullover & Hemden' },
  { id: 'outerwear', label: 'Jacken & Mäntel' },
  { id: 'bottom', label: 'Hosen & Röcke' },
  { id: 'footwear', label: 'Schuhe' },
];

export const GapAnalyzerView: React.FC<GapAnalyzerViewProps> = ({
  report,
  garments,
  onToggleSandboxGarment,
  onJumpToContext,
  onLockOrphanInStylist,
}) => {
  const [popupOrphan, setPopupOrphan] = useState<OrphanPieceAnalysis | null>(null);
  const [popupRec, setPopupRec] = useState<ArchetypeRecommendation | null>(null);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<'all' | GarmentCategory>('all');

  const sandboxItemsInCloset = garments.filter((g) => g.isWishlistSandbox);

  const displayedRecommendations = useMemo(() => {
    if (selectedCategoryTab === 'all') {
      return report.recommendations;
    }
    const byCat = report.recommendationsByCategory?.[selectedCategoryTab];
    if (byCat && byCat.length > 0) {
      return byCat;
    }
    return report.recommendations.filter(
      (r) => r.virtualGarment.category === selectedCategoryTab
    );
  }, [report.recommendations, report.recommendationsByCategory, selectedCategoryTab]);

  // Identify which categories have 0 clean items in the closet to highlight urgent category gaps
  const missingCoreCategories = useMemo(() => {
    const coreCats: Array<{ cat: GarmentCategory; label: string }> = [
      { cat: 'base_top', label: 'T-Shirts & Tops' },
      { cat: 'mid_layer', label: 'Pullover & Hemden' },
      { cat: 'outerwear', label: 'Jacken & Mäntel' },
      { cat: 'bottom', label: 'Hosen & Röcke' },
      { cat: 'footwear', label: 'Schuhe' },
    ];
    return coreCats.filter(
      ({ cat }) => !garments.some((g) => g.category === cat && g.isClean)
    );
  }, [garments]);

  return (
    <div className="space-y-10">
      {/* Page Header Summary */}
      <section className="rounded-2xl bg-zinc-900/50 border border-zinc-800/90 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
              Was fehlt mir im Kleiderschrank?
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Du kannst aktuell <strong>{report.totalValidOutfitsAcrossContexts} verschiedene Outfits</strong> für Wetter &amp; Alltag kombinieren
              {report.orphanPieces.length > 0
                ? ` · Zu ${report.orphanPieces.length} ${
                    report.orphanPieces.length === 1 ? 'Teil fehlt' : 'Teilen fehlen'
                  } noch passende Partner.`
                : '.'}
            </p>
          </div>

          {sandboxItemsInCloset.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-sky-300 bg-sky-950/30 border border-sky-800/50 rounded-xl px-3.5 py-2">
              <FlaskConical className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                {sandboxItemsInCloset.length} Test-Kleidungsstück(e) werden gerade im Schrank ausprobiert
              </span>
            </div>
          )}
        </div>

        {/* Urgent Missing Category Alert (when outfits are missing because a whole category is empty) */}
        {missingCoreCategories.length > 0 && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-200 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Für komplette Outfits fehlen aktuell noch Teile in:{' '}
                  {missingCoreCategories.map((c) => c.label).join(', ')}
                </span>
              </p>
              <p className="text-xs text-zinc-300">
                Wähle unten direkt die passende Kategorie aus, um gezielte Empfehlungen zu sehen und sie probeweise in deinen Schrank zu legen:
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 shrink-0">
              {missingCoreCategories.map((c) => (
                <button
                  key={c.cat}
                  type="button"
                  onClick={() => setSelectedCategoryTab(c.cat)}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 text-zinc-950 text-xs font-semibold hover:bg-amber-300 transition-colors cursor-pointer"
                >
                  Tipps für {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 1 (CORE): Shopping / Missing Pieces by Category ("Welche neuen Teile bringen dir am meisten neue Outfits?") */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-zinc-100">
                1. Welche neuen Teile bringen dir am meisten neue Outfits? (Tipps nach Kategorie)
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Wähle eine Kategorie, um genau zu sehen, welches T-Shirt, welcher Pullover, welche Jacke, Hose oder welche Schuhe dir die meisten neuen Kombinationen ermöglichen:
              </p>
            </div>
          </div>

          {/* Category Filter Tabs for Missing Pieces */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800/80 overflow-x-auto scrollbar-none flex-nowrap">
            {RECOMMENDATION_CATEGORY_TABS.map((tab) => {
              const isActive = selectedCategoryTab === tab.id;
              const catCount =
                tab.id === 'all'
                  ? report.recommendations.length
                  : (report.recommendationsByCategory?.[tab.id] || []).length;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedCategoryTab(tab.id)}
                  className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 touch-manipulation active:scale-95 ${
                    isActive
                      ? 'bg-amber-400 text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {tab.label} ({catCount})
                </button>
              );
            })}
          </div>

          {displayedRecommendations.length === 0 ? (
            <div className="rounded-xl bg-zinc-950/60 border border-zinc-800 p-6 text-xs text-zinc-400 text-center">
              Für diese Kategorie bist du bereits bestens ausgestattet! Wähle oben eine andere Kategorie.
            </div>
          ) : (
            <div className="space-y-3.5">
              {displayedRecommendations.map((rec, idx) => {
                const {
                  virtualGarment,
                  newOutfitsUnlocked,
                  orphansRescued,
                  unlockedCombinationsPreview,
                  rationale,
                } = rec;
                const isAlreadyInSandbox = garments.some((g) => g.id === virtualGarment.id);

                return (
                  <article
                    key={`${selectedCategoryTab}_${rec.archetypeId}`}
                    className="rounded-2xl bg-zinc-950/80 border border-zinc-800/90 p-4 sm:p-5 space-y-3.5 transition-colors hover:border-zinc-700"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start sm:items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                          <GarmentVector
                            type={virtualGarment.subcategory}
                            colorHex={virtualGarment.colorHex}
                            texture={virtualGarment.texture}
                            neckline={virtualGarment.neckline}
                            hasPrint={virtualGarment.hasPrint}
                            hasLogo={virtualGarment.hasLogo}
                            wornOpen={virtualGarment.wornOpen}
                            className="w-13 h-13"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                            <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                              {CATEGORY_LABELS[virtualGarment.category].split(' (')[0]} · Tipp #{idx + 1}
                            </span>
                            <span className="text-emerald-400 font-semibold">
                              +{newOutfitsUnlocked} neue Outfits möglich
                            </span>
                            {orphansRescued.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-amber-300 font-semibold">
                                  Rettet {orphansRescued.length}{' '}
                                  {orphansRescued.length === 1 ? 'Einzelstück' : 'Einzelstücke'}
                                </span>
                              </>
                            )}
                          </div>

                          <h3 className="text-base font-semibold text-zinc-100">
                            {virtualGarment.name}
                          </h3>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                            <span
                              className="w-3 h-3 rounded-full border border-white/20 inline-block"
                              style={{ backgroundColor: virtualGarment.colorHex }}
                            />
                            <span>{virtualGarment.colorName}</span>
                            <span aria-hidden="true">·</span>
                            <span>{SUBCATEGORY_LABELS[virtualGarment.subcategory].split(' (')[0]}</span>
                            <span aria-hidden="true">·</span>
                            <span>{FIT_LABELS[virtualGarment.fit].split(' (')[0]}</span>
                            <span aria-hidden="true">·</span>
                            <span>{TEXTURE_LABELS[virtualGarment.texture].split(' (')[0]}</span>
                          </div>

                          <p className="text-xs text-zinc-300 pt-1 leading-relaxed">{rationale}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPopupRec(rec)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:border-zinc-700 cursor-pointer whitespace-nowrap"
                        >
                          <Layers className="w-3.5 h-3.5 text-amber-400" />
                          <span>Beispiel-Outfits ({unlockedCombinationsPreview.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onToggleSandboxGarment(virtualGarment)}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                            isAlreadyInSandbox
                              ? 'bg-sky-500/20 border border-sky-500/50 text-sky-200 hover:bg-sky-500/30'
                              : 'bg-zinc-100 text-zinc-950 hover:bg-white'
                          }`}
                        >
                          {isAlreadyInSandbox ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-sky-400" />
                              <span>Wird im Schrank getestet (Entfernen)</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                              <span>Probeweise in den Schrank legen</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Rescued Orphans Line */}
                    {orphansRescued.length > 0 && (
                      <div className="text-xs text-amber-200/90 bg-amber-950/20 border border-amber-500/20 rounded-lg px-3.5 py-2">
                        Damit kannst du endlich kombinieren:{' '}
                        <strong>{orphansRescued.map((o) => o.name).join(', ')}</strong>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Weather & Occasion Overview */}
      <section className="rounded-2xl bg-zinc-900/50 border border-zinc-800/90 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-zinc-100">
              2. Wie gut bist du für jedes Wetter &amp; jeden Anlass ausgestattet?
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Klicke auf ein Feld, um passende Outfits für dieses Wetter im Outfit-Planer anzusehen:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {report.contextMatrix.map((cell) => {
            const toneClass =
              cell.validOutfitCount >= 6
                ? 'border-emerald-500/30 bg-emerald-950/15 hover:border-emerald-500/50'
                : cell.validOutfitCount >= 3
                ? 'border-zinc-800 bg-zinc-950/80 hover:border-zinc-700'
                : 'border-amber-500/40 bg-amber-950/20 hover:border-amber-500/60';

            return (
              <button
                key={cell.id}
                type="button"
                onClick={() => onJumpToContext(cell)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-3 ${toneClass}`}
              >
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold text-zinc-100 truncate">
                    {cell.label}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {cell.occasionLabel} · {cell.tempLabel}
                  </p>
                  {cell.isBottleneck && (
                    <p className="text-[11px] text-amber-300 font-medium">
                      {cell.weather === 'rain_wet'
                        ? 'Tipp: Regenjacke oder wasserfeste Schuhe ergänzen'
                        : cell.temperatureC <= 10
                        ? 'Tipp: Warme Jacke oder Pullover ergänzen'
                        : 'Hier hast du noch wenig Auswahl'}
                    </p>
                  )}
                </div>

                <div className="text-right font-mono tabular-nums shrink-0">
                  <span
                    className={`text-lg font-bold ${
                      cell.validOutfitCount >= 6
                        ? 'text-emerald-400'
                        : cell.validOutfitCount >= 3
                        ? 'text-zinc-200'
                        : 'text-amber-400'
                    }`}
                  >
                    {cell.validOutfitCount}
                  </span>
                  <span className="block text-[10px] text-zinc-500">Outfits</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 3: Orphan Pieces ("Einzelstücke / Schrankleichen") */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              3. Einzelstücke im Schrank, zu denen dir ein Partner fehlt
            </h2>
            <p className="text-xs text-zinc-400">
              Diese Kleidungsstücke stehen dir gut, lassen sich aber aktuell kaum mit deinen anderen Sachen kombinieren.
            </p>
          </div>
        </div>

        {report.orphanPieces.length === 0 ? (
          <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800 p-6 text-xs text-emerald-300">
            Super! Alle deine Kleidungsstücke lassen sich vielseitig miteinander kombinieren.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.orphanPieces.map((orphanItem) => {
              const { garment, validOutfitCount } = orphanItem;
              return (
                <article
                  key={garment.id}
                  className="rounded-2xl bg-zinc-900/45 border border-amber-500/30 p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-zinc-400 pb-3 border-b border-zinc-800/80">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-amber-300 font-semibold">
                          Aktuell nur {validOutfitCount} {validOutfitCount === 1 ? 'Outfit' : 'Outfits'} möglich
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPopupOrphan(orphanItem)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-[11px] text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer"
                      >
                        <HelpCircle className="w-3 h-3 text-amber-400" />
                        <span>Warum?</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
                        <GarmentVector
                          type={garment.subcategory}
                          colorHex={garment.colorHex}
                          texture={garment.texture}
                          neckline={garment.neckline}
                          hasPrint={garment.hasPrint}
                          hasLogo={garment.hasLogo}
                          wornOpen={garment.wornOpen}
                          className="w-13 h-13"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-100 truncate">
                          {garment.name}
                        </h3>
                        <p className="text-xs text-zinc-400">
                          {SUBCATEGORY_LABELS[garment.subcategory].split(' (')[0]} · {garment.colorName}
                          {garment.brand ? ` · ${garment.brand}` : ''}
                          {garment.size ? ` · Gr. ${garment.size}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/70">
                    <span className="text-[11px] text-zinc-500">
                      {CATEGORY_LABELS[garment.category].split(' (')[0]}
                    </span>
                    <button
                      type="button"
                      onClick={() => onLockOrphanInStylist(garment.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 cursor-pointer"
                    >
                      <span>Outfits mit diesem Teil anschauen</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Small Closable Popup Modal for Orphan Explanation (Mobile-friendly Bottom-Sheet) */}
      {popupOrphan && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="orphan-popup-title"
          onClick={() => setPopupOrphan(null)}
        >
          <div
            className="w-full sm:max-w-md max-h-[90vh] rounded-t-2xl sm:rounded-2xl bg-zinc-950 border-t sm:border border-zinc-800 shadow-2xl flex flex-col overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-start justify-between gap-3 border-b border-zinc-800/80 px-5 py-4 bg-zinc-900/40">
              <div>
                <h3 id="orphan-popup-title" className="text-sm font-semibold text-zinc-100">
                  {popupOrphan.garment.name}
                </h3>
                <p className="text-xs text-emerald-400 mt-0.5">
                  Farb-Passung zu deinem Typ: {popupOrphan.biometricScore}%
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPopupOrphan(null)}
                aria-label="Popup schließen"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <p className="text-xs font-semibold text-zinc-300">
                Warum lässt es sich schwer kombinieren?
              </p>
              {popupOrphan.isolationReasons.map((reason, idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-zinc-900/60 border border-zinc-800/80 p-3 text-xs text-zinc-300 leading-relaxed"
                >
                  {reason}
                </div>
              ))}
            </div>

            <div className="shrink-0 flex justify-end p-4 border-t border-zinc-800/80 bg-zinc-900/40">
              <button
                type="button"
                onClick={() => setPopupOrphan(null)}
                className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-colors cursor-pointer touch-manipulation active:scale-95"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Small Closable Popup Modal for Recommendation Preview (Mobile-friendly) */}
      {popupRec && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rec-popup-title"
          onClick={() => setPopupRec(null)}
        >
          <div
            className="w-full sm:max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-2xl bg-zinc-950 border-t sm:border border-zinc-800 shadow-2xl flex flex-col overflow-hidden pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-start justify-between gap-3 border-b border-zinc-800/80 px-5 py-4 bg-zinc-900/40">
              <div>
                <h3 id="rec-popup-title" className="text-sm font-semibold text-zinc-100">
                  {popupRec.virtualGarment.name}
                </h3>
                <p className="text-xs text-emerald-400 mt-0.5">
                  +{popupRec.newOutfitsUnlocked} neue Outfits · {popupRec.roiScore} Punkte Mehrwert
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPopupRec(null)}
                aria-label="Popup schließen"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer touch-manipulation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <p className="text-xs text-zinc-300 leading-relaxed">{popupRec.rationale}</p>

              {popupRec.unlockedCombinationsPreview.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-zinc-200">
                    Beispiel-Outfits mit deinen vorhandenen Sachen:
                  </p>
                  {popupRec.unlockedCombinationsPreview.map((combo, cIdx) => (
                    <div
                      key={combo.id}
                      className="rounded-xl bg-zinc-900/70 border border-zinc-800/80 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-300 font-medium">Beispiel-Outfit {cIdx + 1}</span>
                        <span className="text-emerald-400 font-mono text-[11px]">
                          {combo.totalScore}% Harmonie
                        </span>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
                        {combo.items.map((item) => {
                          const isVirtual = item.id === popupRec.virtualGarment.id;
                          return (
                            <div
                              key={item.id}
                              className={`flex flex-col items-center p-2 rounded-lg border min-w-[68px] ${
                                isVirtual
                                  ? 'border-amber-500/50 bg-amber-500/10'
                                  : 'border-zinc-800 bg-zinc-950'
                              }`}
                            >
                              <GarmentVector
                                type={item.subcategory}
                                colorHex={item.colorHex}
                                texture={item.texture}
                                neckline={item.neckline}
                                className="w-9 h-9"
                              />
                              <span className="text-[10px] text-zinc-300 truncate max-w-[64px] mt-1">
                                {item.name.split(' ')[0]}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0 flex justify-end p-4 border-t border-zinc-800/80 bg-zinc-900/40">
              <button
                type="button"
                onClick={() => setPopupRec(null)}
                className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold transition-colors cursor-pointer touch-manipulation active:scale-95"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
