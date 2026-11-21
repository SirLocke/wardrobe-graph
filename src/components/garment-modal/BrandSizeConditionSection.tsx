import React from 'react';
import { BookmarkCheck, Ruler, Tag } from 'lucide-react';
import { GarmentCondition } from '../../types/wardrobe';

interface BrandSizeConditionSectionProps {
  isEn: boolean;
  brand: string;
  onBrandChange: (nextBrand: string) => void;
  brandSuggestions: {
    ownBrands: string[];
    popularBrands: string[];
  };
  size: string;
  onSizeChange: (nextSize: string) => void;
  sizePills: string[];
  sizeSuggestionReasonDe: string | null;
  canRememberBrandSizeRule: boolean;
  onRememberBrandSizeRule: () => void;
  ruleSavedNotice: string | null;
  condition: GarmentCondition;
  onConditionChange: (nextCondition: GarmentCondition) => void;
  purchaseYear: string;
  onPurchaseYearChange: (nextYear: string) => void;
}

export const BrandSizeConditionSection: React.FC<BrandSizeConditionSectionProps> = ({
  isEn,
  brand,
  onBrandChange,
  brandSuggestions,
  size,
  onSizeChange,
  sizePills,
  sizeSuggestionReasonDe,
  canRememberBrandSizeRule,
  onRememberBrandSizeRule,
  ruleSavedNotice,
  condition,
  onConditionChange,
  purchaseYear,
  onPurchaseYearChange,
}) => {
  return (
    <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-amber-400" />
          3. Marke &amp; Größe (Optional)
        </label>
        {sizeSuggestionReasonDe && (
          <span className="text-[11px] text-amber-300 font-medium">
            {sizeSuggestionReasonDe}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Brand Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-zinc-400">
            Marke (eigene Marken &amp; Schnellauswahl)
          </label>
          <input
            type="text"
            value={brand}
            onChange={(e) => onBrandChange(e.target.value)}
            placeholder="Marke eingeben oder unten antippen..."
            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
          />
          {brandSuggestions.ownBrands.length > 0 && (
            <div className="space-y-1">
              <span className="block text-[10px] font-medium text-amber-300/90">
                Deine häufigen Marken:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {brandSuggestions.ownBrands.slice(0, 10).map((b) => {
                  const active = brand.toLowerCase() === b.toLowerCase();
                  return (
                    <button
                      key={`own_${b}`}
                      type="button"
                      onClick={() => onBrandChange(active ? '' : b)}
                      className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-amber-500/25 border-amber-400 text-amber-200 font-semibold'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-200/90 hover:border-amber-400/60'
                      }`}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {brandSuggestions.popularBrands.slice(0, 9).map((b) => {
              const active = brand.toLowerCase() === b.toLowerCase();
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => onBrandChange(active ? '' : b)}
                  className={`px-2 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {b}
                </button>
              );
            })}
          </div>
        </div>

        {/* Size Selection */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-zinc-400 flex items-center gap-1">
            <Ruler className="w-3.5 h-3.5 text-zinc-500" />
            Größe
          </label>
          <input
            type="text"
            value={size}
            onChange={(e) => onSizeChange(e.target.value)}
            placeholder="z.B. M, L, 38, 42, W32/L32..."
            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
          />
          <div className="flex flex-wrap gap-1.5">
            {sizePills.map((s) => {
              const active = size.toUpperCase() === s.toUpperCase();
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSizeChange(s)}
                  className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-zinc-100 border-zinc-100 text-zinc-950 font-semibold'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {canRememberBrandSizeRule && (
        <div className="pt-2 border-t border-zinc-800/70 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onRememberBrandSizeRule}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 cursor-pointer"
          >
            <BookmarkCheck className="w-3.5 h-3.5" />
            <span>
              Merken: „Bei {brand.trim()} habe ich immer Größe {size.trim()}“
            </span>
          </button>
          {ruleSavedNotice && (
            <span className="text-[11px] text-emerald-400 font-medium">
              ✓ {ruleSavedNotice}
            </span>
          )}
        </div>
      )}

      {/* Condition & Age / Purchase Year */}
      <div className="pt-3 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-zinc-400">
            {isEn ? 'Condition' : 'Zustand'}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                {
                  value: 'good' as GarmentCondition,
                  labelDe: 'Top / Ausgehtauglich',
                  labelEn: 'Good / Going out',
                  activeClass:
                    'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold',
                },
                {
                  value: 'worn_casual' as GarmentCondition,
                  labelDe: 'Abgetragen (Zuhause/Freizeit)',
                  labelEn: 'Worn (Home/Casual)',
                  activeClass:
                    'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold',
                },
                {
                  value: 'replace_soon' as GarmentCondition,
                  labelDe: 'Ersetzen',
                  labelEn: 'Replace soon',
                  activeClass:
                    'bg-rose-500/20 border-rose-400 text-rose-200 font-semibold',
                },
              ] as const
            ).map((opt) => {
              const isSelected = condition === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onConditionChange(opt.value)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? opt.activeClass
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {isSelected ? '✓ ' : ''}
                  {isEn ? opt.labelEn : opt.labelDe}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-zinc-400">
            {isEn ? 'Purchase year (optional)' : 'Kaufjahr / Alter (Optional)'}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1990}
              max={2100}
              value={purchaseYear}
              onChange={(e) => onPurchaseYearChange(e.target.value)}
              placeholder={isEn ? 'e.g. 2023' : 'z. B. 2023'}
              className="w-24 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
            />
            <div className="flex flex-wrap gap-1">
              {[2026, 2025, 2024, 2023, 2021].map((yr) => {
                const active = purchaseYear === String(yr);
                return (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => onPurchaseYearChange(active ? '' : String(yr))}
                    className={`px-2 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
