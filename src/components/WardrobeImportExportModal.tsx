import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  FileCode2,
  FileJson,
  Play,
  RefreshCw,
  Server,
  Sparkles,
  Terminal,
  Upload,
  X,
} from 'lucide-react';
import { CATEGORY_LABELS, SUBCATEGORY_LABELS } from '../data/seedData';
import { scoreGarmentBiometrics } from '../engine/colorMath';
import {
  buildLlmPhotoToJsonPrompt,
  buildLlmWardrobeAnalysisPrompt,
  parseAndNormalizeWardrobeImport,
} from '../engine/wardrobeFormatter';
import { MCP_TOOLS_MANIFEST } from '../mcp/mcpHandler';
import {
  BiometricProfile,
  GapAnalysisReport,
  Garment,
  WornOutfitRecord,
} from '../types/wardrobe';
import { GarmentVector } from './GarmentVector';

interface WardrobeImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BiometricProfile;
  garments: Garment[];
  gapReport: GapAnalysisReport;
  onImportGarments: (
    garments: Garment[],
    mode: 'merge' | 'replace',
    importedProfile?: BiometricProfile,
    importedWornHistory?: WornOutfitRecord[]
  ) => Promise<void>;
  onDownloadJsonBackup: () => void;
  onRefreshFromServer?: () => Promise<void>;
}

type ModalSection = 'export_llm' | 'import_json' | 'docker_mcp';
type ExportTemplateType = 'llm_analysis' | 'llm_photo_converter' | 'raw_json';

const SAMPLE_LLM_SNIPPET = `\`\`\`json
[
  {
    "name": "Feinstrick Merino Pullover Waldkiefer",
    "category": "mid_layer",
    "subcategory": "knit_sweater",
    "colorName": "Waldkiefer",
    "colorHex": "#2D4A3E",
    "fit": "regular",
    "neckline": "crewneck",
    "texture": "fine_knit",
    "thermalRating": 3,
    "formality": 4,
    "waterResistant": false,
    "isClean": true
  },
  {
    "name": "Tapered Woll-Tuchhose Anthrazit",
    "category": "bottom",
    "subcategory": "trousers",
    "colorName": "Anthrazit",
    "colorHex": "#2B2D42",
    "fit": "regular",
    "neckline": "none",
    "texture": "flannel_wool",
    "thermalRating": 3,
    "formality": 4,
    "waterResistant": false,
    "isClean": true
  }
]
\`\`\``;

const CLAUDE_DESKTOP_DOCKER_CONFIG = `{
  "mcpServers": {
    "thread-graph": {
      "command": "docker",
      "args": [
        "exec",
        "-i",
        "thread-graph",
        "npx",
        "tsx",
        "mcp-server.ts"
      ]
    }
  }
}`;

const DOCKER_COMPOSE_SNIPPET = `services:
  thread-graph:
    image: ghcr.io/thread-graph/thread-graph:latest
    container_name: thread-graph
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3000
      - WARDROBE_DATA_FILE=/app/data/wardrobe-store.json
    restart: unless-stopped`;

const OPEN_SOURCE_PITCH = `A deterministic, zero-AI personal stylist & wardrobe gap analyzer. Uses CIELAB/HSL color math, biometric profiling, and graph theory to build outfits and calculate high-ROI missing pieces. Offline-first PWA.`;

export const WardrobeImportExportModal: React.FC<WardrobeImportExportModalProps> = ({
  isOpen,
  onClose,
  profile,
  garments,
  gapReport,
  onImportGarments,
  onDownloadJsonBackup,
  onRefreshFromServer,
}) => {
  const [activeSection, setActiveSection] = useState<ModalSection>('export_llm');
  const [exportTemplate, setExportTemplate] = useState<ExportTemplateType>('llm_analysis');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importSuccessBanner, setImportSuccessBanner] = useState<string | null>(null);

  const [mcpTestOutput, setMcpTestOutput] = useState<string>('');
  const [mcpTesting, setMcpTesting] = useState(false);

  const exportTextContent = useMemo(() => {
    if (exportTemplate === 'llm_analysis') {
      return buildLlmWardrobeAnalysisPrompt(profile, garments, gapReport);
    }
    if (exportTemplate === 'llm_photo_converter') {
      return buildLlmPhotoToJsonPrompt(profile);
    }
    return JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        profile,
        garments,
      },
      null,
      2
    );
  }, [exportTemplate, profile, garments, gapReport]);

  const parsedImport = useMemo(() => {
    if (!importText.trim()) return null;
    return parseAndNormalizeWardrobeImport(importText);
  }, [importText]);

  if (!isOpen) return null;

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2200);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportText(text);
    setActiveSection('import_json');
  };

  const handleExecuteImport = async () => {
    if (!parsedImport || !parsedImport.ok) return;
    await onImportGarments(
      parsedImport.garments,
      importMode,
      parsedImport.profile,
      parsedImport.wornHistory
    );
    setImportSuccessBanner(
      `${parsedImport.garments.length} ${
        parsedImport.garments.length === 1 ? 'Kleidungsstück' : 'Kleidungsstücke'
      } erfolgreich ${
        importMode === 'merge' ? 'zum Kleiderschrank hinzugefügt' : 'als neuer Schrank übernommen'
      }!`
    );
    setImportText('');
    setTimeout(() => {
      setImportSuccessBanner(null);
      onClose();
    }, 1100);
  };

  const runLiveMcpRpcTest = async (
    method: string,
    params?: Record<string, unknown>
  ) => {
    setMcpTesting(true);
    try {
      const payload = {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      };
      const res = await fetch('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      setMcpTestOutput(JSON.stringify(json, null, 2));
      if (onRefreshFromServer) {
        await onRefreshFromServer();
      }
    } catch (err) {
      setMcpTestOutput(
        JSON.stringify({ error: (err as Error).message }, null, 2)
      );
    } finally {
      setMcpTesting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto sm:overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-export-modal-title"
    >
      <div className="w-full h-full sm:h-auto sm:max-h-[90vh] max-w-4xl rounded-none sm:rounded-2xl bg-zinc-950 border-0 sm:border sm:border-zinc-800 shadow-2xl my-0 sm:my-8 overflow-hidden flex flex-col">
        {/* Top Modal Header */}
        <div className="shrink-0 sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-md">
          <div>
            <h2 id="import-export-modal-title" className="text-base sm:text-lg font-semibold text-zinc-100">
              Kleiderschrank Import / Export &amp; Backup
            </h2>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
              Strukturierter Datenaustausch, JSON-Import sowie lokales Setup.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Import/Export-Modal schließen"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="shrink-0 px-4 sm:px-6 pt-3 border-b border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between flex-wrap gap-2.5 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800 overflow-x-auto scrollbar-none flex-nowrap w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveSection('export_llm')}
              className={`px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 touch-manipulation active:scale-95 ${
                activeSection === 'export_llm'
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              1. Export &amp; Prompt
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('import_json')}
              className={`px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 touch-manipulation active:scale-95 ${
                activeSection === 'import_json'
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              2. JSON-Import
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('docker_mcp')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 touch-manipulation active:scale-95 ${
                activeSection === 'docker_mcp'
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              <span>3. Docker &amp; MCP</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDownloadJsonBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-medium text-zinc-200 hover:bg-zinc-800 cursor-pointer whitespace-nowrap touch-manipulation active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>.json Backup</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeSection === 'export_llm' && (
            <div className="space-y-5">
              {/* 3 Export Format Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setExportTemplate('llm_analysis')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    exportTemplate === 'llm_analysis'
                      ? 'border-amber-400 bg-amber-500/10 text-zinc-100'
                      : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>LLM-Analyse + Schrank + Schema</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                    Übergibt dein Biometrie-Profil, alle {garments.length} Teile und das strikte JSON-Schema an ChatGPT/Claude/Gemini zur Analyse & Ergänzung.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setExportTemplate('llm_photo_converter')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    exportTemplate === 'llm_photo_converter'
                      ? 'border-amber-400 bg-amber-500/10 text-zinc-100'
                      : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
                    <FileCode2 className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>Fotos / Textliste → JSON-Prompt</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                    Prompt-Vorlage mit allen erlaubten Enums: Lade Fotos oder eine Textliste in ein LLM hoch und erhalte fertiges Import-JSON.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setExportTemplate('raw_json')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    exportTemplate === 'raw_json'
                      ? 'border-amber-400 bg-amber-500/10 text-zinc-100'
                      : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-100">
                    <FileJson className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Reiner JSON-Schrank-Export</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                    Komplettes JSON-Backup ({garments.length} Kleidungsstücke + Biometrie-Profil) zum Kopieren oder Weiterverarbeiten.
                  </p>
                </button>
              </div>

              {/* Copy Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-300">
                    Vorschau ({exportTextContent.length.toLocaleString('de-DE')} Zeichen)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(exportTextContent, exportTemplate)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-xs font-semibold text-zinc-950 transition-colors cursor-pointer"
                  >
                    {copiedKey === exportTemplate ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>In Zwischenablage kopiert!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Prompt / JSON kopieren</span>
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  readOnly
                  aria-label="Exportierter Prompt oder JSON-Code"
                  value={exportTextContent}
                  rows={12}
                  className="w-full rounded-xl bg-zinc-900/90 border border-zinc-800 p-4 text-xs font-mono text-zinc-300 focus:outline-none leading-relaxed"
                />
              </div>
            </div>
          )}

          {activeSection === 'import_json' && (
            <div className="space-y-5">
              {importSuccessBanner && (
                <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{importSuccessBanner}</span>
                </div>
              )}

              {/* Import Mode Toggle + File Upload / Sample */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      importMode === 'merge'
                        ? 'bg-zinc-100 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    Zum Schrank hinzufügen (Merge)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      importMode === 'replace'
                        ? 'bg-zinc-100 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    Schrank komplett ersetzen (Replace)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setImportText(SAMPLE_LLM_SNIPPET)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-amber-300 cursor-pointer whitespace-nowrap"
                  >
                    Beispiel-LLM-Antwort einfügen
                  </button>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-200 cursor-pointer whitespace-nowrap">
                    <Upload className="w-3.5 h-3.5 text-sky-400" />
                    <span>.json Datei wählen</span>
                    <input
                      type="file"
                      accept="application/json,.json,.txt,.md"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Paste Textarea */}
              <div>
                <label htmlFor="llm-json-import-input" className="block text-xs font-medium text-zinc-300 mb-1.5">
                  JSON-Array oder LLM-Antwort (inkl. ```json Codeblock) hier einfügen:
                </label>
                <textarea
                  id="llm-json-import-input"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  rows={8}
                  placeholder={`Füge hier das JSON-Array vom LLM ein, z.B.:\n[\n  {\n    "name": "Merino Pullover Salbeigrün",\n    "category": "mid_layer",\n    "subcategory": "knit_sweater",\n    "colorName": "Salbeigrün",\n    "colorHex": "#8F9779"\n  }\n]`}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-600 leading-relaxed"
                />
              </div>

              {/* Live Validation & Preview */}
              {parsedImport && (
                <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
                  {!parsedImport.ok ? (
                    <div className="flex items-start gap-2 text-xs text-rose-400">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{parsedImport.error}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
                        <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                          <Check className="w-4 h-4" />
                          <span>
                            {parsedImport.garments.length} valide{' '}
                            {parsedImport.garments.length === 1
                              ? 'Kleidungsstück'
                              : 'Kleidungsstücke'}{' '}
                            erkannt (HSL & Biometrie automatisch berechnet)
                          </span>
                        </div>
                        {parsedImport.profile && (
                          <span className="text-xs text-sky-300 font-mono">
                            + Biometrie-Profil enthalten
                          </span>
                        )}
                      </div>

                      {parsedImport.warnings.length > 0 && (
                        <div className="text-[11px] text-amber-300 space-y-0.5">
                          {parsedImport.warnings.map((w, i) => (
                            <p key={i}>Hinweis: {w}</p>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
                        {parsedImport.garments.map((g) => {
                          const bio = scoreGarmentBiometrics(g, profile);
                          return (
                            <div
                              key={g.id}
                              className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/90"
                            >
                              <GarmentVector
                                type={g.subcategory}
                                colorHex={g.colorHex}
                                texture={g.texture}
                                neckline={g.neckline}
                                className="w-10 h-10 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-zinc-100 truncate">
                                  {g.name}
                                </p>
                                <p className="text-[10px] text-zinc-400 truncate">
                                  {CATEGORY_LABELS[g.category].split(' ')[0]} ·{' '}
                                  {SUBCATEGORY_LABELS[g.subcategory]}
                                </p>
                                <p className="text-[10px] font-mono text-emerald-400">
                                  {bio.score}% Biometrie-Match · {g.colorHex}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {activeSection === 'docker_mcp' && (
            <div className="space-y-6">
              {/* Top Architecture Overview */}
              <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <h3 className="text-sm font-semibold text-zinc-100">
                      Integrierter Model Context Protocol (MCP) Server aktiv
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                    <span>HTTP: POST /mcp</span>
                    <span>·</span>
                    <span>STDIO: npx tsx mcp-server.ts</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Dein Kleiderschrank wird im Home-Setup synchron in{' '}
                  <code className="text-zinc-200 font-mono">./data/wardrobe-store.json</code>{' '}
                  gespeichert. Ein externes LLM (Claude Desktop, Cursor, OpenWebUI) kann über MCP
                  direkt Kleidungsstücke anlegen, Waschstati ändern, Outfits für das heutige Wetter
                  berechnen oder den Gap-Analyzer abfragen.
                </p>

                {/* Live MCP Tool Tester */}
                <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={mcpTesting}
                      onClick={() => runLiveMcpRpcTest('tools/list')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-xs font-semibold text-zinc-950 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>MCP tools/list testen</span>
                    </button>
                    <button
                      type="button"
                      disabled={mcpTesting}
                      onClick={() =>
                        runLiveMcpRpcTest('tools/call', {
                          name: 'add_garment',
                          arguments: {
                            name: 'MCP-Test: Schweres Overshirt Salbeigrün',
                            category: 'mid_layer',
                            subcategory: 'overshirt',
                            colorName: 'Salbeigrün',
                            colorHex: '#8F9779',
                            fit: 'relaxed',
                            neckline: 'shirt_collar',
                            texture: 'twill_chino',
                            thermalRating: 3,
                            formality: 3,
                          },
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 text-xs font-medium text-amber-200 cursor-pointer"
                    >
                      <Terminal className="w-3.5 h-3.5 text-amber-400" />
                      <span>Live via MCP: Kleidungsstück anlegen</span>
                    </button>
                    <button
                      type="button"
                      disabled={mcpTesting}
                      onClick={() =>
                        runLiveMcpRpcTest('tools/call', {
                          name: 'analyze_wardrobe_gaps',
                          arguments: {},
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-xs font-medium text-zinc-200 cursor-pointer"
                    >
                      <span>MCP: Gap-Analyzer abrufen</span>
                    </button>
                  </div>

                  {onRefreshFromServer && (
                    <button
                      type="button"
                      onClick={onRefreshFromServer}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Schrank vom Server synchronisieren</span>
                    </button>
                  )}
                </div>

                {mcpTestOutput && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400">
                      <span>Live JSON-RPC 2.0 Antwort von POST /mcp:</span>
                      <button
                        type="button"
                        onClick={() => setMcpTestOutput('')}
                        className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
                      >
                        Ausblenden
                      </button>
                    </div>
                    <pre className="max-h-48 overflow-y-auto rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-[11px] font-mono text-zinc-300 leading-relaxed">
                      {mcpTestOutput}
                    </pre>
                  </div>
                )}
              </div>

              {/* 9 Available MCP Tools Reference */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-semibold text-zinc-200">
                  Verfügbare MCP-Tools ({MCP_TOOLS_MANIFEST.length} deterministische Werkzeuge)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {MCP_TOOLS_MANIFEST.map((tool) => (
                    <div
                      key={tool.name}
                      className="rounded-xl bg-zinc-900/45 border border-zinc-800/90 p-3 space-y-1"
                    >
                      <p className="text-xs font-mono font-semibold text-amber-300">
                        {tool.name}
                      </p>
                      <p className="text-[11px] text-zinc-400 leading-snug line-clamp-3">
                        {tool.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Config Snippets: Claude Desktop / Cursor + Docker Compose */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-300">
                      Claude Desktop / Cursor MCP-Config (STDIO via Docker)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(CLAUDE_DESKTOP_DOCKER_CONFIG, 'claude_mcp')
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-[11px] text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                    >
                      {copiedKey === 'claude_mcp' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Kopiert</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Kopieren</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="rounded-xl bg-zinc-900 border border-zinc-800 p-3.5 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                    {CLAUDE_DESKTOP_DOCKER_CONFIG}
                  </pre>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-300">
                      docker-compose.yml (`docker compose up -d --build`)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(DOCKER_COMPOSE_SNIPPET, 'docker_compose')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700 text-[11px] text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                    >
                      {copiedKey === 'docker_compose' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Kopiert</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Kopieren</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="rounded-xl bg-zinc-900 border border-zinc-800 p-3.5 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                    {DOCKER_COMPOSE_SNIPPET}
                  </pre>
                </div>
              </div>

              {/* Open-Source Repository Setup (thread-graph / MIT / GitHub Pages / Modular Engine) */}
              <div className="rounded-xl bg-zinc-900/45 border border-zinc-800 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-100">
                      Open-Source Setup: <span className="font-mono text-amber-300">thread-graph</span> (MIT License · README.md · GitHub Pages Action)
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Bereit für GitHub Pages / Cloudflare Pages (100% clientseitiges IndexedDB-Fallback) & Pull Requests auf <code className="font-mono text-zinc-200">src/engine/</code>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(OPEN_SOURCE_PITCH, 'os_pitch')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-[11px] text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                  >
                    {copiedKey === 'os_pitch' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Pitch kopiert</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>GitHub Repo-Pitch kopieren</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/90 text-xs font-mono text-zinc-300 leading-relaxed">
                  &ldquo;{OPEN_SOURCE_PITCH}&rdquo;
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/80">
                    <p className="font-mono font-semibold text-zinc-200">src/engine/styleRules.ts</p>
                    <p className="text-zinc-400 mt-0.5">
                      Deklarative Matrizen (Fit-Proportionen, Textur-Kontrast, Kragen/Haarschnitt-Framing).
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/80">
                    <p className="font-mono font-semibold text-zinc-200">src/components/GarmentVector.tsx</p>
                    <p className="text-zinc-400 mt-0.5">
                      25 modulare SVG-Silhouetten + Textur-Patterns — ideal für Community-PRs.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/80">
                    <p className="font-mono font-semibold text-zinc-200">.github/workflows/deploy-pages.yml</p>
                    <p className="text-zinc-400 mt-0.5">
                      Automatischer Unit-Test-Lauf & 0-Backend Live-Demo Deployment auf GitHub Pages.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky bottom action bar (Thumb Zone) */}
        <div className="shrink-0 sticky bottom-0 z-10 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-4 sm:px-6 py-3.5 sm:py-4 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 min-h-[42px] rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-100 text-center cursor-pointer touch-manipulation"
          >
            Schließen
          </button>

          {activeSection === 'import_json' && (
            <button
              type="button"
              disabled={!parsedImport || !parsedImport.ok || parsedImport.garments.length === 0}
              onClick={handleExecuteImport}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[42px] rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold text-zinc-950 transition-colors cursor-pointer touch-manipulation active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>
                {parsedImport && parsedImport.ok && parsedImport.garments.length > 0
                  ? `${parsedImport.garments.length} ${
                      parsedImport.garments.length === 1 ? 'Teil' : 'Teile'
                    } jetzt importieren (${importMode === 'merge' ? 'Hinzufügen' : 'Ersetzen'})`
                  : 'JSON zum Importieren einfügen'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
