import React from 'react';
import { Upload } from 'lucide-react';
import { GarmentCategory } from '../../types/wardrobe';

interface PhotoColorPickerSectionProps {
  isEn: boolean;
  category: GarmentCategory;
  waterResistant: boolean;
  onToggleWaterResistant: () => void;
  laundrySupported: boolean;
  isClean: boolean;
  onToggleClean: () => void;
  imageDataUrl?: string;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onCanvasClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  buyUrl: string;
  onBuyUrlChange: (url: string) => void;
}

export const PhotoColorPickerSection: React.FC<PhotoColorPickerSectionProps> = ({
  isEn,
  category,
  waterResistant,
  onToggleWaterResistant,
  laundrySupported,
  isClean,
  onToggleClean,
  imageDataUrl,
  onPhotoUpload,
  onRemovePhoto,
  canvasRef,
  onCanvasClick,
  buyUrl,
  onBuyUrlChange,
}) => {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          {category !== 'accessory' && (
            <button
              type="button"
              onClick={onToggleWaterResistant}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                waterResistant
                  ? 'bg-sky-950/50 border-sky-500/50 text-sky-200'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400'
              }`}
            >
              {waterResistant ? '✓ Wasserabweisend (Regenfest)' : 'Nicht wasserabweisend'}
            </button>
          )}

          {laundrySupported && (
            <button
              type="button"
              onClick={onToggleClean}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                isClean
                  ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/50 border-rose-500/50 text-rose-200'
              }`}
            >
              {isClean ? '✓ Frisch gewaschen' : 'In der Wäsche'}
            </button>
          )}
        </div>

        <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-medium text-zinc-300 hover:border-zinc-600 cursor-pointer">
          <Upload className="w-3.5 h-3.5 text-amber-400" />
          <span>Foto hochladen (Farbe antippen)</span>
          <input
            type="file"
            accept="image/*"
            onChange={onPhotoUpload}
            className="hidden"
          />
        </label>
      </div>

      {imageDataUrl && (
        <div className="flex items-center gap-4 pt-2">
          <canvas
            ref={canvasRef}
            onClick={onCanvasClick}
            className="rounded-lg border border-zinc-700 cursor-crosshair max-h-36"
            title="Klicke auf eine Stelle im Foto, um die Farbe zu übernehmen"
          />
          <div className="text-xs text-zinc-400 space-y-1">
            <p className="text-zinc-200 font-medium">Foto-Farbwähler aktiv</p>
            <p>Tippe direkt ins Foto, um die genaue Kleidungsfarbe zu übernehmen.</p>
            <button
              type="button"
              onClick={onRemovePhoto}
              className="text-rose-400 hover:text-rose-300 underline"
            >
              Foto entfernen
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1">
          {isEn ? 'Product / Shop Link (optional)' : 'Produkt- / Kauf-Link (optional)'}
        </label>
        <input
          type="url"
          value={buyUrl}
          onChange={(e) => onBuyUrlChange(e.target.value)}
          placeholder="https://www.amazon.de/dp/..."
          className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
        />
      </div>
    </>
  );
};
