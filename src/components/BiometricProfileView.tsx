import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Download,
  Pipette,
  RotateCcw,
  Upload,
} from 'lucide-react';
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
} from '../types/wardrobe';

interface BiometricProfileViewProps {
  profile: BiometricProfile;
  garments: Garment[];
  onUpdateProfile: (next: BiometricProfile) => Promise<void>;
  onOpenImportExportModal: () => void;
  onExportBackup: () => void;
  onImportBackupFile: (file: File) => Promise<void>;
  onResetToSeed: () => Promise<void>;
}

const EYE_PRESETS = [
  { name: 'Grün-Haselnuss (Green-Hazel)', hex: '#6E7D4E' },
  { name: 'Waldgrün / Salbei', hex: '#4F6D5A' },
  { name: 'Haselnuss-Bernstein', hex: '#8B6331' },
  { name: 'Dunkelbraun / Espresso', hex: '#3B281E' },
  { name: 'Stahlblau / Graublau', hex: '#54728C' },
  { name: 'Eisblau', hex: '#7BA7C7' },
];

const HAIR_PRESETS = [
  { name: 'Dunkelblond / Aschbraun', hex: '#5A4D41' },
  { name: 'Mittelbraun / Kastanie', hex: '#4A3222' },
  { name: 'Espresso / Schwarzbraun', hex: '#231C18' },
  { name: 'Tiefschwarz', hex: '#121214' },
  { name: 'Honigblond / Goldblond', hex: '#9C7A4C' },
  { name: 'Salz & Pfeffer / Silbergrau', hex: '#7A7D82' },
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
    setStatusBanner(`Farbcode ${name} (${hex}) in die Zwischenablage kopiert.`);
    setTimeout(() => {
      setCopiedHex((prev) => (prev === hex ? null : prev));
    }, 2000);
  };

  // Render either uploaded selfie or built-in daylight calibration card onto canvas
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
      // Draw synthetic daylight calibration reference zones so user can test the pipette immediately
      canvas.width = 360;
      canvas.height = 160;
      // Skin zone
      ctx.fillStyle = profile.skinHex || '#C8A98E';
      ctx.fillRect(0, 0, 120, 160);
      // Eye zone
      ctx.fillStyle = profile.eyeHex || '#6E7D4E';
      ctx.fillRect(120, 0, 120, 160);
      // Hair zone
      ctx.fillStyle = profile.hairHex || '#5A4D41';
      ctx.fillRect(240, 0, 120, 160);

      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 128, 360, 32);
      ctx.fillStyle = '#f4f4f5';
      ctx.font = '11px sans-serif';
      ctx.fillText('1. Kieferlinie (Haut)', 10, 148);
      ctx.fillText('2. Iris (Auge)', 142, 148);
      ctx.fillText('3. Haaransatz', 262, 148);
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
      nextProfile.eyeColorName = `Kalibriert (${hex})`;
      setActiveSelfieTarget('hair');
    } else {
      nextProfile.hairHex = hex;
      nextProfile.hairColorName = `Kalibriert (${hex})`;
    }

    // Auto-calculate lightness contrast delta between skin and hair
    const skinL = hexToHsl(nextProfile.skinHex).l;
    const hairL = hexToHsl(nextProfile.hairHex).l;
    const deltaL = Math.abs(skinL - hairL);
    if (deltaL < 25) nextProfile.contrastLevel = 'low';
    else if (deltaL <= 52) nextProfile.contrastLevel = 'medium';
    else nextProfile.contrastLevel = 'high';

    onUpdateProfile(nextProfile);
    setStatusBanner(
      `Pipetten-Messung übernommen (${hex}). Empfohlener Haut-Haar-Kontrast: ${nextProfile.contrastLevel.toUpperCase()} (ΔL ${deltaL}%).`
    );
  };

  return (
    <div className="space-y-10">
      {/* Top Header & Backup Controls */}
      <section className="rounded-2xl bg-zinc-900/50 border border-zinc-800/90 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
              Biometrie-Kalibrierung & Style-Passport
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              12-Jahreszeiten-Farbmathematik, Augenfarben-Verstärker und Kragen-Haarschnitt-Geometrie
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowSelfieTool((prev) => !prev)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-medium text-zinc-200 hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5 text-amber-400" />
              <span>Tageslicht-Selfie-Pipette</span>
            </button>

            <button
              type="button"
              onClick={onOpenImportExportModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 border border-amber-500/40 text-xs font-medium text-amber-200 hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Import / Export & LLM-Schema ({garments.length})</span>
            </button>

            <button
              type="button"
              onClick={onExportBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-200 hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>.json Download</span>
            </button>

            <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-200 hover:bg-zinc-800 cursor-pointer whitespace-nowrap">
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>JSON Import</span>
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
              title="Starter-Garderobe (14 Teile) wiederherstellen"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Demo-Daten Reset</span>
            </button>
          </div>
        </div>

        {statusBanner && (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-amber-300 flex items-center justify-between">
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
          <div className="mt-5 pt-5 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-5 flex flex-col items-center">
              <canvas
                ref={canvasRef}
                onClick={handleCanvasPipetteClick}
                className="rounded-xl border border-zinc-700 cursor-crosshair max-w-full shadow-lg"
              />
              <div className="mt-2 flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:underline cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Eigenes Tageslicht-Selfie laden</span>
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
                <span>3-Punkt Biometrie-Pipette (Kieferlinie, Iris, Haaransatz)</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Wähle unten den Messpunkt und klicke anschließend in das Bild links. Aus dem
                Helligkeits-Delta zwischen Haut und Haar wird dein Kontrast-Level automatisch berechnet.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'skin', label: '1. Haut (Kiefer)', hex: profile.skinHex },
                    { id: 'eye', label: '2. Iris (Auge)', hex: profile.eyeHex },
                    { id: 'hair', label: '3. Haaransatz', hex: profile.hairHex },
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
                    <span className="block text-[10px] font-mono text-zinc-500 mt-1">
                      {pt.hex}
                    </span>
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
          <h2 className="text-base font-semibold text-zinc-100 border-b border-zinc-800 pb-3">
            01. Biometrische Parameter kalibrieren
          </h2>

          {/* Skin Undertone with Practical Visual Hints */}
          <div className="space-y-2.5">
            <label className="block text-xs font-medium text-zinc-300">
              Hautunterton (Venen-Test & Schmuck-Resonanz)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(
                [
                  {
                    id: 'olive',
                    title: 'Oliv / Warm-Neutral',
                    hint: 'Grünliche Venen, bräunt leicht, gedeckte Erd- & Salbeitöne wirken ruhig',
                  },
                  {
                    id: 'warm',
                    title: 'Warm (Gold/Pfirsich)',
                    hint: 'Grünliche Venen, Goldschmuck schmeichelt, warme Herbst-/Frühlingstöne',
                  },
                  {
                    id: 'cool',
                    title: 'Kühl (Rosé/Bläulich)',
                    hint: 'Blau-violette Venen, Silberschmuck harmoniert, Navy & kühles Burgunder',
                  },
                  {
                    id: 'neutral',
                    title: 'Neutral (Ausgewogen)',
                    hint: 'Blau-grüne Venen, sowohl Silber als auch gebürstetes Gold tragbar',
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
                        ? 'border-zinc-100 bg-zinc-900 text-zinc-100'
                        : 'border-zinc-800/80 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <p className="text-xs font-semibold text-zinc-100">{u.title}</p>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{u.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contrast, Chroma, Value */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="profile-contrast" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Kontrast-Level (Haut/Haar)
              </label>
              <select
                id="profile-contrast"
                value={profile.contrastLevel}
                onChange={(e) =>
                  onUpdateProfile({ ...profile, contrastLevel: e.target.value as ContrastLevel })
                }
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100"
              >
                <option value="low">Niedrig (ΔL &lt; 25%)</option>
                <option value="medium">Mittel (ΔL 25–55%)</option>
                <option value="high">Hoch (ΔL &gt; 55%)</option>
              </select>
            </div>

            <div>
              <label htmlFor="profile-chroma" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Chroma / Sättigungstyp
              </label>
              <select
                id="profile-chroma"
                value={profile.chromaLevel}
                onChange={(e) =>
                  onUpdateProfile({ ...profile, chromaLevel: e.target.value as ChromaLevel })
                }
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100"
              >
                <option value="muted">Gedämpft / Muted (Erdig)</option>
                <option value="moderate">Mittel / Moderate</option>
                <option value="bright">Klar / Bright (Hohe Strahlkraft)</option>
              </select>
            </div>

            <div>
              <label htmlFor="profile-value" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Gesamthelligkeit (Value)
              </label>
              <select
                id="profile-value"
                value={profile.valueLevel}
                onChange={(e) =>
                  onUpdateProfile({ ...profile, valueLevel: e.target.value as ValueLevel })
                }
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100"
              >
                <option value="light">Hell (Light)</option>
                <option value="medium">Mittel (Medium)</option>
                <option value="dark">Dunkel / Tief (Dark)</option>
              </select>
            </div>
          </div>

          {/* Eye Color Picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                Augenfarbe (für monochromatisches & komplementäres Hue-Echo)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Augenfarbe Hex"
                  value={profile.eyeHex}
                  onChange={(e) =>
                    onUpdateProfile({
                      ...profile,
                      eyeHex: e.target.value.toUpperCase(),
                      eyeColorName: `Custom (${e.target.value.toUpperCase()})`,
                    })
                  }
                  className="w-6 h-6 rounded bg-transparent border border-zinc-700 cursor-pointer"
                />
                <span className="text-xs font-mono text-zinc-400">{profile.eyeHex}</span>
              </div>
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
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                      active
                        ? 'border-zinc-100 bg-zinc-900 text-zinc-100'
                        : 'border-zinc-800/80 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                      style={{ backgroundColor: eye.hex }}
                    />
                    <span className="truncate">{eye.name.split(' (')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hair Color Picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">Haarfarbe</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Haarfarbe Hex"
                  value={profile.hairHex}
                  onChange={(e) =>
                    onUpdateProfile({
                      ...profile,
                      hairHex: e.target.value.toUpperCase(),
                      hairColorName: `Custom (${e.target.value.toUpperCase()})`,
                    })
                  }
                  className="w-6 h-6 rounded bg-transparent border border-zinc-700 cursor-pointer"
                />
                <span className="text-xs font-mono text-zinc-400">{profile.hairHex}</span>
              </div>
            </div>
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
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                      active
                        ? 'border-zinc-100 bg-zinc-900 text-zinc-100'
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

          {/* Haircut Style & Facial Hair Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-haircut" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Haarschnitt-Architektur
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
                  Kurzer Seiten-Fade + Strukturiertes Deckhaar
                </option>
                <option value="buzz_very_short">Buzz-Cut / Sehr kurz</option>
                <option value="medium_textured_flow">Mittellanger Textured Flow</option>
                <option value="long_hair">Langes Haar (Umspielt Kragen)</option>
              </select>
            </div>

            <div>
              <label htmlFor="profile-beard" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Bartstruktur (Textur-Resonanz)
              </label>
              <select
                id="profile-beard"
                value={profile.facialHair}
                onChange={(e) =>
                  onUpdateProfile({ ...profile, facialHair: e.target.value as FacialHair })
                }
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100"
              >
                <option value="clean_shaven">Glattrasiert (Clean Shaven)</option>
                <option value="stubble">3-Tage-Bart / Stubble</option>
                <option value="short_beard">Kurzer Vollbart (Konturiert)</option>
                <option value="full_beard">Markanter Vollbart</option>
              </select>
            </div>
          </div>
        </section>

        {/* Right Column: Generated Style Passport (6 cols) */}
        <section className="lg:col-span-6 rounded-2xl bg-zinc-900/45 border border-zinc-800/90 p-5 sm:p-6 space-y-6">
          <div className="border-b border-zinc-800 pb-4">
            <p className="text-xs font-mono text-amber-400">
              Deterministischer Style-Passport (Spickzettel für unterwegs)
            </p>
            <h2 className="text-xl font-bold text-zinc-100 mt-1">
              {seasonPalette.seasonName}
            </h2>
            <p className="text-xs text-zinc-300 mt-0.5">{seasonPalette.seasonSubtitle}</p>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
              {seasonPalette.description}
            </p>
          </div>

          {/* 12 Power Colors */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-200">
                12 Power-Farben (Für Oberteile & Layer in Gesichtsnähe)
              </h3>
              <span className="text-[11px] text-zinc-500">Klick kopiert Hex-Code</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {seasonPalette.powerColors.map((swatch) => (
                <button
                  key={swatch.name}
                  type="button"
                  onClick={() => handleCopyHex(swatch.hex, swatch.name)}
                  className="group p-2 rounded-xl bg-zinc-950 border border-zinc-800/90 hover:border-zinc-600 text-left transition-all cursor-pointer"
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
                  <p className="text-[10px] font-mono text-zinc-500">{swatch.hex}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 6 Core Neutrals */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-zinc-200">
              6 Core-Neutrals (Fundament für Hosen, Mäntel & Schuhe)
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {seasonPalette.coreNeutrals.map((swatch) => (
                <button
                  key={swatch.name}
                  type="button"
                  onClick={() => handleCopyHex(swatch.hex, swatch.name)}
                  className="p-2 rounded-xl bg-zinc-950 border border-zinc-800/90 hover:border-zinc-600 text-left transition-all cursor-pointer"
                >
                  <div
                    className="w-full h-6 rounded-md mb-1.5 border border-white/15"
                    style={{ backgroundColor: swatch.hex }}
                  />
                  <p className="text-[11px] font-medium text-zinc-200 truncate">{swatch.name}</p>
                  <p className="text-[10px] font-mono text-zinc-500">{swatch.hex}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Top 3 Necklines/Collars based on Haircut */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-zinc-200">
              Top 3 Kragenformen für deinen Haarschnitt
            </h3>
            <div className="space-y-2">
              {seasonPalette.recommendedNecklines.map((rec, i) => (
                <div
                  key={rec.neckline}
                  className="rounded-xl bg-zinc-950/80 border border-zinc-800/80 p-3"
                >
                  <p className="text-xs font-semibold text-zinc-100">
                    0{i + 1}. {rec.label}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{rec.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 6 Avoid Colors */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-rose-300">
              6 Konflikt-Farben (In Gesichtsnähe meiden — -30 Pkt. Unterton-Abzug)
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
                  <p className="text-[9px] font-mono text-zinc-500">{swatch.hex}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
