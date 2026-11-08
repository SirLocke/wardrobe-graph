import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Layers } from 'lucide-react';
import {
  AppLocale,
  BiometricProfile,
  Garment,
  GarmentSubcategory,
} from '../types/wardrobe';
import { GarmentVector } from './GarmentVector';

export type UpperLayerPresetMode = 'all' | 'no_outerwear' | 'base_only';

export interface OutfitLayerStackProps {
  items: Garment[];
  profile: BiometricProfile;
  lockedGarmentIds: string[];
  locale?: AppLocale;
  onToggleLock?: (garmentId: string) => void;
  onEditGarment?: (garment: Garment) => void;
  hiddenLayerIds?: string[];
  onChangeHiddenLayerIds?: (nextHiddenIds: string[]) => void;
  openOverrides?: Record<string, boolean>;
  onToggleOpenOverride?: (garmentId: string, currentEffectiveOpen: boolean) => void;
}

export const OPENABLE_SUBCATEGORIES: GarmentSubcategory[] = [
  'overshirt',
  'button_down_shirt',
  'short_sleeve_shirt',
  'cardigan',
  'blazer',
  'fleece_vest',
  'blouson',
  'light_jacket',
  'leather_jacket',
  'puffer_jacket',
  'down_jacket',
  'fleece_jacket',
  'rain_jacket',
  'coat',
  'parka',
  'trenchcoat',
];

export function isGarmentOpenable(garment: Garment | undefined): boolean {
  if (!garment) return false;
  if (garment.category === 'outerwear') return true;
  return OPENABLE_SUBCATEGORIES.includes(garment.subcategory);
}

export interface UpperLayersBreakdown {
  baseTop?: Garment;
  midLayer?: Garment;
  outerwear?: Garment;
  upperLayers: Garment[];
  hasMultipleUpperLayers: boolean;
}

/**
 * Extracts the up to 3 anatomical torso layers (baseTop, midLayer, outerwear)
 * from an outfit item list.
 */
export function getOutfitUpperLayers(items: Garment[]): UpperLayersBreakdown {
  const baseTops = items.filter((i) => i.category === 'base_top');
  const explicitMidLayer = items.find((i) => i.category === 'mid_layer');
  const baseTop = baseTops[0];
  const midLayer = explicitMidLayer || (baseTops.length > 1 ? baseTops[1] : undefined);
  const outerwear = items.find((i) => i.category === 'outerwear');

  const upperLayers = [baseTop, midLayer, outerwear].filter(
    (g): g is Garment => g !== undefined
  );

  return {
    baseTop,
    midLayer,
    outerwear,
    upperLayers,
    hasMultipleUpperLayers: upperLayers.length > 1,
  };
}

export interface ResolvedUpperLayerState {
  baseTop?: Garment;
  midLayer?: Garment;
  outerwear?: Garment;
  showBaseTop: boolean;
  showMidLayer: boolean;
  showOuterwear: boolean;
  isMidLayerOpen: boolean;
  isOuterwearOpen: boolean;
  activePreset: UpperLayerPresetMode;
  topmostVisibleLayer?: Garment;
  underneathLayer?: Garment;
}

/**
 * Resolves which torso layers are currently visible and whether openable layers
 * are rendered open or closed, ensuring at least one torso layer always stays visible.
 */
export function resolveUpperLayerState(
  items: Garment[],
  hiddenLayerIds: string[] = [],
  openOverrides: Record<string, boolean> = {}
): ResolvedUpperLayerState {
  const { baseTop, midLayer, outerwear } = getOutfitUpperLayers(items);
  const hiddenSet = new Set(hiddenLayerIds);

  let showBaseTop = Boolean(baseTop && !hiddenSet.has(baseTop.id));
  let showMidLayer = Boolean(midLayer && !hiddenSet.has(midLayer.id));
  let showOuterwear = Boolean(outerwear && !hiddenSet.has(outerwear.id));

  // Safeguard: never hide all torso layers at once; fall back to innermost layer
  if (!showBaseTop && !showMidLayer && !showOuterwear) {
    if (baseTop) showBaseTop = true;
    else if (midLayer) showMidLayer = true;
    else if (outerwear) showOuterwear = true;
  }

  const defaultMidOpen =
    midLayer !== undefined &&
    (midLayer.wornOpen !== undefined
      ? midLayer.wornOpen
      : isGarmentOpenable(midLayer));

  const isMidLayerOpen =
    midLayer !== undefined &&
    (openOverrides[midLayer.id] !== undefined
      ? openOverrides[midLayer.id]
      : defaultMidOpen);

  const isOuterwearOpen =
    outerwear !== undefined &&
    (openOverrides[outerwear.id] !== undefined ? openOverrides[outerwear.id] : true);

  let activePreset: UpperLayerPresetMode = 'all';
  if (outerwear && !showOuterwear && midLayer && showMidLayer) {
    activePreset = 'no_outerwear';
  } else if (
    baseTop &&
    showBaseTop &&
    (!midLayer || !showMidLayer) &&
    (!outerwear || !showOuterwear) &&
    (Boolean(midLayer) || Boolean(outerwear))
  ) {
    activePreset = 'base_only';
  }

  const topmostVisibleLayer = showOuterwear
    ? outerwear
    : showMidLayer
    ? midLayer
    : showBaseTop
    ? baseTop
    : undefined;

  const underneathLayer =
    topmostVisibleLayer?.id === outerwear?.id
      ? showMidLayer
        ? midLayer
        : showBaseTop
        ? baseTop
        : undefined
      : topmostVisibleLayer?.id === midLayer?.id
      ? showBaseTop
        ? baseTop
        : undefined
      : undefined;

  return {
    baseTop,
    midLayer,
    outerwear,
    showBaseTop,
    showMidLayer,
    showOuterwear,
    isMidLayerOpen,
    isOuterwearOpen,
    activePreset,
    topmostVisibleLayer,
    underneathLayer,
  };
}

/**
 * Computes the hidden layer IDs for a given preset ('all' | 'no_outerwear' | 'base_only').
 */
export function computeHiddenIdsForPreset(
  items: Garment[],
  preset: UpperLayerPresetMode
): string[] {
  const { midLayer, outerwear } = getOutfitUpperLayers(items);
  if (preset === 'all') return [];
  if (preset === 'no_outerwear') {
    return outerwear ? [outerwear.id] : [];
  }
  // 'base_only'
  const toHide: string[] = [];
  if (outerwear) toHide.push(outerwear.id);
  if (midLayer) toHide.push(midLayer.id);
  return toHide;
}

/**
 * Renders the complete outfit "übereinander" (anatomically stacked from head to toe
 * + layered across the torso so base_top, mid_layer, and outerwear overlap realistically),
 * with an interactive layer toggle to inspect what is worn underneath.
 */
export const OutfitLayerStack: React.FC<OutfitLayerStackProps> = ({
  items,
  locale = 'de',
  onEditGarment,
  hiddenLayerIds: controlledHiddenIds,
  onChangeHiddenLayerIds,
  openOverrides: controlledOpenOverrides,
  onToggleOpenOverride,
}) => {
  const isEn = locale === 'en';
  const itemSignature = items.map((i) => i.id).join('|');

  const [internalHiddenIds, setInternalHiddenIds] = useState<string[]>([]);
  const [internalOpenOverrides, setInternalOpenOverrides] = useState<
    Record<string, boolean>
  >({});

  // Reset internal overrides when the outfit items change
  useEffect(() => {
    setInternalHiddenIds([]);
    setInternalOpenOverrides({});
  }, [itemSignature]);

  const effectiveHiddenIds = controlledHiddenIds ?? internalHiddenIds;
  const effectiveOpenOverrides = controlledOpenOverrides ?? internalOpenOverrides;

  const setHiddenIds = (next: string[]) => {
    if (onChangeHiddenLayerIds) {
      onChangeHiddenLayerIds(next);
    } else {
      setInternalHiddenIds(next);
    }
  };

  const handleToggleOpen = (garmentId: string, currentEffectiveOpen: boolean) => {
    if (onToggleOpenOverride) {
      onToggleOpenOverride(garmentId, currentEffectiveOpen);
    } else {
      setInternalOpenOverrides((prev) => ({
        ...prev,
        [garmentId]: !currentEffectiveOpen,
      }));
    }
  };

  const {
    baseTop,
    midLayer,
    outerwear,
    showBaseTop,
    showMidLayer,
    showOuterwear,
    isMidLayerOpen,
    isOuterwearOpen,
    activePreset,
    topmostVisibleLayer,
    underneathLayer,
  } = resolveUpperLayerState(items, effectiveHiddenIds, effectiveOpenOverrides);

  const { upperLayers, hasMultipleUpperLayers } = getOutfitUpperLayers(items);

  const bottom = items.find((i) => i.category === 'bottom');
  const footwear = items.find((i) => i.category === 'footwear');
  const accessories = items.filter((i) => i.category === 'accessory');

  const headAccessory = accessories.find(
    (a) =>
      a.subcategory === 'cap' ||
      a.subcategory === 'beanie' ||
      a.subcategory === 'cap_beanie'
  );
  const eyewearAccessory = accessories.find(
    (a) => a.subcategory === 'sunglasses' || a.subcategory === 'glasses'
  );
  const scarfAccessory = accessories.find((a) => a.subcategory === 'scarf');
  const necklaceAccessory = accessories.find((a) => a.subcategory === 'necklace');
  const watchAccessory = accessories.find((a) => a.subcategory === 'watch');
  const braceletAccessory = accessories.find((a) => a.subcategory === 'bracelet');
  const bagAccessory = accessories.find((a) => a.subcategory === 'bag_backpack');
  const beltAccessory = accessories.find((a) => a.subcategory === 'belt');
  const socksAccessory = accessories.find(
    (a) => a.subcategory === 'socks' || a.subcategory === 'socks_short'
  );

  const isShortsOrSkirt =
    bottom?.subcategory === 'shorts' ||
    bottom?.subcategory === 'mini_skirt' ||
    bottom?.subcategory === 'midi_skirt';

  const isShortSock = socksAccessory?.subcategory === 'socks_short';
  const isBoot = footwear?.subcategory === 'boots';
  const isAnkleBoot = footwear?.subcategory === 'heeled_ankle_boot';

  const sockBounds = isBoot
    ? {
        x1: 33,
        x2: 50,
        y1: isShortSock ? 11 : 3,
        y2: 34,
        ribX: [37.5, 41.5, 45.5],
        ribY2: isShortSock ? 16 : 19,
      }
    : isAnkleBoot
    ? {
        x1: 29,
        x2: 47,
        y1: isShortSock ? 8 : 2,
        y2: 30,
        ribX: [33.5, 38, 42.5],
        ribY2: isShortSock ? 13 : 16,
      }
    : {
        x1: 22,
        x2: 42,
        y1: isShortSock ? 20 : 6,
        y2: 48,
        ribX: [27, 32, 37],
        ribY2: isShortSock ? 27 : 26,
      };

  const isSockLight = socksAccessory ? (socksAccessory.hsl?.l ?? 50) >= 60 : false;
  const sockStrokeColor = isSockLight ? 'rgba(24,24,27,0.68)' : 'rgba(255,255,255,0.42)';
  const sockRibColor = isSockLight ? 'rgba(24,24,27,0.28)' : 'rgba(255,255,255,0.26)';

  // Check if the currently topmost visible layer can be toggled open/closed over an underneath layer
  const canToggleTopmostOpen =
    topmostVisibleLayer !== undefined &&
    underneathLayer !== undefined &&
    isGarmentOpenable(topmostVisibleLayer);

  const isTopmostCurrentlyOpen =
    topmostVisibleLayer?.id === outerwear?.id
      ? isOuterwearOpen
      : topmostVisibleLayer?.id === midLayer?.id
      ? isMidLayerOpen
      : false;

  const handleToggleIndividualLayer = (layerId: string) => {
    const isCurrentlyHidden = effectiveHiddenIds.includes(layerId);
    if (isCurrentlyHidden) {
      setHiddenIds(effectiveHiddenIds.filter((id) => id !== layerId));
    } else {
      // Only allow hiding if at least one other upper layer remains visible
      const visibleAfterHide = upperLayers.filter(
        (g) => g.id !== layerId && !effectiveHiddenIds.includes(g.id)
      );
      if (visibleAfterHide.length > 0) {
        setHiddenIds([...effectiveHiddenIds, layerId]);
      } else if (baseTop && layerId !== baseTop.id) {
        // Reveal baseTop if user hid the last outer layer
        setHiddenIds(
          upperLayers.filter((g) => g.id !== baseTop.id).map((g) => g.id)
        );
      }
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-between rounded-xl bg-zinc-950/95 border border-zinc-800/90 p-3 select-none overflow-hidden min-h-[370px]">
      {/* Subtle architectural grid lines & vertical studio axis */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 32%, rgba(251,191,36,0.08), transparent 65%)',
        }}
      />
      <div className="pointer-events-none absolute top-4 bottom-4 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-zinc-800/0 via-zinc-800/70 to-zinc-800/0" />

      {/* Top Bar: Layer Switcher & Open/Closed Toggle for Upper Garments */}
      <div className="relative z-30 w-full space-y-1.5 pb-1.5 border-b border-zinc-900/90">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          {hasMultipleUpperLayers ? (
            <div
              className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-900/90 border border-zinc-800"
              role="group"
              aria-label={isEn ? 'Upper layer view' : 'Oberteil-Schichten umschalten'}
            >
              <button
                type="button"
                onClick={() =>
                  setHiddenIds(computeHiddenIdsForPreset(items, 'all'))
                }
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  activePreset === 'all'
                    ? 'bg-zinc-100 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {isEn ? 'All Layers' : 'Komplett'}
              </button>

              {outerwear && midLayer && (
                <button
                  type="button"
                  onClick={() =>
                    setHiddenIds(computeHiddenIdsForPreset(items, 'no_outerwear'))
                  }
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    activePreset === 'no_outerwear'
                      ? 'bg-amber-400 text-zinc-950 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {isEn ? 'No Jacket' : 'Ohne Jacke'}
                </button>
              )}

              {baseTop && (
                <button
                  type="button"
                  onClick={() =>
                    setHiddenIds(computeHiddenIdsForPreset(items, 'base_only'))
                  }
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                    activePreset === 'base_only'
                      ? 'bg-amber-400 text-zinc-950 font-semibold'
                      : 'text-zinc-300 hover:text-zinc-100'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>{isEn ? 'Underneath' : 'Drunter'}</span>
                </button>
              )}
            </div>
          ) : (
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              {isEn ? 'Outfit View' : 'Outfit-Ansicht'}
            </span>
          )}

          {/* 1-Click Open / Closed Toggle for the current outer/mid top */}
          {canToggleTopmostOpen && topmostVisibleLayer && (
            <button
              type="button"
              onClick={() =>
                handleToggleOpen(topmostVisibleLayer.id, isTopmostCurrentlyOpen)
              }
              title={
                isEn
                  ? 'Toggle top layer open or closed to see how it looks'
                  : 'Oberteil offen oder geschlossen darstellen'
              }
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                isTopmostCurrentlyOpen
                  ? 'bg-amber-500/15 border-amber-500/45 text-amber-200'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <Layers className="w-3 h-3 text-amber-400" />
              <span>
                {isTopmostCurrentlyOpen
                  ? isEn
                    ? 'Open'
                    : 'Offen'
                  : isEn
                  ? 'Closed'
                  : 'Geschlossen'}
              </span>
            </button>
          )}
        </div>

        {/* Individual clickable upper layer chips so user sees every top layer & what is underneath */}
        {hasMultipleUpperLayers && (
          <div className="flex flex-wrap items-center gap-1">
            {upperLayers.map((layer) => {
              const isVisible =
                (layer.id === baseTop?.id && showBaseTop) ||
                (layer.id === midLayer?.id && showMidLayer) ||
                (layer.id === outerwear?.id && showOuterwear);
              const isBase = layer.id === baseTop?.id;
              const rolePrefix = isBase
                ? isEn
                  ? 'Under: '
                  : 'Drunter: '
                : '';

              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => handleToggleIndividualLayer(layer.id)}
                  title={
                    isVisible
                      ? isEn
                        ? `Hide ${layer.name} to see underneath`
                        : `${layer.name} ausblenden, um Schicht drunter zu sehen`
                      : isEn
                      ? `Show ${layer.name}`
                      : `${layer.name} einblenden`
                  }
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] transition-all cursor-pointer max-w-full ${
                    isVisible
                      ? 'bg-zinc-900/95 border-zinc-700/90 text-zinc-200 font-medium'
                      : 'bg-zinc-950/60 border-zinc-800/60 text-zinc-500 line-through opacity-75 hover:opacity-100'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full border border-white/25 shrink-0"
                    style={{ backgroundColor: layer.colorHex }}
                  />
                  <span className="truncate max-w-[115px]">
                    {rolePrefix}
                    {layer.name}
                  </span>
                  {isVisible ? (
                    <Eye className="w-2.5 h-2.5 text-amber-400/80 shrink-0" />
                  ) : (
                    <EyeOff className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pure 2D Clothing & Accessories Composition (No face, no body, all pieces clickable) */}
      <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-center py-1">
        {/* 1. HEADWEAR & EYEWEAR ZONE */}
        {(headAccessory || eyewearAccessory) && (
          <div
            className={`relative flex flex-col items-center justify-center z-30 ${
              eyewearAccessory ? '-mb-2.5' : '-mb-0.5'
            }`}
          >
            {headAccessory && (
              <div
                onClick={() => onEditGarment?.(headAccessory)}
                className={`relative w-14 h-11 z-30 flex items-center justify-center ${
                  eyewearAccessory ? '-mb-2' : 'mb-0'
                } ${
                  onEditGarment ? 'cursor-pointer hover:scale-105 transition-transform' : ''
                }`}
                title={`${headAccessory.name} (${headAccessory.colorName}) – Klicken zum Bearbeiten`}
              >
                <GarmentVector
                  type={headAccessory.subcategory}
                  colorHex={headAccessory.colorHex}
                  accentColorHex={headAccessory.accentColorHex}
                  pattern={headAccessory.pattern}
                  texture={headAccessory.texture}
                  className="w-14 h-14 drop-shadow-[0_3px_6px_rgba(0,0,0,0.75)]"
                />
              </div>
            )}

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
                  accentColorHex={eyewearAccessory.accentColorHex}
                  pattern={eyewearAccessory.pattern}
                  texture={eyewearAccessory.texture}
                  className="w-11 h-11 drop-shadow-[0_2px_5px_rgba(0,0,0,0.75)]"
                />
              </div>
            )}
          </div>
        )}

        {/* 2. TORSO ZONE (2D Layered Tops + Draped Scarf + 2D Watch & Bracelet below Sleeve Cuffs) */}
        <div className="relative w-36 h-36 flex items-center justify-center z-20">
          {/* Layer A: Base-Top (innermost — "Drunter") */}
          {baseTop && showBaseTop && (
            <div
              onClick={() => onEditGarment?.(baseTop)}
              className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
                onEditGarment ? 'cursor-pointer hover:brightness-110' : ''
              }`}
              style={{
                transform:
                  showMidLayer && !isMidLayerOpen
                    ? 'translateY(-7px) scale(0.97)'
                    : !showMidLayer && !showOuterwear
                    ? 'translateY(2px) scale(1.02)'
                    : 'translateY(0px) scale(0.96)',
                zIndex: 10,
              }}
              title={`${baseTop.name} (${baseTop.colorName}) – Klicken zum Bearbeiten`}
            >
              <GarmentVector
                type={baseTop.subcategory}
                colorHex={baseTop.colorHex}
                accentColorHex={baseTop.accentColorHex}
                pattern={baseTop.pattern}
                texture={baseTop.texture}
                neckline={baseTop.neckline}
                openFront={Boolean(baseTop.wornOpen) && !showMidLayer}
                wornOpen={Boolean(baseTop.wornOpen) && !showMidLayer}
                hasPrint={baseTop.hasPrint}
                hasLogo={baseTop.hasLogo}
                className="w-32 h-32 drop-shadow-[0_4px_10px_rgba(0,0,0,0.65)]"
              />
            </div>
          )}

          {/* Layer B: Mid-Layer */}
          {midLayer && showMidLayer && (
            <div
              onClick={() => onEditGarment?.(midLayer)}
              className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
                onEditGarment ? 'cursor-pointer hover:brightness-110' : ''
              }`}
              style={{
                transform: isMidLayerOpen && showBaseTop
                  ? 'translateY(1px) scale(1.03)'
                  : 'translateY(4px) scale(1.01)',
                zIndex: 20,
              }}
              title={`${midLayer.name} (${midLayer.colorName}) – Klicken zum Bearbeiten`}
            >
              <GarmentVector
                type={midLayer.subcategory}
                colorHex={midLayer.colorHex}
                accentColorHex={midLayer.accentColorHex}
                pattern={midLayer.pattern}
                texture={midLayer.texture}
                neckline={midLayer.neckline}
                openFront={isMidLayerOpen && showBaseTop}
                wornOpen={isMidLayerOpen && showBaseTop}
                hasPrint={midLayer.hasPrint}
                hasLogo={midLayer.hasLogo}
                className="w-34 h-34 drop-shadow-[0_6px_14px_rgba(0,0,0,0.75)]"
              />
            </div>
          )}

          {/* Layer C: Outerwear */}
          {outerwear && showOuterwear && (
            <div
              onClick={() => onEditGarment?.(outerwear)}
              className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
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
                accentColorHex={outerwear.accentColorHex}
                pattern={outerwear.pattern}
                texture={outerwear.texture}
                neckline={outerwear.neckline}
                openFront={isOuterwearOpen && (showMidLayer || showBaseTop)}
                wornOpen={isOuterwearOpen && (showMidLayer || showBaseTop)}
                hasPrint={outerwear.hasPrint}
                hasLogo={outerwear.hasLogo}
                className="w-36 h-36 drop-shadow-[0_8px_18px_rgba(0,0,0,0.85)]"
              />
            </div>
          )}

          {/* Collar Zone 1: Clickable Necklace sitting in the neckline */}
          {necklaceAccessory && (
            <div
              onClick={() => onEditGarment?.(necklaceAccessory)}
              style={{ zIndex: 35 }}
              className={`absolute top-[4%] left-1/2 -translate-x-1/2 w-11 h-9 flex items-center justify-center ${
                onEditGarment ? 'cursor-pointer hover:scale-110 transition-transform' : ''
              }`}
              title={`${necklaceAccessory.name} (${necklaceAccessory.colorName}) – Klicken zum Bearbeiten`}
            >
              <GarmentVector
                type={necklaceAccessory.subcategory}
                colorHex={necklaceAccessory.colorHex}
                accentColorHex={necklaceAccessory.accentColorHex}
                texture={necklaceAccessory.texture}
                className="w-11 h-9 drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)]"
              />
            </div>
          )}

          {/* Collar Zone 2: Clickable Draped Scarf on top of sweater/jacket collar */}
          {scarfAccessory && (
            <div
              onClick={() => onEditGarment?.(scarfAccessory)}
              style={{ zIndex: 42 }}
              className={`absolute top-[4%] left-1/2 -translate-x-1/2 w-16 h-16 flex items-center justify-center ${
                onEditGarment ? 'cursor-pointer hover:scale-105 transition-transform' : ''
              }`}
              title={`${scarfAccessory.name} (${scarfAccessory.colorName}) – Klicken zum Bearbeiten`}
            >
              <GarmentVector
                type={scarfAccessory.subcategory}
                colorHex={scarfAccessory.colorHex}
                accentColorHex={scarfAccessory.accentColorHex}
                texture={scarfAccessory.texture}
                className="w-16 h-16 drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]"
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
                accentColorHex={watchAccessory.accentColorHex}
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
                accentColorHex={braceletAccessory.accentColorHex}
                texture={braceletAccessory.texture}
                className="w-6 h-6 drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)]"
              />
            </div>
          )}

          {/* Optional Bag / Backpack at the side */}
          {bagAccessory && (
            <div
              onClick={() => onEditGarment?.(bagAccessory)}
              style={{ zIndex: 38 }}
              className={`absolute -right-5 top-8 flex items-center justify-center ${
                onEditGarment ? 'cursor-pointer hover:scale-105 transition-transform' : ''
              }`}
              title={`${bagAccessory.name} (${bagAccessory.colorName}) – Klicken zum Bearbeiten`}
            >
              <GarmentVector
                type={bagAccessory.subcategory}
                colorHex={bagAccessory.colorHex}
                accentColorHex={bagAccessory.accentColorHex}
                texture={bagAccessory.texture}
                className="w-11 h-11 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]"
              />
            </div>
          )}
        </div>

        {/* 2b. WAIST BELT ZONE */}
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
              accentColorHex={beltAccessory.accentColorHex}
              texture={beltAccessory.texture}
              className="w-16 h-16 drop-shadow-[0_3px_6px_rgba(0,0,0,0.85)]"
            />
          </div>
        )}

        {/* 3. BOTTOM ZONE */}
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
              accentColorHex={bottom.accentColorHex}
              pattern={bottom.pattern}
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
              isShortsOrSkirt ? '-mt-1.5' : '-mt-3'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              {(['left', 'right'] as const).map((side) => (
                <div
                  key={side}
                  className={`relative w-12 h-12 ${side === 'left' ? '-scale-x-100 transform' : ''}`}
                >
                  {socksAccessory && (
                    <svg
                      viewBox="0 0 100 100"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditGarment?.(socksAccessory);
                      }}
                      className={`absolute inset-0 w-full h-full z-10 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)] ${
                        onEditGarment ? 'cursor-pointer hover:brightness-125 transition-all' : ''
                      }`}
                    >
                      <title>{`${socksAccessory.name} (${socksAccessory.colorName}) – Klicken zum Bearbeiten`}</title>
                      <path
                        d={`M${sockBounds.x1} ${sockBounds.y1} L${sockBounds.x2} ${sockBounds.y1} L${sockBounds.x2} ${sockBounds.y2} L${sockBounds.x1} ${sockBounds.y2} Z`}
                        fill={socksAccessory.colorHex}
                        stroke={sockStrokeColor}
                        strokeWidth="1.9"
                        strokeLinejoin="round"
                      />
                      <line
                        x1={sockBounds.x1 + 1}
                        y1={sockBounds.y1 + 3.5}
                        x2={sockBounds.x2 - 1}
                        y2={sockBounds.y1 + 3.5}
                        stroke={sockRibColor}
                        strokeWidth="1.2"
                      />
                      {!isShortSock &&
                        sockBounds.ribX.map((rx) => (
                          <line
                            key={rx}
                            x1={rx}
                            y1={sockBounds.y1 + 1}
                            x2={rx}
                            y2={sockBounds.ribY2}
                            stroke={sockRibColor}
                            strokeWidth="1.2"
                          />
                        ))}
                    </svg>
                  )}

                  {socksAccessory && onEditGarment && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditGarment(socksAccessory);
                      }}
                      className="absolute left-[18%] top-[2%] w-[36%] h-[34%] z-30 cursor-pointer"
                      title={`${socksAccessory.name} (${socksAccessory.colorName}) – Klicken zum Bearbeiten`}
                    />
                  )}

                  <div
                    onClick={() => onEditGarment?.(footwear)}
                    className={`relative z-20 w-12 h-12 ${
                      onEditGarment ? 'cursor-pointer hover:scale-105 transition-transform' : ''
                    }`}
                    title={`${footwear.name} (${footwear.colorName}${
                      footwear.accentColorName ? ` / ${footwear.accentColorName}` : ''
                    }) – Klicken zum Bearbeiten`}
                  >
                    <GarmentVector
                      type={footwear.subcategory}
                      colorHex={footwear.colorHex}
                      accentColorHex={footwear.accentColorHex}
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

      {/* Bottom Color Swatch Bar (Reflects currently visible items so you see the exact color effect) */}
      <div className="relative z-10 w-full pt-2 border-t border-zinc-900 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 flex-1">
          {items
            .filter((item) => !effectiveHiddenIds.includes(item.id))
            .map((item) => (
              <div
                key={item.id}
                onClick={() => onEditGarment?.(item)}
                className={`relative h-2 flex-1 first:rounded-l-full last:rounded-r-full border border-white/15 overflow-hidden flex ${
                  onEditGarment ? 'cursor-pointer hover:opacity-80' : ''
                }`}
                style={{ backgroundColor: item.colorHex }}
                title={`${item.name}: ${item.colorName}${
                  item.accentColorName ? ` (Akzent: ${item.accentColorName})` : ''
                }`}
              >
                {item.accentColorHex &&
                  item.accentColorHex.toUpperCase() !== item.colorHex.toUpperCase() && (
                    <span
                      className="h-full w-1/3 ml-auto border-l border-black/20"
                      style={{ backgroundColor: item.accentColorHex }}
                    />
                  )}
              </div>
            ))}
        </div>
        <span className="text-[10px] font-mono text-zinc-500 tabular-nums shrink-0">
          {activePreset === 'base_only'
            ? isEn
              ? 'Underneath'
              : 'Drunter'
            : activePreset === 'no_outerwear'
            ? isEn
              ? 'No Jacket'
              : 'Ohne Jacke'
            : isEn
            ? 'Stacked'
            : 'Übereinander'}
        </span>
      </div>
    </div>
  );
};
