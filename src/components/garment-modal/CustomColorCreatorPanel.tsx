import React from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { TextileColorPreset } from '../../data/seedData';
import { hexToGermanColorName } from '../../engine/colorNaming';
import { AppLocale } from '../../types/wardrobe';

interface CustomColorCreatorPanelProps {
  isEn: boolean;
  locale: AppLocale;
  editingCustomColorOriginalName: string | null;
  newCustomColorHex: string;
  setNewCustomColorHex: (hex: string) => void;
  newCustomColorName: string;
  setNewCustomColorName: (name: string) => void;
  hasManualCustomColorName: boolean;
  setHasManualCustomColorName: (manual: boolean) => void;
  customColors: TextileColorPreset[];
  onAddOrUpdateCustomColor: () => void;
  onStartEditCustomColor: (color: TextileColorPreset) => void;
  onDeleteCustomColor: (colorName: string) => void;
}

export const CustomColorCreatorPanel: React.FC<CustomColorCreatorPanelProps> = ({
  isEn,
  locale,
  editingCustomColorOriginalName,
  newCustomColorHex,
  setNewCustomColorHex,
  newCustomColorName,
  setNewCustomColorName,
  hasManualCustomColorName,
  setHasManualCustomColorName,
  customColors,
  onAddOrUpdateCustomColor,
  onStartEditCustomColor,
  onDeleteCustomColor,
}) => {
  const detectedName = hexToGermanColorName(newCustomColorHex, locale).name;

  return (
    <div className="p-4 rounded-xl bg-zinc-900/90 border border-amber-500/30 space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-200">
          {editingCustomColorOriginalName
            ? isEn
              ? `Edit custom color "${editingCustomColorOriginalName}":`
              : `Eigene Farbe „${editingCustomColorOriginalName}“ bearbeiten:`
            : isEn
            ? 'Add new color to palette:'
            : 'Neue Farbe zur Farbpalette hinzufügen:'}
        </p>
        <span className="text-[11px] text-amber-300/90">
          {isEn ? 'Detected shade:' : 'Erkannter Farbton:'}{' '}
          <strong>{detectedName}</strong>
        </span>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <label className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 cursor-pointer shrink-0">
          <input
            type="color"
            value={newCustomColorHex}
            onChange={(e) => {
              const nextHex = e.target.value;
              setNewCustomColorHex(nextHex);
              if (!hasManualCustomColorName) {
                setNewCustomColorName(hexToGermanColorName(nextHex, locale).name);
              }
            }}
            className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
          />
          <span className="text-xs text-zinc-300">
            {isEn ? 'Pick shade' : 'Farbton wählen'}
          </span>
        </label>
        <div className="flex-1 flex items-center gap-1.5">
          <input
            type="text"
            value={newCustomColorName}
            onChange={(e) => {
              setNewCustomColorName(e.target.value);
              setHasManualCustomColorName(Boolean(e.target.value.trim()));
            }}
            placeholder={`${isEn ? 'e.g.' : 'z. B.'} ${detectedName}`}
            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
          />
          {hasManualCustomColorName &&
            newCustomColorName.trim() !== detectedName && (
              <button
                type="button"
                onClick={() => {
                  setNewCustomColorName(detectedName);
                  setHasManualCustomColorName(false);
                }}
                className="px-2 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-amber-300 hover:border-amber-400 whitespace-nowrap cursor-pointer"
                title={
                  isEn
                    ? 'Use detected English color name'
                    : 'Erkannten deutschen Farbnamen übernehmen'
                }
              >
                {isEn ? 'Suggestion:' : 'Vorschlag:'} {detectedName}
              </button>
            )}
        </div>
        <button
          type="button"
          onClick={onAddOrUpdateCustomColor}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold hover:bg-amber-400 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          {editingCustomColorOriginalName
            ? isEn
              ? 'Save changes'
              : 'Änderung speichern'
            : isEn
            ? 'Save & select color'
            : 'Farbe speichern & wählen'}
        </button>
      </div>

      {customColors.length > 0 && (
        <div className="pt-2.5 border-t border-zinc-800/80 space-y-1.5">
          <p className="text-[11px] text-zinc-400">
            {isEn ? 'Your custom colors:' : 'Deine eigenen Farben:'}
          </p>
          <div className="flex flex-wrap gap-2">
            {customColors.map((cc) => (
              <div
                key={`${cc.name}_${cc.hex}`}
                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200"
              >
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                  style={{ backgroundColor: cc.hex }}
                />
                <span>{cc.name}</span>
                <button
                  type="button"
                  onClick={() => onStartEditCustomColor(cc)}
                  className="text-zinc-400 hover:text-amber-300 cursor-pointer p-0.5"
                  title={isEn ? `Edit ${cc.name}` : `${cc.name} bearbeiten`}
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteCustomColor(cc.name)}
                  className="text-zinc-500 hover:text-rose-400 cursor-pointer p-0.5"
                  title={isEn ? `Delete ${cc.name}` : `${cc.name} löschen`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
