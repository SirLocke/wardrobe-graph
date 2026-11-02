import React from 'react';
import { BiometricProfile, Garment, GarmentSubcategory } from '../types/wardrobe';
import { GarmentVector } from './GarmentVector';

interface OutfitLayerStackProps {
  items: Garment[];
  profile: BiometricProfile;
  lockedGarmentIds: string[];
  onToggleLock?: (garmentId: string) => void;
  onEditGarment?: (garment: Garment) => void;
}

const OPENABLE_MID_LAYERS: GarmentSubcategory[] = [
  'overshirt',
  'button_down_shirt',
  'cardigan',
  'blazer',
];

/**
 * Renders the complete outfit "übereinander" (anatomically stacked from head to toe
 * + layered across the torso so base_top, mid_layer, and outerwear overlap realistically).
 */
export const OutfitLayerStack: React.FC<OutfitLayerStackProps> = ({
  items,
  profile,
  onEditGarment,
}) => {
  const baseTop = items.find((i) => i.category === 'base_top');
  const midLayer = items.find((i) => i.category === 'mid_layer');
  const outerwear = items.find((i) => i.category === 'outerwear');
  const bottom = items.find((i) => i.category === 'bottom');
  const footwear = items.find((i) => i.category === 'footwear');
  const accessories = items.filter((i) => i.category === 'accessory');

  const headAccessory = accessories.find((a) => a.subcategory === 'cap_beanie');
  const eyewearAccessory = accessories.find(
    (a) => a.subcategory === 'sunglasses' || a.subcategory === 'glasses'
  );
  const neckAccessory = accessories.find(
    (a) => a.subcategory === 'scarf' || a.subcategory === 'necklace'
  );
  const watchAccessory = accessories.find((a) => a.subcategory === 'watch');
  const braceletAccessory = accessories.find((a) => a.subcategory === 'bracelet');
  const bagAccessory = accessories.find((a) => a.subcategory === 'bag_backpack');
  const beltAccessory = accessories.find((a) => a.subcategory === 'belt');
  const socksAccessory = accessories.find(
    (a) => a.subcategory === 'socks' || a.subcategory === 'socks_short'
  );

  const isMidLayerOpenable =
    midLayer !== undefined && OPENABLE_MID_LAYERS.includes(midLayer.subcategory);

  const isShortsOrSkirt =
    bottom?.subcategory === 'shorts' ||
    bottom?.subcategory === 'mini_skirt' ||
    bottom?.subcategory === 'midi_skirt';

  const isShortSock = socksAccessory?.subcategory === 'socks_short';
  const isBoot = footwear?.subcategory === 'boots';
  const isAnkleBoot = footwear?.subcategory === 'heeled_ankle_boot';

  // Exact horizontal & vertical bounds so socks never poke out on the sides of boots
  const sockBounds = isBoot
    ? {
        x1: 33,
        x2: 50,
        y1: isShortSock ? 19 : 13,
        y2: 34,
        ribX: [37.5, 41.5, 45.5],
        ribY2: isShortSock ? 22 : 21,
      }
    : isAnkleBoot
    ? {
        x1: 29,
        x2: 47,
        y1: isShortSock ? 15 : 11,
        y2: 30,
        ribX: [33.5, 38, 42.5],
        ribY2: isShortSock ? 18 : 18,
      }
    : {
        x1: 22,
        x2: 42,
        y1: isShortSock ? 29 : 13,
        y2: 46,
        ribX: [27, 32, 37],
        ribY2: isShortSock ? 34 : 28,
      };

  return (
    <div className="relative flex flex-col items-center justify-between rounded-xl bg-zinc-950/95 border border-zinc-800/90 p-3.5 select-none overflow-hidden min-h-[360px]">
      {/* Subtle architectural grid lines & vertical studio axis */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 32%, rgba(251,191,36,0.08), transparent 65%)',
        }}
      />
      <div className="pointer-events-none absolute top-4 bottom-4 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-zinc-800/0 via-zinc-800/70 to-zinc-800/0" />

      {/* Header badge: Simple 2D Outfit View */}
      <div className="relative z-10 w-full flex items-center justify-between text-[10px] font-mono text-zinc-500 pb-1">
        <span className="uppercase tracking-wider text-zinc-400">Outfit-Ansicht</span>
        <span>{items.length} Teile</span>
      </div>

      {/* Pure 2D Clothing & Accessories Composition (No face, no body, all pieces clickable) */}
      <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-center py-1">
        {/* 1. HEADWEAR & EYEWEAR ZONE (Moved down directly above the collar, no face/head) */}
        {(headAccessory || eyewearAccessory) && (
          <div className="relative flex flex-col items-center justify-center -mb-5 z-30">
            {/* Clickable Cap / Beanie */}
            {headAccessory && (
              <div
                onClick={() => onEditGarment?.(headAccessory)}
                className={`relative w-14 h-11 -mb-3 z-30 flex items-center justify-center ${
                  onEditGarment ? 'cursor-pointer hover:scale-105 transition-transform' : ''
                }`}
                title={`${headAccessory.name} (${headAccessory.colorName}) – Klicken zum Bearbeiten`}
              >
                <GarmentVector
                  type={headAccessory.subcategory}
                  colorHex={headAccessory.colorHex}
                  texture={headAccessory.texture}
                  className="w-14 h-14 drop-shadow-[0_3px_6px_rgba(0,0,0,0.75)]"
                />
              </div>
            )}

            {/* Clickable Glasses / Sunglasses sitting right below headwear & above collar */}
            {eyewearAccessory && (
              <div
                onClick={() => onEditGarment?.(eyewearAccessory)}
                className={`relative w-11 h-8 z-40 flex items-center justify-center ${
                  onEditGarment ? 'cursor-pointer hover:scale-110 transition-transform' : ''
                }`}
                title={`${eyewearAccessory.name} (${eyewearAccessory.colorName}) – Klicken zum Bearbeiten`}
              >
                <GarmentVector
                  type={eyewearAccessory.subcategory}
                  colorHex={eyewearAccessory.colorHex}
                  texture={eyewearAccessory.texture}
                  className="w-11 h-11 drop-shadow-[0_2px_5px_rgba(0,0,0,0.75)]"
                />
              </div>
            )}
          </div>
        )}

        {/* 2. TORSO ZONE (2D Layered Tops + 2D Watch & Bracelet below Sleeve Cuffs) */}
        <div className="relative w-36 h-36 flex items-center justify-center z-20">
          {/* Layer A: Base-Top (innermost) */}
          {baseTop && (
            <div
              onClick={() => onEditGarment?.(baseTop)}
              className={`absolute inset-0 flex items-center justify-center transition-transform ${
                onEditGarment ? 'cursor-pointer hover:brightness-110' : ''
              }`}
              style={{
                transform:
                  midLayer && !isMidLayerOpenable
                    ? 'translateY(-4px) scale(0.94)'
                    : 'translateY(0px) scale(0.96)',
                zIndex: 10,
              }}
              title={`${baseTop.name} (${baseTop.colorName}) – Klicken zum Bearbeiten`}
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

          {/* Layer B: Mid-Layer */}
          {midLayer && (
            <div
              onClick={() => onEditGarment?.(midLayer)}
              className={`absolute inset-0 flex items-center justify-center transition-transform ${
                onEditGarment ? 'cursor-pointer hover:brightness-110' : ''
              }`}
              style={{
                transform: isMidLayerOpenable
                  ? 'translateY(1px) scale(1.03)'
                  : 'translateY(3px) scale(1.01)',
                zIndex: 20,
              }}
              title={`${midLayer.name} (${midLayer.colorName}) – Klicken zum Bearbeiten`}
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

          {/* Layer C: Outerwear */}
          {outerwear && (
            <div
              onClick={() => onEditGarment?.(outerwear)}
              className={`absolute inset-0 flex items-center justify-center transition-transform ${
                onEditGarment ? 'cursor-pointer hover:brightness-110' : ''
              }`}
              style={{
                transform: 'translateY(2px) scale(1.13)',
                zIndex: 30,
              }}
              title={`${outerwear.name} (${outerwear.colorName}) – Klicken zum Bearbeiten`}
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

          {/* Collar Zone: Clickable Necklace / Scarf sitting in the neckline */}
          {neckAccessory && (
            <div
              onClick={() => onEditGarment?.(neckAccessory)}
              className={`absolute top-[4%] left-1/2 -translate-x-1/2 w-10 h-8 z-35 flex items-center justify-center ${
                onEditGarment ? 'cursor-pointer hover:scale-110 transition-transform' : ''
              }`}
              title={`${neckAccessory.name} (${neckAccessory.colorName}) – Klicken zum Bearbeiten`}
            >
              <GarmentVector
                type={neckAccessory.subcategory}
                colorHex={neckAccessory.colorHex}
                texture={neckAccessory.texture}
                className="w-10 h-8 drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)]"
              />
            </div>
          )}

          {/* Left Wrist below Sleeve Cuff: 2D Horizontal Watch */}
          {watchAccessory && (
            <div
              onClick={() => onEditGarment?.(watchAccessory)}
              className={`absolute left-[23%] top-[83%] -translate-x-1/2 -translate-y-1/2 z-40 flex items-center justify-center ${
                onEditGarment ? 'cursor-pointer hover:scale-115 transition-transform' : ''
              }`}
              title={`${watchAccessory.name} (${watchAccessory.colorName}) – Klicken zum Bearbeiten`}
            >
              <GarmentVector
                type={watchAccessory.subcategory}
                colorHex={watchAccessory.colorHex}
                texture={watchAccessory.texture}
                className="w-6 h-6 drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)]"
              />
            </div>
          )}

          {/* Right Wrist below Sleeve Cuff: 2D Flat Bracelet Bar */}
          {braceletAccessory && (
            <div
              onClick={() => onEditGarment?.(braceletAccessory)}
              className={`absolute left-[77%] top-[83%] -translate-x-1/2 -translate-y-1/2 z-40 flex items-center justify-center ${
                onEditGarment ? 'cursor-pointer hover:scale-115 transition-transform' : ''
              }`}
              title={`${braceletAccessory.name} (${braceletAccessory.colorName}) – Klicken zum Bearbeiten`}
            >
              <GarmentVector
                type={braceletAccessory.subcategory}
                colorHex={braceletAccessory.colorHex}
                texture={braceletAccessory.texture}
                className="w-6 h-6 drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)]"
              />
            </div>
          )}

          {/* Optional Bag / Backpack at the side */}
          {bagAccessory && (
            <div
              onClick={() => onEditGarment?.(bagAccessory)}
              className={`absolute -right-5 top-8 z-35 flex items-center justify-center ${
                onEditGarment ? 'cursor-pointer hover:scale-105 transition-transform' : ''
              }`}
              title={`${bagAccessory.name} (${bagAccessory.colorName}) – Klicken zum Bearbeiten`}
            >
              <GarmentVector
                type={bagAccessory.subcategory}
                colorHex={bagAccessory.colorHex}
                texture={bagAccessory.texture}
                className="w-11 h-11 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]"
              />
            </div>
          )}
        </div>

        {/* 2b. WAIST BELT ZONE (Full waistband width w-16 = 56px belt width aligned onto trouser waist) */}
        {beltAccessory && (
          <div
            onClick={() => onEditGarment?.(beltAccessory)}
            className={`relative -mt-10 -mb-7 z-30 flex items-center justify-center ${
              onEditGarment ? 'cursor-pointer hover:scale-105 transition-transform' : ''
            }`}
            title={`${beltAccessory.name} (${beltAccessory.colorName}) – Klicken zum Bearbeiten`}
          >
            <GarmentVector
              type={beltAccessory.subcategory}
              colorHex={beltAccessory.colorHex}
              texture={beltAccessory.texture}
              className="w-16 h-16 drop-shadow-[0_3px_6px_rgba(0,0,0,0.85)]"
            />
          </div>
        )}

        {/* 3. BOTTOM ZONE (Trousers / Denim / Chino / Shorts, no cartoon legs) */}
        {bottom && (
          <div
            onClick={() => onEditGarment?.(bottom)}
            className={`relative -mt-5 z-10 flex flex-col items-center justify-center ${
              onEditGarment ? 'cursor-pointer hover:brightness-110 transition-all' : ''
            }`}
            title={`${bottom.name} (${bottom.colorName}) – Klicken zum Bearbeiten`}
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

        {/* 4. FOOTWEAR & SUBTLY HINTED SOCKS UNDER SHOE SVG */}
        {footwear && (
          <div
            className={`relative z-20 flex flex-col items-center justify-center ${
              isShortsOrSkirt ? '-mt-2' : '-mt-5'
            }`}
          >
            {/* Left & Right Paired Shoes with Socks tucked strictly inside the shoe/boot collar */}
            <div className="flex items-center justify-center gap-1">
              {(['left', 'right'] as const).map((side) => (
                <div
                  key={side}
                  className={`relative w-12 h-12 ${side === 'left' ? '-scale-x-100 transform' : ''}`}
                >
                  {/* Subtly hinted sock layered behind the shoe collar (strictly within boot shaft width) */}
                  {socksAccessory && (
                    <svg
                      viewBox="0 0 100 100"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditGarment?.(socksAccessory);
                      }}
                      className={`absolute inset-0 w-full h-full z-10 ${
                        onEditGarment ? 'cursor-pointer hover:brightness-125 transition-all' : ''
                      }`}
                    >
                      <title>{`${socksAccessory.name} (${socksAccessory.colorName}) – Klicken zum Bearbeiten`}</title>
                      <path
                        d={`M${sockBounds.x1} ${sockBounds.y1} L${sockBounds.x2} ${sockBounds.y1} L${sockBounds.x2} ${sockBounds.y2} L${sockBounds.x1} ${sockBounds.y2} Z`}
                        fill={socksAccessory.colorHex}
                        stroke="rgba(255,255,255,0.28)"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                      {/* Subtle 2D ribbed cuff lines on long socks */}
                      {!isShortSock &&
                        sockBounds.ribX.map((rx) => (
                          <line
                            key={rx}
                            x1={rx}
                            y1={sockBounds.y1 + 1}
                            x2={rx}
                            y2={sockBounds.ribY2}
                            stroke="rgba(255,255,255,0.22)"
                            strokeWidth="1.1"
                          />
                        ))}
                    </svg>
                  )}

                  {/* Clickable Hitbox for the exposed upper sock cuff above the shoe collar */}
                  {socksAccessory && onEditGarment && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditGarment(socksAccessory);
                      }}
                      className="absolute left-[20%] top-[6%] w-[32%] h-[28%] z-30 cursor-pointer"
                      title={`${socksAccessory.name} (${socksAccessory.colorName}) – Klicken zum Bearbeiten`}
                    />
                  )}

                  {/* Shoe SVG on top (z-20) so the sock is genuinely under the shoe SVG */}
                  <div
                    onClick={() => onEditGarment?.(footwear)}
                    className={`relative z-20 w-12 h-12 ${
                      onEditGarment ? 'cursor-pointer hover:scale-105 transition-transform' : ''
                    }`}
                    title={`${footwear.name} (${footwear.colorName}) – Klicken zum Bearbeiten`}
                  >
                    <GarmentVector
                      type={footwear.subcategory}
                      colorHex={footwear.colorHex}
                      texture={footwear.texture}
                      className="w-12 h-12 drop-shadow-[0_4px_8px_rgba(0,0,0,0.75)]"
                    />
                  </div>
                </div>
              ))}
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
              onClick={() => onEditGarment?.(item)}
              className={`h-2 flex-1 first:rounded-l-full last:rounded-r-full border border-white/15 ${
                onEditGarment ? 'cursor-pointer hover:opacity-80' : ''
              }`}
              style={{ backgroundColor: item.colorHex }}
              title={`${item.name}: ${item.colorName}`}
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
