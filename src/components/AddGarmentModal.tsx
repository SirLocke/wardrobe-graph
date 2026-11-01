import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CopyPlus, Pipette, Upload, X } from 'lucide-react';
import {
  CATEGORY_LABELS,
  FIT_LABELS,
  NECKLINE_LABELS,
  SUBCATEGORIES_BY_CATEGORY,
  SUBCATEGORY_LABELS,
  TEXTILE_COLOR_PRESETS,
  TEXTURE_LABELS,
} from '../data/seedData';
import { classifyColorTemp, hexToHsl, scoreGarmentBiometrics } from '../engine/colorMath';
import {
  BiometricProfile,
  FitType,
  Garment,
  GarmentCategory,
  GarmentSubcategory,
  NecklineType,
  TextureType,
} from '../types/wardrobe';
import { GarmentVector } from './GarmentVector';

interface AddGarmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BiometricProfile;
  onSaveGarment: (garment: Garment, keepOpenForDuplicate: boolean) => Promise<void>;
  initialGarment?: Garment | null;
}

export const AddGarmentModal: React.FC<AddGarmentModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveGarment,
  initialGarment,
}) => {
  const [name, setName] = useState('Heavyweight Tee Salbeigrün');
  const [category, setCategory] = useState<GarmentCategory>('base_top');
  const [subcategory, setSubcategory] = useState<GarmentSubcategory>('heavyweight_tee');
  const [colorName, setColorName] = useState('Salbeigrün');
  const [colorHex, setColorHex] = useState('#8F9779');
  const [fit, setFit] = useState<FitType>('regular');
  const [neckline, setNeckline] = useState<NecklineType>('heavy_crewneck');
  const [texture, setTexture] = useState<TextureType>('heavy_jersey');
  const [thermalRating, setThermalRating] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [formality, setFormality] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [waterResistant, setWaterResistant] = useState(false);
  const [isClean, setIsClean] = useState(true);
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>(undefined);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDuplicateNotice(null);
    setNameError(null);
    if (initialGarment) {
      setName(initialGarment.name);
      setCategory(initialGarment.category);
      setSubcategory(initialGarment.subcategory);
      setColorName(initialGarment.colorName);
      setColorHex(initialGarment.colorHex);
      setFit(initialGarment.fit);
      setNeckline(initialGarment.neckline);
      setTexture(initialGarment.texture);
      setThermalRating(initialGarment.thermalRating);
      setFormality(initialGarment.formality);
      setWaterResistant(initialGarment.waterResistant);
      setIsClean(initialGarment.isClean);
      setImageDataUrl(initialGarment.imageDataUrl);
    } else {
      setName('Heavyweight Tee Salbeigrün');
      setCategory('base_top');
      setSubcategory('heavyweight_tee');
      setColorName('Salbeigrün');
      setColorHex('#8F9779');
      setFit('regular');
      setNeckline('heavy_crewneck');
      setTexture('heavy_jersey');
      setThermalRating(2);
      setFormality(2);
      setWaterResistant(false);
      setIsClean(true);
      setImageDataUrl(undefined);
    }
  }, [isOpen, initialGarment]);

  // Draw uploaded image onto canvas for eyedropper sampling
  useEffect(() => {
    if (!imageDataUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const maxDim = 260;
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  const handleCategoryChange = (newCat: GarmentCategory) => {
    setCategory(newCat);
    const defaultSub = SUBCATEGORIES_BY_CATEGORY[newCat][0];
    setSubcategory(defaultSub);
    if (newCat === 'bottom' || newCat === 'footwear') {
      setNeckline('none');
    } else if (neckline === 'none') {
      setNeckline('crewneck');
    }
    const baseSubLabel = SUBCATEGORY_LABELS[defaultSub].split(' (')[0];
    setName(`${baseSubLabel} ${colorName}`);
  };

  const handleSubcategoryChange = (newSub: GarmentSubcategory) => {
    setSubcategory(newSub);
    const baseSubLabel = SUBCATEGORY_LABELS[newSub].split(' (')[0];
    setName(`${baseSubLabel} ${colorName}`);
  };

  const handleSelectColorPreset = (presetName: string, presetHex: string) => {
    setColorName(presetName.replace(' (Test)', ''));
    setColorHex(presetHex);
    const baseSubLabel = SUBCATEGORY_LABELS[subcategory].split(' (')[0];
    setName(`${baseSubLabel} ${presetName.replace(' (Test)', '')}`);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
    setColorHex(hex);
    setColorName(`Pipette ${hex}`);
  };

  const liveComputation = useMemo(() => {
    const hsl = hexToHsl(colorHex);
    const colorTemp = classifyColorTemp(hsl);
    const bio = scoreGarmentBiometrics(
      {
        category,
        colorName,
        colorHex,
        hsl,
        colorTemp,
        neckline,
        texture,
      },
      profile
    );
    return { hsl, colorTemp, bio };
  }, [category, colorName, colorHex, neckline, texture, profile]);

  if (!isOpen) return null;

  const submitForm = async (keepOpenForDuplicate: boolean) => {
    if (!name.trim()) {
      setNameError('Bitte gib eine Bezeichnung für das Kleidungsstück ein.');
      return;
    }
    setNameError(null);

    const newGarment: Garment = {
      id: initialGarment && !keepOpenForDuplicate ? initialGarment.id : `garment_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      category,
      subcategory,
      colorName: colorName.trim() || colorHex,
      colorHex,
      hsl: liveComputation.hsl,
      colorTemp: liveComputation.colorTemp,
      fit,
      neckline: category === 'bottom' || category === 'footwear' ? 'none' : neckline,
      texture,
      thermalRating,
      formality,
      waterResistant,
      isClean,
      imageDataUrl,
    };

    await onSaveGarment(newGarment, keepOpenForDuplicate);

    if (keepOpenForDuplicate) {
      setDuplicateNotice(`"${newGarment.name}" gespeichert. Wähle jetzt einfach die nächste Farbe für denselben Schnitt!`);
    } else {
      onClose();
    }
  };

  const scoreToneClass =
    liveComputation.bio.score >= 82
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20'
      : liveComputation.bio.score >= 65
      ? 'text-amber-300 border-amber-500/30 bg-amber-950/20'
      : 'text-rose-400 border-rose-500/30 bg-rose-950/20';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-garment-title"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl my-8 overflow-hidden">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <div>
            <h2 id="modal-garment-title" className="text-lg font-semibold text-zinc-100">
              {initialGarment ? 'Kleidungsstück bearbeiten' : 'Neues Kleidungsstück erfassen'}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Deterministische HSL-Farbklassifikation & Live-Biometrie-Prüfung
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Modal schließen"
            className="p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Biometric Feedback Banner */}
        <div className={`px-6 py-4 border-b transition-colors ${scoreToneClass}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-center shrink-0">
                <GarmentVector
                  type={subcategory}
                  colorHex={colorHex}
                  texture={texture}
                  neckline={neckline}
                  className="w-11 h-11"
                />
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                  <span className="text-base font-bold">{liveComputation.bio.score}% Biometrie-Match</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-zinc-300">
                    HSL({liveComputation.hsl.h}°, {liveComputation.hsl.s}%, {liveComputation.hsl.l}%)
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-zinc-300">
                    Temp: {liveComputation.colorTemp === 'warm' ? 'Warm' : liveComputation.colorTemp === 'cool' ? 'Kühl' : 'Neutral'}
                  </span>
                </div>
                <p className="text-xs text-zinc-200 mt-1 leading-relaxed">
                  {liveComputation.bio.reasons.join(' · ')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {duplicateNotice && (
          <div className="px-6 py-2.5 bg-emerald-950/40 border-b border-emerald-800/40 text-xs text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{duplicateNotice}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Row 1: Category, Subcategory, Name */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="garment-category" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Kategorie (Layer-Slot)
              </label>
              <select
                id="garment-category"
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as GarmentCategory)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
              >
                {(Object.keys(CATEGORY_LABELS) as GarmentCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="garment-subcategory" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Typ / Silhouette
              </label>
              <select
                id="garment-subcategory"
                value={subcategory}
                onChange={(e) => handleSubcategoryChange(e.target.value as GarmentSubcategory)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
              >
                {SUBCATEGORIES_BY_CATEGORY[category].map((sub) => (
                  <option key={sub} value={sub}>
                    {SUBCATEGORY_LABELS[sub]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="garment-name" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Bezeichnung
              </label>
              <input
                id="garment-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="z.B. Heavyweight Tee Salbeigrün"
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
              />
              {nameError && <p className="text-xs text-rose-400 mt-1">{nameError}</p>}
            </div>
          </div>

          {/* Curated 24 Textile Color Picker */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <label className="text-xs font-medium text-zinc-300">
                Kuratierte Textil-Farbpalette (24 Presets) oder Custom-Hex
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Benutzerdefinierte Hex-Farbe wählen"
                  value={colorHex}
                  onChange={(e) => {
                    setColorHex(e.target.value.toUpperCase());
                    setColorName(`Custom ${e.target.value.toUpperCase()}`);
                  }}
                  className="w-7 h-7 rounded cursor-pointer bg-transparent border border-zinc-700"
                />
                <input
                  type="text"
                  aria-label="Hex-Code manuell eingeben"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  className="w-24 rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-xs font-mono text-zinc-200"
                />
                <input
                  type="text"
                  aria-label="Farbname"
                  value={colorName}
                  onChange={(e) => setColorName(e.target.value)}
                  placeholder="Farbname"
                  className="w-32 rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-xs text-zinc-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {TEXTILE_COLOR_PRESETS.map((preset) => {
                const isSelected = colorHex.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleSelectColorPreset(preset.name, preset.hex)}
                    className={`group flex flex-col items-start p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-zinc-100 bg-zinc-900 ring-1 ring-zinc-100'
                        : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700'
                    }`}
                  >
                    <div className="w-full h-5 rounded mb-1.5 border border-black/20 flex items-center justify-center" style={{ backgroundColor: preset.hex }}>
                      {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                    </div>
                    <span className="text-[11px] font-medium text-zinc-200 truncate w-full">
                      {preset.name}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">{preset.hex}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cut, Neckline, Texture */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="garment-fit" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Passform (Silhouette)
              </label>
              <select
                id="garment-fit"
                value={fit}
                onChange={(e) => setFit(e.target.value as FitType)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100"
              >
                {(Object.keys(FIT_LABELS) as FitType[]).map((f) => (
                  <option key={f} value={f}>
                    {FIT_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="garment-neckline" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Kragen / Ausschnitt
              </label>
              <select
                id="garment-neckline"
                value={category === 'bottom' || category === 'footwear' ? 'none' : neckline}
                disabled={category === 'bottom' || category === 'footwear'}
                onChange={(e) => setNeckline(e.target.value as NecklineType)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 disabled:opacity-50"
              >
                {(Object.keys(NECKLINE_LABELS) as NecklineType[]).map((n) => (
                  <option key={n} value={n}>
                    {NECKLINE_LABELS[n]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="garment-texture" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Stofftextur / Material
              </label>
              <select
                id="garment-texture"
                value={texture}
                onChange={(e) => setTexture(e.target.value as TextureType)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100"
              >
                {(Object.keys(TEXTURE_LABELS) as TextureType[]).map((t) => (
                  <option key={t} value={t}>
                    {TEXTURE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Thermal Rating, Formality, Checkboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div>
              <label htmlFor="garment-thermal" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Wärme-Index (Stufe {thermalRating}/5)
              </label>
              <select
                id="garment-thermal"
                value={thermalRating}
                onChange={(e) => setThermalRating(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100"
              >
                <option value={1}>1 — Hochsommer (&gt;24°C)</option>
                <option value={2}>2 — Mild / Frühling (18–23°C)</option>
                <option value={3}>3 — Übergang (12–17°C)</option>
                <option value={4}>4 — Kalt / Herbst (5–11°C)</option>
                <option value={5}>5 — Tiefwinter (&lt;5°C)</option>
              </select>
            </div>

            <div>
              <label htmlFor="garment-formality" className="block text-xs font-medium text-zinc-300 mb-1.5">
                Formalität (Stufe {formality}/5)
              </label>
              <select
                id="garment-formality"
                value={formality}
                onChange={(e) => setFormality(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100"
              >
                <option value={1}>1 — Sport / Lounge</option>
                <option value={2}>2 — Casual / Alltag</option>
                <option value={3}>3 — Smart Casual</option>
                <option value={4}>4 — Business / Chic</option>
                <option value={5}>5 — Formal / Event</option>
              </select>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <label className="inline-flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={waterResistant}
                  onChange={(e) => setWaterResistant(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-amber-500"
                />
                <span>Wasserabweisend / Regenfest</span>
              </label>
              <label className="inline-flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isClean}
                  onChange={(e) => setIsClean(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-emerald-500"
                />
                <span>Frisch gewaschen (Einsatzbereit)</span>
              </label>
            </div>
          </div>

          {/* Optional Photo Upload & Fabric Color Eyedropper */}
          <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Pipette className="w-4 h-4 text-zinc-400" />
                <span className="text-xs font-medium text-zinc-300">
                  Optional: Eigenes Foto & Stoff-Farbpipette
                </span>
              </div>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Foto laden</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
            {imageDataUrl && (
              <div className="mt-3 flex flex-col sm:flex-row items-center gap-4">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className="rounded-lg border border-zinc-700 cursor-crosshair max-h-48"
                  title="Klicke auf den Stoff, um die exakte Hex-Farbe zu übernehmen"
                />
                <div className="text-xs text-zinc-400 space-y-2">
                  <p>
                    Klicke direkt in das Foto auf den Stoff, um den Farbwert per Pipette abzugreifen.
                  </p>
                  <button
                    type="button"
                    onClick={() => setImageDataUrl(undefined)}
                    className="text-rose-400 hover:underline cursor-pointer"
                  >
                    Foto entfernen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-zinc-900/60 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
          >
            Abbrechen
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => submitForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-100 border border-zinc-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <CopyPlus className="w-4 h-4 text-amber-400" />
              <span>Speichern & Duplizieren</span>
            </button>
            <button
              type="button"
              onClick={() => submitForm(false)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-xs font-semibold text-zinc-950 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Check className="w-4 h-4" />
              <span>Speichern</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
