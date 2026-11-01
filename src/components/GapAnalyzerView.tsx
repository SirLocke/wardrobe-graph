import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  HelpCircle,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  FIT_LABELS,
  SUBCATEGORY_LABELS,
  TEXTURE_LABELS,
} from '../data/seedData';
import {
  ContextBottleneck,
  GapAnalysisReport,
  Garment,
} from '../types/wardrobe';
import { GarmentVector } from './GarmentVector';

interface GapAnalyzerViewProps {
  report: GapAnalysisReport;
  garments: Garment[];
  onToggleSandboxGarment: (virtualGarment: Garment) => Promise<void>;
  onJumpToContext: (bucket: ContextBottleneck) => void;
  onLockOrphanInStylist: (garmentId: string) => void;
}

export const GapAnalyzerView: React.FC<GapAnalyzerViewProps> = ({
  report,
  garments,
  onToggleSandboxGarment,
  onJumpToContext,
  onLockOrphanInStylist,
}) => {
  const [expandedRecId, setExpandedRecId] = useState<string | null>(null);
  const [expandedOrphanIds, setExpandedOrphanIds] = useState<Record<string, boolean>>({});

  const toggleOrphanReason = (id: string) => {
    setExpandedOrphanIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const sandboxItemsInCloset = garments.filter((g) => g.isWishlistSandbox);

  return (
    <div className="space-y-10">
      {/* Section 1: Weather & Occasion Overview */}
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

        {/* Context Matrix Grid */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h2 className="text-sm font-semibold text-zinc-200">
              1. Wie gut bist du für jedes Wetter &amp; jeden Anlass ausgestattet?
            </h2>
            <span className="text-xs text-zinc-400">
              Klicke auf ein Feld, um passende Outfits anzusehen
            </span>
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
                        Hier hast du noch wenig Auswahl
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
        </div>
      </section>

      {/* Section 2: Orphan Pieces ("Einzelstücke / Schrankleichen") */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              2. Einzelstücke im Schrank, zu denen dir ein Partner fehlt
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
            {report.orphanPieces.map(({ garment, biometricScore, validOutfitCount, isolationReasons }) => {
              const isOrphanExpanded = Boolean(expandedOrphanIds[garment.id]);
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
                      <span>{CATEGORY_LABELS[garment.category].split(' (')[0]}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
                        <GarmentVector
                          type={garment.subcategory}
                          colorHex={garment.colorHex}
                          texture={garment.texture}
                          neckline={garment.neckline}
                          className="w-13 h-13"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-100 truncate">
                          {garment.name}
                        </h3>
                        <p className="text-xs text-zinc-400">
                          {SUBCATEGORY_LABELS[garment.subcategory]} · {garment.colorName}
                        </p>
                      </div>
                    </div>

                    {/* Collapsible Explanation why it is isolated */}
                    <div>
                      <button
                        type="button"
                        onClick={() => toggleOrphanReason(garment.id)}
                        aria-expanded={isOrphanExpanded}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-950/60 hover:bg-zinc-950 border border-zinc-800/70 text-xs text-zinc-300 transition-colors cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Warum lässt sich das schwer kombinieren? (Erklärung)</span>
                        </span>
                        {isOrphanExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        )}
                      </button>

                      {isOrphanExpanded && (
                        <div className="mt-2 rounded-xl bg-zinc-950/80 border border-zinc-800/80 p-3 space-y-1.5">
                          <p className="text-[11px] font-medium text-emerald-400">
                            Farb-Passung zu deinem Typ: {biometricScore}% (steht dir sehr gut!)
                          </p>
                          <p className="text-[11px] font-semibold text-zinc-300 pt-1">
                            Was im Kleiderschrank dazu fehlt:
                          </p>
                          {isolationReasons.map((reason, idx) => (
                            <p key={idx} className="text-xs text-zinc-400 leading-relaxed">
                              → {reason}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-zinc-800/70">
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

      {/* Section 3: Shopping / Missing Pieces ("Welche neuen Teile bringen am meisten?") */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            3. Welche neuen Teile bringen dir am meisten neue Outfits?
          </h2>
          <p className="text-xs text-zinc-400">
            Diese klassischen Alltags-Teile passen am besten zu deinen vorhandenen Sachen und ermöglichen sofort viele neue Kombinationen:
          </p>
        </div>

        <div className="space-y-4">
          {report.recommendations.map((rec, idx) => {
            const { virtualGarment, newOutfitsUnlocked, orphansRescued, unlockedCombinationsPreview, rationale, roiScore } = rec;
            const isAlreadyInSandbox = garments.some((g) => g.id === virtualGarment.id);
            const isExpanded = expandedRecId === rec.archetypeId;

            return (
              <article
                key={rec.archetypeId}
                className="rounded-2xl bg-zinc-900/50 border border-zinc-800/90 p-5 sm:p-6 space-y-4 transition-colors hover:border-zinc-700"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
                      <GarmentVector
                        type={virtualGarment.subcategory}
                        colorHex={virtualGarment.colorHex}
                        texture={virtualGarment.texture}
                        neckline={virtualGarment.neckline}
                        className="w-13 h-13"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <span className="text-zinc-200 font-semibold">Empfehlung #{idx + 1}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-400 font-semibold">
                          +{newOutfitsUnlocked} neue Outfits möglich
                        </span>
                        {orphansRescued.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-300 font-semibold">
                              Passt perfekt zu {orphansRescued.length}{' '}
                              {orphansRescued.length === 1 ? 'Einzelstück' : 'Einzelstücken'}
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
                        <span>{SUBCATEGORY_LABELS[virtualGarment.subcategory]}</span>
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
                      onClick={() =>
                        setExpandedRecId(isExpanded ? null : rec.archetypeId)
                      }
                      aria-expanded={isExpanded}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-zinc-100 cursor-pointer whitespace-nowrap"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>Neue Outfits &amp; Erklärung ({unlockedCombinationsPreview.length})</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
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

                {/* Expandable Concrete Outfit Combinations Preview + Calculation Details */}
                {isExpanded && (
                  <div className="pt-4 border-t border-zinc-800/80 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                      <p className="font-medium text-zinc-300">
                        Beispiel-Outfits mit deinen vorhandenen Kleidungsstücken:
                      </p>
                      <span className="font-mono text-[11px] text-zinc-500">
                        Berechnungs-Wert: {roiScore} Punkte (+{newOutfitsUnlocked} Outfits, {orphansRescued.length} Einzelstücke eingebunden)
                      </span>
                    </div>

                    {unlockedCombinationsPreview.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {unlockedCombinationsPreview.map((combo, cIdx) => (
                          <div
                            key={combo.id}
                            className="rounded-xl bg-zinc-950/90 border border-zinc-800/80 p-3.5 space-y-3"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-zinc-400 font-medium">Beispiel-Outfit {cIdx + 1}</span>
                              <span className="text-emerald-400 font-mono text-[11px]">
                                {combo.totalScore}% Harmonie
                              </span>
                            </div>
                            <div className="flex items-center gap-2 overflow-x-auto py-1">
                              {combo.items.map((item) => {
                                const isVirtual = item.id === virtualGarment.id;
                                return (
                                  <div
                                    key={item.id}
                                    className={`flex flex-col items-center p-2 rounded-lg border min-w-[68px] ${
                                      isVirtual
                                        ? 'border-amber-500/50 bg-amber-500/10'
                                        : 'border-zinc-800 bg-zinc-900/50'
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
                            <p className="text-[11px] text-zinc-400 line-clamp-2">
                              {combo.traces[0]}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
