import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  FlaskConical,
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
  const [expandedRecId, setExpandedRecId] = useState<string | null>(
    report.recommendations[0]?.archetypeId || null
  );

  const sandboxItemsInCloset = garments.filter((g) => g.isWishlistSandbox);

  return (
    <div className="space-y-10">
      {/* Section 1: Wardrobe Health & Context Matrix Heatmap */}
      <section className="rounded-2xl bg-zinc-900/50 border border-zinc-800/90 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
              Kombinatorischer Gap-Analyzer & Sandbox
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 font-mono tabular-nums">
              Garderoben-Gesundheit: {report.wardrobeHealthScore}/100 ·{' '}
              {report.totalValidOutfitsAcrossContexts} valide Outfits (&ge;76% Score) im Kern-Graphen ·{' '}
              {report.orphanPieces.length} isolierte Schrankleichen
            </p>
          </div>

          {sandboxItemsInCloset.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-sky-300 bg-sky-950/30 border border-sky-800/50 rounded-xl px-3.5 py-2">
              <FlaskConical className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                {sandboxItemsInCloset.length} virtuelle Sandbox-Teile im Schrank aktiv
              </span>
            </div>
          )}
        </div>

        {/* Context Matrix Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">
              01. Wardrobe Health & Context Matrix (Temperatur × Anlass Heatmap)
            </h2>
            <span className="text-xs text-zinc-400">
              Klicke auf eine Zelle, um sie im Tages-Stylisten zu öffnen
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
                        Engpass (&lt;3 valide Outfits)
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

      {/* Section 2: Orphan Pieces ("Isolierte Schrankleichen") */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              02. Isolierte Schrankleichen (Orphan Pieces)
            </h2>
            <p className="text-xs text-zinc-400">
              Kleidungsstücke mit hoher Biometrie-Eignung (&ge;70% Match), die jedoch in &le;2 validen
              Outfits funktionieren, weil passende Kombinationspartner fehlen.
            </p>
          </div>
        </div>

        {report.orphanPieces.length === 0 ? (
          <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800 p-6 text-xs text-emerald-300">
            Exzellente Vernetzung: Aktuell befinden sich keine isolierten Schrankleichen in deinem Inventar!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.orphanPieces.map(({ garment, biometricScore, validOutfitCount, isolationReasons }) => (
              <article
                key={garment.id}
                className="rounded-2xl bg-zinc-900/45 border border-amber-500/30 p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums text-zinc-400 pb-3 border-b border-zinc-800/80">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-emerald-400 font-semibold">
                        {biometricScore}% Biometrie-Match
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-300 font-semibold">
                        Nur {validOutfitCount} {validOutfitCount === 1 ? 'Outfit' : 'Outfits'}
                      </span>
                    </div>
                    <span>{CATEGORY_LABELS[garment.category].split(' ')[0]}</span>
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
                        {SUBCATEGORY_LABELS[garment.subcategory]} · {garment.colorName} ({garment.colorHex})
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Wärme {garment.thermalRating}/5 · Formalität {garment.formality}/5
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-zinc-950/70 border border-zinc-800/80 p-3 space-y-1.5">
                    <p className="text-[11px] font-semibold text-zinc-300">
                      Ursache der Isolation im Kombinations-Graphen:
                    </p>
                    {isolationReasons.map((reason, idx) => (
                      <p key={idx} className="text-xs text-zinc-400 leading-relaxed">
                        → {reason}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-zinc-800/70">
                  <button
                    type="button"
                    onClick={() => onLockOrphanInStylist(garment.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 cursor-pointer"
                  >
                    <span>Im Stylisten als Anker testen</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: High-ROI Shopping List ("Was fehlt?") */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">
            03. High-ROI Shopping-Matrix („Was fehlt?“)
          </h2>
          <p className="text-xs text-zinc-400">
            35 klassische Archetypen wurden virtuell in deinen Kleiderschrank injiziert und nach{' '}
            <span className="font-mono text-zinc-300">(Neue Outfits × 2 + Gerettete Schrankleichen × 5)</span>{' '}
            gerankt.
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
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-zinc-400">
                        <span className="text-zinc-200 font-semibold">0{idx + 1}. ROI-Empfehlung</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-400 font-semibold">
                          +{newOutfitsUnlocked} neue Outfits
                        </span>
                        {orphansRescued.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-300 font-semibold">
                              Rettet {orphansRescued.length}{' '}
                              {orphansRescued.length === 1 ? 'Schrankleiche' : 'Schrankleichen'}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>ROI-Index {roiScore}</span>
                      </div>

                      <h3 className="text-base font-semibold text-zinc-100">
                        {virtualGarment.name}
                      </h3>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <span
                          className="w-3 h-3 rounded-full border border-white/20 inline-block"
                          style={{ backgroundColor: virtualGarment.colorHex }}
                        />
                        <span className="font-mono">{virtualGarment.colorHex}</span>
                        <span aria-hidden="true">·</span>
                        <span>{SUBCATEGORY_LABELS[virtualGarment.subcategory]}</span>
                        <span aria-hidden="true">·</span>
                        <span>{FIT_LABELS[virtualGarment.fit].split(' / ')[0]}</span>
                        <span aria-hidden="true">·</span>
                        <span>{TEXTURE_LABELS[virtualGarment.texture].split(' / ')[0]}</span>
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
                      <Layers className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Vorschau ({unlockedCombinationsPreview.length})</span>
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
                          <span>Im Sandbox-Schrank aktiv (Entfernen)</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>Als Sandbox-Teil testen</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Rescued Orphans Line */}
                {orphansRescued.length > 0 && (
                  <div className="text-xs text-amber-200/90 bg-amber-950/20 border border-amber-500/20 rounded-lg px-3.5 py-2">
                    Bindet folgende isolierte Schrankleichen erfolgreich ein:{' '}
                    <strong>{orphansRescued.map((o) => o.name).join(', ')}</strong>
                  </div>
                )}

                {/* Expandable Concrete Outfit Combinations Preview */}
                {isExpanded && unlockedCombinationsPreview.length > 0 && (
                  <div className="pt-4 border-t border-zinc-800/80 space-y-3">
                    <p className="text-xs font-medium text-zinc-300">
                      Konkrete neue Top-Outfits mit deinen bestehenden Schrank-Teilen:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {unlockedCombinationsPreview.map((combo, cIdx) => (
                        <div
                          key={combo.id}
                          className="rounded-xl bg-zinc-950/90 border border-zinc-800/80 p-3.5 space-y-3"
                        >
                          <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                            <span className="text-zinc-400">Kombination 0{cIdx + 1}</span>
                            <span className="text-emerald-400 font-semibold">
                              {combo.totalScore}% Match
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
