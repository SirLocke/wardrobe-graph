import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Database,
  Download,
  HelpCircle,
  Pipette,
  RotateCcw,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  deriveScopeFromTargets,
  normalizeWardrobeScopes,
  WARDROBE_MULTI_SCOPE_META,
  WARDROBE_SCOPE_META,
} from '../data/seedData';
import { deriveSeasonPalette, hexToHsl } from '../engine/colorMath';
import {
  BiometricProfile,
  ChromaLevel,
  ContrastLevel,
  FacialHair,
  Garment,
  HaircutStyle,
  Undertone,
  ValueLevel,
  WardrobeScope,
  WardrobeScopeTarget,
} from '../types/wardrobe';

interface BiometricProfileViewProps {
  profile: BiometricProfile;
  garments: Garment[];
  onUpdateProfile: (next: BiometricProfile) => Promise<void>;
  onOpenImportExportModal: () => void;
  onExportBackup: () => void;
  onImportBackupFile: (file: File) => Promise<void>;
  onResetToSeed: () => Promise<void>;
  onStartOwnClosetWizard?: () => void;
}

const EYE_PRESETS = [
  { name: 'Blau', hex: '#3B78A8' },
  { name: 'Blaugrau', hex: '#526878' },
  { name: 'Hellblau / Eisblau', hex: '#7BA7C7' },
  { name: 'Grün-Braun / Haselnuss', hex: '#6E7D4E' },
  { name: 'Grün / Graugrün', hex: '#4F6D5A' },
  { name: 'Hellbraun / Bernstein', hex: '#8B6528' },
  { name: 'Dunkelbraun', hex: '#3B281E' },
];

const HAIR_PRESETS = [
  { name: 'Kupferblond / Goldbraun', hex: '#8C6244' },
  { name: 'Dunkelblond / Aschbraun', hex: '#5A4D41' },
  { name: 'Mittelbraun / Kastanie', hex: '#4A3222' },
  { name: 'Dunkelbraun / Schwarzbraun', hex: '#231C18' },
  { name: 'Schwarz', hex: '#121214' },
  { name: 'Blond / Honigblond', hex: '#9C7A4C' },
  { name: 'Hellblond / Platin', hex: '#D8C39D' },
  { name: 'Grau / Silbergrau', hex: '#7A7D82' },
  { name: 'Kupfer / Rotbraun', hex: '#8C3D26' },
];

type SelfieTarget = 'skin' | 'eye' | 'hair';

export const BiometricProfileView: React.FC<BiometricProfileViewProps> = ({
  profile,
  garments,
  onUpdateProfile,
  onOpenImportExportModal,
  onExportBackup,
  onImportBackupFile,
  onResetToSeed,
  onStartOwnClosetWizard,
}) => {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
  const [activeSelfieTarget, setActiveSelfieTarget] = useState<SelfieTarget>('skin');
  const [showSelfieTool, setShowSelfieTool] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const seasonPalette = useMemo(() => deriveSeasonPalette(profile), [profile]);

  const handleCopyHex = (hex: string, name: string) => {
    navigator.clipboard?.writeText(hex);
    setCopiedHex(hex);
    setStatusBanner(`Farbe „${name}“ wurde kopiert.`);
    setTimeout(() => {
      setCopiedHex((prev) => (prev === hex ? null : prev));
    }, 2000);
  };

  useEffect(() => {
    if (!showSelfieTool || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (selfieDataUrl) {
      const img = new Image();
      img.onload = () => {
        const maxW = 360;
        const scale = Math.min(maxW / img.width, 1);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = selfieDataUrl;
    } else {
      canvas.width = 360;
      canvas.height = 160;
      ctx.fillStyle = profile.skinHex || '#C8A98E';
      ctx.fillRect(0, 0, 120, 160);
      ctx.fillStyle = profile.eyeHex || '#6E7D4E';
      ctx.fillRect(120, 0, 120, 160);
      ctx.fillStyle = profile.hairHex || '#5A4D41';
      ctx.fillRect(240, 0, 120, 160);

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 128, 360, 32);
      ctx.fillStyle = '#f4f4f5';
      ctx.font = '11px sans-serif';
      ctx.fillText('1. Hautton', 10, 148);
      ctx.fillText('2. Augenfarbe', 142, 148);
      ctx.fillText('3. Haarfarbe', 262, 148);
    }
  }, [showSelfieTool, selfieDataUrl, profile.skinHex, profile.eyeHex, profile.hairHex]);

  const handleCanvasPipetteClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex =
      '#' +
      [pixel[0], pixel[1], pixel[2]]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

    const nextProfile = { ...profile };
    if (activeSelfieTarget === 'skin') {
      nextProfile.skinHex = hex;
      setActiveSelfieTarget('eye');
    } else if (activeSelfieTarget === 'eye') {
      nextProfile.eyeHex = hex;
      nextProfile.eyeColorName = 'Aus Foto gewählt';
      setActiveSelfieTarget('hair');
    } else {
      nextProfile.hairHex = hex;
      nextProfile.hairColorName = 'Aus Foto gewählt';
    }

    const skinL = hexToHsl(nextProfile.skinHex).l;
    const hairL = hexToHsl(nextProfile.hairHex).l;
    const deltaL = Math.abs(skinL - hairL);
    if (deltaL < 25) nextProfile.contrastLevel = 'low';
    else if (deltaL <= 52) nextProfile.contrastLevel = 'medium';
    else nextProfile.contrastLevel = 'high';

    onUpdateProfile(nextProfile);
    setStatusBanner('Farbe aus deinem Foto übernommen!');
  };

  return (
    <div className="space-y-8">
      {/* Top Header, Own Database Explanation & Backup Controls */}
      <section className="rounded-2xl bg-zinc-900/50 border border-zinc-800/90 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
              Mein Typ, Frisur &amp; persönliche Farben (Einfach erklärt)
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Keine Fachbegriffe nötig: Finde mit einfachen Alltags-Checks heraus, welche Farben und Kragenformen dir am besten stehen.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onStartOwnClosetWizard && (
              <button
                type="button"
                onClick={onStartOwnClosetWizard}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer whitespace-nowrap"
              >
                <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Eigenen Schrank einrichten (Wizard)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowSelfieTool((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-medium text-zinc-200 hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span>Farben per Foto bestimmen</span>
            </button>

            <button
              type="button"
              onClick={onOpenImportExportModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 border border-amber-500/40 text-xs font-medium text-amber-200 hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>Datenbank &amp; Backup ({garments.length})</span>
            </button>

            <button
              type="button"
              onClick={onExportBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-200 hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Backup speichern</span>
            </button>

            <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-200 hover:bg-zinc-800 cursor-pointer whitespace-nowrap">
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Backup laden</span>
              <input
                type="file"
                accept="application/json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportBackupFile(f);
                }}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={onResetToSeed}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer whitespace-nowrap"
              title="Beispiel-Kleiderschrank wiederherstellen"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Auf Beispiele zurücksetzen</span>
            </button>
          </div>
        </div>

        {statusBanner && (
          <div className="px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-amber-300 flex items-center justify-between">
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-zinc-500 hover:text-zinc-300 ml-3 cursor-pointer"
            >
              Schließen
            </button>
          </div>
        )}

        {/* Daylight Selfie Pipette Drawer */}
        {showSelfieTool && (
          <div className="pt-4 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-5 flex flex-col items-center">
              <canvas
                ref={canvasRef}
                onClick={handleCanvasPipetteClick}
                className="rounded-xl border border-zinc-700 cursor-crosshair max-w-full shadow-lg"
              />
              <div className="mt-2 flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:underline cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Eigenes Tageslicht-Foto auswählen</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') setSelfieDataUrl(reader.result);
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="md:col-span-7 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <Pipette className="w-4 h-4 text-amber-400" />
                <span>Haut-, Augen- &amp; Haarfarbe per Klick aus Foto übernehmen</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Wähle unten einen Punkt aus und tippe anschließend im Foto auf die entsprechende Stelle.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'skin', label: '1. Hautton', hex: profile.skinHex },
                    { id: 'eye', label: '2. Augenfarbe', hex: profile.eyeHex },
                    { id: 'hair', label: '3. Haarfarbe', hex: profile.hairHex },
                  ] as const
                ).map((pt) => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => setActiveSelfieTarget(pt.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      activeSelfieTarget === pt.id
                        ? 'border-amber-400 bg-amber-500/10 text-zinc-100'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: pt.hex }}
                      />
                      <span className="text-xs font-medium truncate">{pt.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Main 2-Column Split: Calibration Form (Left) + Generated Style Passport (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Calibration Form (6 cols) */}
        <section className="lg:col-span-6 rounded-2xl bg-zinc-900/45 border border-zinc-800/90 p-5 sm:p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
            <h2 className="text-base font-semibold text-zinc-100">
              Deine 5 einfachen Angaben
            </h2>
            <button
              type="button"
              onClick={() =>
                onUpdateProfile({
                  ...profile,
                  undertone: 'neutral',
                  contrastLevel: 'medium',
                  chromaLevel: 'muted',
                })
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-amber-400/50 text-[11px] text-amber-300 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Unsicher? „Neutral“ setzen (passt immer)</span>
            </button>
          </div>

          {/* Wardrobe Scope (Mehrfachauswahl: Frauen / Männer / Unisex) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-200">
                Welche Kleidungsstücke möchtest du nutzen? (Mehrfachauswahl)
              </label>
              <span className="text-[11px] text-amber-400 font-medium">
                {normalizeWardrobeScopes(profile)
                  .map((s) => WARDROBE_MULTI_SCOPE_META[s].shortDe)
                  .join(' + ')}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['womenswear', 'menswear', 'unisex'] as WardrobeScopeTarget[]).map((sc) => {
                const currentScopes = normalizeWardrobeScopes(profile);
                const isChecked = currentScopes.includes(sc);
                const meta = WARDROBE_MULTI_SCOPE_META[sc];
                return (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => {
                      let next: WardrobeScopeTarget[];
                      if (currentScopes.includes(sc)) {
                        if (currentScopes.length === 1) return; // Mindestens eine Kategorie aktiv halten
                        next = currentScopes.filter((s) => s !== sc);
                      } else {
                        next = [...currentScopes, sc];
                      }
                      const derived = deriveScopeFromTargets(next);
                      onUpdateProfile({
                        ...profile,
                        wardrobeScopes: next,
                        wardrobeScope: derived,
                      });
                    }}
                    className={`px-3 py-2.5 min-h-[42px] rounded-xl border text-xs font-medium transition-all cursor-pointer touch-manipulation active:scale-95 flex items-center justify-between gap-2 ${
                      isChecked
                        ? 'border-amber-400 bg-amber-500/10 text-zinc-100 font-semibold ring-1 ring-amber-400/30'
                        : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span>{meta.labelDe}</span>
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                        isChecked
                          ? 'bg-amber-400 text-zinc-950 font-bold'
                          : 'border border-zinc-600 bg-zinc-900'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1. Skin Undertone with Veins, Sun & T-Shirt Checks (Unisex) */}
          <div className="space-y-2.5">
            <div>
              <label className="block text-xs font-semibold text-zinc-200">
                1. Dein Hautton &amp; Unterton (3 einfache Alltags-Checks – kein Schmuck nötig)
              </label>
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                <strong>Adern am Handgelenk:</strong> Grünlich = Warm/Oliv · Bläulich/Violett = Kühl · Blaugrün = Neutral.<br />
                <strong>Sonnen-Check:</strong> Wirst du schnell braun (Warm/Oliv) oder schnell rot/Sonnenbrand (Kühl)?<br />
                <strong>T-Shirt-Check:</strong> Steht dir Off-White/Creme besser als Reinweiß (Warm/Oliv) oder strahlendes Reinweiß (Kühl)?
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(
                [
                  {
                    id: 'olive',
                    title: 'Leicht gebräunt / Oliv (Warm-Neutral)',
                    testHint: '🌿 Adern wirken grünlich · bräunt sehr schnell',
                    hint: 'Dir stehen Naturtöne wie Olivgrün, Salbei, Khaki, Beige & warmes Braun besonders gut.',
                    metalHint: 'Gold, Bronze oder mattes Titan',
                  },
                  {
                    id: 'warm',
                    title: 'Warm / Goldig',
                    testHint: '☀️ Goldiger Teint · Creme/Off-White schmeichelt',
                    hint: 'Creme, Kamel, Senfgelb, Terrakotta & warme Holztöne lassen dich sofort frisch aussehen.',
                    metalHint: 'Gold, Messing oder warme Lederbänder',
                  },
                  {
                    id: 'cool',
                    title: 'Kühl / Rosig-Hell',
                    testHint: '❄️ Adern wirken bläulich/violett · neigt zu Sonnenbrand',
                    hint: 'Dir stehen klare Farben wie Dunkelblau, Steingrau, kühles Weiß, Schwarz & Weinrot.',
                    metalHint: 'Silber, Edelstahl, Weißgold oder Chrom',
                  },
                  {
                    id: 'neutral',
                    title: 'Ausgewogen Neutral („Mir steht beides“)',
                    testHint: '⚖️ Adern blaugrün · wird nach leichter Rötung braun',
                    hint: 'Weder stark warm noch kühl: Dunkelblau & Anthrazit passen genauso wie Oliv & Sand.',
                    metalHint: 'Sowohl Edelstahl/Silber als auch Gold passen super',
                  },
                ] as const
              ).map((u) => {
                const active = profile.undertone === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => onUpdateProfile({ ...profile, undertone: u.id as Undertone })}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'border-amber-400 bg-amber-500/15 text-zinc-100 ring-1 ring-amber-400/30'
                        : 'border-zinc-800/80 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <p className="text-xs font-semibold text-zinc-100">{u.title}</p>
                    <p className="text-[11px] text-amber-300 font-medium mt-0.5">{u.testHint}</p>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{u.hint}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">Metalle/Uhren: {u.metalHint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Contrast & 3. Chroma with plain explanations */}
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-2">
              <label htmlFor="profile-contrast" className="block text-xs font-semibold text-zinc-200">
                2. Wie stark ist der Unterschied zwischen deiner Haarfarbe und deiner Haut?
              </label>
              <p className="text-[11px] text-zinc-400">
                Bestimmt, ob dir eher ruhige Ton-in-Ton-Outfits oder starke Hell-Dunkel-Kombinationen (z. B. weißes T-Shirt unter dunkler Jacke) besser stehen.
              </p>
              <select
                id="profile-contrast"
                value={profile.contrastLevel}
                onChange={(e) =>
                  onUpdateProfile({ ...profile, contrastLevel: e.target.value as ContrastLevel })
                }
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-100"
              >
                <option value="low">Sanft / Ähnlich (z. B. helle Haut &amp; blonde/hellbraune Haare)</option>
                <option value="medium">Mittel / Normal (z. B. mittlere Haut &amp; braune/dunkelblonde Haare)</option>
                <option value="high">Stark (z. B. sehr dunkle/schwarze Haare &amp; helle Haut)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-2">
                <label htmlFor="profile-chroma" className="block text-xs font-semibold text-zinc-200">
                  3. Welche Farben trägst du lieber?
                </label>
                <p className="text-[11px] text-zinc-400">
                  Ruhige, dezente Naturtöne oder kräftige, leuchtende Farben?
                </p>
                <select
                  id="profile-chroma"
                  value={profile.chromaLevel}
                  onChange={(e) =>
                    onUpdateProfile({ ...profile, chromaLevel: e.target.value as ChromaLevel })
                  }
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-100"
                >
                  <option value="muted">Ruhige, sanfte Farben (Salbei, Beige, Navy, Grau)</option>
                  <option value="moderate">Normale Alltagsfarben (Ausgewogen)</option>
                  <option value="bright">Kräftige, leuchtende Farben (Klar)</option>
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-2">
                <label htmlFor="profile-value" className="block text-xs font-semibold text-zinc-200">
                  Bevorzugte Helligkeit
                </label>
                <p className="text-[11px] text-zinc-400">
                  Trägst du lieber helle, mittlere oder dunkle Kleidung?
                </p>
                <select
                  id="profile-value"
                  value={profile.valueLevel}
                  onChange={(e) =>
                    onUpdateProfile({ ...profile, valueLevel: e.target.value as ValueLevel })
                  }
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-zinc-100"
                >
                  <option value="light">Eher helle Farben (Creme, Beige, Hellblau)</option>
                  <option value="medium">Ausgewogen (Mittel)</option>
                  <option value="dark">Eher dunkle Farben (Schwarz, Dunkelblau, Braun)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4. Eye Color Picker */}
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-200">
                4. Deine Augenfarbe (Warum fragen wir das?)
              </label>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Wenn ein Oberteil deine Augenfarbe leicht aufgreift (z. B. Olivgrün bei grün-braunen Augen oder Blaugrau bei blauen Augen), leuchten deine Augen automatisch mehr.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EYE_PRESETS.map((eye) => {
                const active = profile.eyeHex.toLowerCase() === eye.hex.toLowerCase();
                return (
                  <button
                    key={eye.name}
                    type="button"
                    onClick={() =>
                      onUpdateProfile({ ...profile, eyeColorName: eye.name, eyeHex: eye.hex })
                    }
                    className={`flex items-center gap-2 p-2.5 min-h-[40px] rounded-lg border text-left text-xs transition-all cursor-pointer touch-manipulation active:scale-95 ${
                      active
                        ? 'border-amber-400 bg-amber-500/15 text-zinc-100 font-semibold'
                        : 'border-zinc-800/80 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: eye.hex }}
                    />
                    <span className="truncate">{eye.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hair Color Picker */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-200">Deine Haarfarbe</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {HAIR_PRESETS.map((hair) => {
                const active = profile.hairHex.toLowerCase() === hair.hex.toLowerCase();
                return (
                  <button
                    key={hair.name}
                    type="button"
                    onClick={() =>
                      onUpdateProfile({ ...profile, hairColorName: hair.name, hairHex: hair.hex })
                    }
                    className={`flex items-center gap-2 p-2.5 min-h-[40px] rounded-lg border text-left text-xs transition-all cursor-pointer touch-manipulation active:scale-95 ${
                      active
                        ? 'border-amber-400 bg-amber-500/15 text-zinc-100 font-semibold'
                        : 'border-zinc-800/80 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: hair.hex }}
                    />
                    <span className="truncate">{hair.name.split(' / ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Haircut Style & Facial Hair Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-haircut" className="block text-xs font-semibold text-zinc-200 mb-1">
                5. Deine Haarlänge (für passende Kragen)
              </label>
              <select
                id="profile-haircut"
                value={profile.haircutStyle}
                onChange={(e) =>
                  onUpdateProfile({ ...profile, haircutStyle: e.target.value as HaircutStyle })
                }
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100"
              >
                <option value="short_fade_structured_top">
                  Kurze Haare (Seiten kürzer, oben etwas länger)
                </option>
                <option value="medium_textured_flow">
                  Mittellange Haare / Bob / Übergangslänge
                </option>
                <option value="long_hair">Lange Haare (über die Schultern)</option>
                <option value="buzz_very_short">Sehr kurze Haare / Glatze</option>
              </select>
            </div>

            <div>
              <label htmlFor="profile-beard" className="block text-xs font-semibold text-zinc-200 mb-1">
                Bart (optional)
              </label>
              <select
                id="profile-beard"
                value={profile.facialHair}
                onChange={(e) =>
                  onUpdateProfile({ ...profile, facialHair: e.target.value as FacialHair })
                }
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100"
              >
                <option value="clean_shaven">Kein Bart / Glattrasiert</option>
                <option value="stubble">3-Tage-Bart</option>
                <option value="short_beard">Kurzer Vollbart</option>
                <option value="full_beard">Längerer Vollbart</option>
              </select>
            </div>
          </div>
        </section>

        {/* Right Column: Generated Style Passport (6 cols) */}
        <section className="lg:col-span-6 rounded-2xl bg-zinc-900/45 border border-zinc-800/90 p-5 sm:p-6 space-y-6">
          <div className="border-b border-zinc-800 pb-4">
            <p className="text-xs font-semibold text-amber-400">
              Dein Ergebnis (automatisch für alle Outfit-Vorschläge aktiv)
            </p>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-100 mt-1">
              {seasonPalette.seasonName}
            </h2>
            <p className="text-xs font-medium text-emerald-300 mt-1">
              {seasonPalette.seasonSubtitle}
            </p>
            <p className="text-xs text-zinc-300 mt-2 leading-relaxed">
              {seasonPalette.description}
            </p>
          </div>

          {/* 12 Power Colors */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-200">
                Deine besten Farben (Für Oberteile, Hoodies, Blusen, Pullover &amp; Jacken)
              </h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {seasonPalette.powerColors.map((swatch) => (
                <button
                  key={swatch.name}
                  type="button"
                  onClick={() => handleCopyHex(swatch.hex, swatch.name)}
                  className="group p-2 min-h-[60px] rounded-xl bg-zinc-950 border border-zinc-800/90 hover:border-zinc-600 text-left transition-all cursor-pointer touch-manipulation active:scale-95"
                >
                  <div
                    className="w-full h-7 rounded-lg mb-1.5 border border-white/15 flex items-center justify-end p-1"
                    style={{ backgroundColor: swatch.hex }}
                  >
                    {copiedHex === swatch.hex ? (
                      <Check className="w-3 h-3 text-white drop-shadow" />
                    ) : (
                      <Copy className="w-3 h-3 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-zinc-200 truncate">{swatch.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 6 Core Neutrals */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-zinc-200">
              Basis-Farben (Perfekt für Hosen, Jeans, Röcke, Mäntel &amp; Schuhe)
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {seasonPalette.coreNeutrals.map((swatch) => (
                <button
                  key={swatch.name}
                  type="button"
                  onClick={() => handleCopyHex(swatch.hex, swatch.name)}
                  className="p-2 min-h-[56px] rounded-xl bg-zinc-950 border border-zinc-800/90 hover:border-zinc-600 text-left transition-all cursor-pointer touch-manipulation active:scale-95"
                >
                  <div
                    className="w-full h-6 rounded-md mb-1.5 border border-white/15"
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <p className="text-[11px] font-medium text-zinc-200 truncate">{swatch.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Top 3 Necklines/Collars based on Haircut */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-zinc-200">
              Welche Ausschnitte &amp; Kragen passen am besten zu deiner Haarlänge?
            </h3>
            <div className="space-y-2">
              {seasonPalette.recommendedNecklines.map((rec, i) => (
                <div
                  key={rec.neckline}
                  className="rounded-xl bg-zinc-950/80 border border-zinc-800/80 p-3"
                >
                  <p className="text-xs font-semibold text-zinc-100">
                    {i + 1}. {rec.label}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{rec.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 6 Avoid Colors */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-rose-300">
              Farben, die direkt am Gesicht eher unruhig wirken
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {seasonPalette.avoidColors.map((swatch) => (
                <div
                  key={swatch.name}
                  className="p-2 rounded-xl bg-zinc-950/60 border border-rose-950/60 text-left opacity-85"
                >
                  <div
                    className="w-full h-5 rounded mb-1 border border-white/15"
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <p className="text-[10px] font-medium text-zinc-300 truncate">{swatch.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
