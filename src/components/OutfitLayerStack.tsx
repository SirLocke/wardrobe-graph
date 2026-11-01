import React from 'react';
import { BiometricProfile, Garment, GarmentSubcategory } from '../types/wardrobe';
import { GarmentVector } from './GarmentVector';

interface OutfitLayerStackProps {
  items: Garment[];
  profile: BiometricProfile;
  lockedGarmentIds: string[];
  onToggleLock?: (garmentId: string) => void;
}

const OPENABLE_MID_LAYERS: GarmentSubcategory[] = [
  'overshirt',
  'button_down_shirt',
  'cardigan',
];

/**
 * Renders the complete outfit "übereinander" (anatomically stacked from head to toe
 * + layered across the torso so base_top, mid_layer, and outerwear overlap realistically).
 */
export const OutfitLayerStack: React.FC<OutfitLayerStackProps> = ({
  items,
  profile,
}) => {
  const baseTop = items.find((i) => i.category === 'base_top');
  const midLayer = items.find((i) => i.category === 'mid_layer');
  const outerwear = items.find((i) => i.category === 'outerwear');
  const bottom = items.find((i) => i.category === 'bottom');
  const footwear = items.find((i) => i.category === 'footwear');

  const isMidLayerOpenable =
    midLayer !== undefined && OPENABLE_MID_LAYERS.includes(midLayer.subcategory);

  const isShorts = bottom?.subcategory === 'shorts';

  return (
    <div className="relative flex flex-col items-center justify-between rounded-xl bg-zinc-950/95 border border-zinc-800/90 p-3.5 select-none overflow-hidden min-h-[340px]">
      {/* Subtle architectural grid lines & vertical studio axis */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 32%, rgba(251,191,36,0.08), transparent 65%)',
        }}
      />
      <div className="pointer-events-none absolute top-4 bottom-4 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-zinc-800/0 via-zinc-800/70 to-zinc-800/0" />

      {/* Header badge: Studio Look-Stack + Skin Undertone Calibration */}
      <div className="relative z-10 w-full flex items-center justify-between text-[10px] font-mono text-zinc-500 pb-1">
        <span className="uppercase tracking-wider text-zinc-400">Look-Stack</span>
        <span className="flex items-center gap-1.5" title="Biometrischer Haut- & Augen-Referenzpunkt">
          <span
            className="w-2.5 h-2.5 rounded-full border border-white/25"
            style={{ backgroundColor: profile.skinHex }}
          />
          <span
            className="w-2 h-2 rounded-full border border-white/25"
            style={{ backgroundColor: profile.eyeHex }}
          />
          <span>{items.length} Schichten</span>
        </span>
      </div>

      {/* Anatomical Vertical Mannequin Composition */}
      <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-center py-1">
        {/* 1. Biometric Neck / Collar Calibration Arc (shows skin tone directly above neckline) */}
        <div
          className="w-7 h-3.5 rounded-b-full border border-white/20 shadow-inner -mb-2 z-20 transition-transform"
          style={{ backgroundColor: profile.skinHex }}
          title={`Hautton-Referenz (${profile.skinHex}) am Kragen`}
        />

        {/* 2. TORSO ZONE (Base-Top + Mid-Layer + Outerwear layered on top of each other) */}
        <div className="relative w-40 h-36 flex items-center justify-center z-20">
          {/* Layer A: Base-Top (innermost) */}
          {baseTop && (
            <div
              className="absolute inset-0 flex items-center justify-center transition-transform"
              style={{
                transform:
                  midLayer && !isMidLayerOpenable
                    ? 'translateY(-4px) scale(0.94)'
                    : 'translateY(0px) scale(0.96)',
                zIndex: 10,
              }}
              title={`Base-Layer: ${baseTop.name} (${baseTop.colorName})`}
            >
              <GarmentVector
                type={baseTop.subcategory}
                colorHex={baseTop.colorHex}
                texture={baseTop.texture}
                neckline={baseTop.neckline}
                className="w-32 h-32 drop-shadow-[0_4px_10px_rgba(0,0,0,0.65)]"
              />
            </div>
          )}

          {/* Layer B: Mid-Layer (worn over Base-Top; openFront if overshirt/shirt/cardigan, or slightly shifted so Base-Top collar peeks out) */}
          {midLayer && (
            <div
              className="absolute inset-0 flex items-center justify-center transition-transform"
              style={{
                transform: isMidLayerOpenable
                  ? 'translateY(1px) scale(1.03)'
                  : 'translateY(3px) scale(1.01)',
                zIndex: 20,
              }}
              title={`Mid-Layer: ${midLayer.name} (${midLayer.colorName})`}
            >
              <GarmentVector
                type={midLayer.subcategory}
                colorHex={midLayer.colorHex}
                texture={midLayer.texture}
                neckline={midLayer.neckline}
                openFront={isMidLayerOpenable && Boolean(baseTop)}
                className="w-34 h-34 drop-shadow-[0_6px_14px_rgba(0,0,0,0.75)]"
              />
            </div>
          )}

          {/* Layer C: Outerwear (outermost shell worn open over Mid-Layer & Base-Top) */}
          {outerwear && (
            <div
              className="absolute inset-0 flex items-center justify-center transition-transform"
              style={{
                transform: 'translateY(2px) scale(1.13)',
                zIndex: 30,
              }}
              title={`Outerwear: ${outerwear.name} (${outerwear.colorName})`}
            >
              <GarmentVector
                type={outerwear.subcategory}
                colorHex={outerwear.colorHex}
                texture={outerwear.texture}
                neckline={outerwear.neckline}
                openFront={true}
                className="w-36 h-36 drop-shadow-[0_8px_18px_rgba(0,0,0,0.85)]"
              />
            </div>
          )}
        </div>

        {/* 3. BOTTOM ZONE (Trousers / Denim / Chino / Shorts tucked directly beneath torso hem) */}
        {bottom && (
          <div
            className="relative -mt-6 z-10 flex items-center justify-center"
            title={`Beinkleid: ${bottom.name} (${bottom.colorName})`}
          >
            <GarmentVector
              type={bottom.subcategory}
              colorHex={bottom.colorHex}
              texture={bottom.texture}
              neckline={bottom.neckline}
              className="w-32 h-32 drop-shadow-[0_6px_12px_rgba(0,0,0,0.7)]"
            />
          </div>
        )}

        {/* 4. FOOTWEAR ZONE (Left & Right Paired Silhouette aligned beneath trouser cuffs) */}
        {footwear && (
          <div
            className={`relative z-20 flex items-center justify-center gap-1 ${
              isShorts ? '-mt-3' : '-mt-5'
            }`}
            title={`Schuhwerk: ${footwear.name} (${footwear.colorName})`}
          >
            {/* Left shoe (mirrored horizontally for natural pair look) */}
            <div className="-scale-x-100 transform">
              <GarmentVector
                type={footwear.subcategory}
                colorHex={footwear.colorHex}
                texture={footwear.texture}
                className="w-12 h-12 drop-shadow-[0_4px_8px_rgba(0,0,0,0.75)]"
              />
            </div>
            {/* Right shoe */}
            <div>
              <GarmentVector
                type={footwear.subcategory}
                colorHex={footwear.colorHex}
                texture={footwear.texture}
                className="w-12 h-12 drop-shadow-[0_4px_8px_rgba(0,0,0,0.75)]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Color Swatch Bar (Vertical proportion strip of outfit colors) */}
      <div className="relative z-10 w-full pt-2 border-t border-zinc-900 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 flex-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="h-2 flex-1 first:rounded-l-full last:rounded-r-full border border-white/15"
              style={{ backgroundColor: item.colorHex }}
              title={`${item.name}: ${item.colorName} (${item.colorHex})`}
            />
          ))}
        </div>
        <span className="text-[10px] font-mono text-zinc-500 tabular-nums shrink-0">
          Übereinander
        </span>
      </div>
    </div>
  );
};
