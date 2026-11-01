import React, { useId } from 'react';
import { GarmentSubcategory, NecklineType, TextureType } from '../types/wardrobe';

export interface GarmentVectorProps {
  type: GarmentSubcategory;
  colorHex: string;
  texture?: TextureType;
  neckline?: NecklineType;
  className?: string;
  /**
   * When true, openable garments (jackets, coats, overshirts, cardigans, button-downs)
   * render with an open front placket/lapel so underlying layers are visible when stacked.
   */
  openFront?: boolean;
}

/**
 * Dynamic SVG Garment Avatar component that renders tailored architectural silhouettes
 * colored with the exact garment hex code, subtle depth shading, and SVG fabric textures.
 */
export const GarmentVector: React.FC<GarmentVectorProps> = ({
  type,
  colorHex,
  texture = 'smooth_cotton',
  neckline,
  className = 'w-16 h-16',
  openFront = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const patternId = `tex-${uid}`;
  const gradId = `grad-${uid}`;

  // Compute stroke color so dark garments (#141414) remain crisp against dark #09090b cards
  const isVeryDark = isHexDark(colorHex);
  const strokeColor = isVeryDark ? 'rgba(255,255,255,0.34)' : 'rgba(0,0,0,0.42)';
  const detailStroke = isVeryDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.24)';
  const seamStroke = isVeryDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)';
  const patternStroke = isVeryDark ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.15)';
  const collarShadow = isVeryDark ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.18)';

  const renderTexturePattern = () => {
    switch (texture) {
      case 'chunky_knit':
        return (
          <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse">
            <path
              d="M0 4 Q2 1 4 4 T8 4 M0 8 Q2 5 4 8 T8 8"
              fill="none"
              stroke={patternStroke}
              strokeWidth="1.15"
            />
          </pattern>
        );
      case 'fine_knit':
        return (
          <pattern id={patternId} width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M0 2 H4 M2 0 V4" stroke={patternStroke} strokeWidth="0.55" />
          </pattern>
        );
      case 'twill_chino':
      case 'denim':
        return (
          <pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse">
            <path
              d="M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2"
              stroke={patternStroke}
              strokeWidth={texture === 'denim' ? '1.0' : '0.75'}
            />
          </pattern>
        );
      case 'flannel_wool':
        return (
          <pattern id={patternId} width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M0 5 H10 M5 0 V10" stroke={patternStroke} strokeWidth="0.85" />
          </pattern>
        );
      case 'linen':
        return (
          <pattern id={patternId} width="7" height="7" patternUnits="userSpaceOnUse">
            <path d="M0 2 H7 M2 0 V7 M0 5 H7" stroke={patternStroke} strokeWidth="0.5" />
          </pattern>
        );
      case 'tech_waterproof':
        return (
          <pattern id={patternId} width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="none" stroke={patternStroke} strokeWidth="0.5" />
          </pattern>
        );
      case 'heavy_jersey':
        return (
          <pattern id={patternId} width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="0.55" fill={patternStroke} />
          </pattern>
        );
      default:
        return null;
    }
  };

  const renderSilhouette = (fillUrl: string, isOverlay = false) => {
    switch (type) {
      case 't_shirt':
      case 'heavyweight_tee': {
        const isVNeck = neckline === 'v_neck';
        const isHeavy = type === 'heavyweight_tee' || neckline === 'heavy_crewneck';
        return (
          <g>
            {/* Inner neck back shadow */}
            {!isOverlay && (
              <path
                d={isVNeck ? 'M39 14 Q50 18 61 14 L50 28 Z' : 'M39 14 Q50 18 61 14 Q50 24 39 14 Z'}
                fill={collarShadow}
              />
            )}
            {/* Main Tee Body */}
            <path
              d="M31 18 L39 14 C43 21 57 21 61 14 L69 18 L88 30 L80 45 L68 38 L68 85 L32 85 L32 38 L20 45 L12 30 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            {/* Raglan / Set-in Shoulder seams */}
            <path d="M39 14 L32 38 M61 14 L68 38" stroke={seamStroke} strokeWidth="1.2" fill="none" />
            {/* Ribbed Collar */}
            {isVNeck ? (
              <path
                d="M39 14 L50 28 L61 14"
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.4"
                strokeLinejoin="miter"
              />
            ) : (
              <path
                d="M39 14 C43 23.5 57 23.5 61 14"
                fill="none"
                stroke={strokeColor}
                strokeWidth={isHeavy ? '3.6' : '2.2'}
              />
            )}
            {/* Sleeve & bottom twin-needle hems */}
            <line x1="14" y1="28" x2="22" y2="42" stroke={detailStroke} strokeWidth="1.3" />
            <line x1="86" y1="28" x2="78" y2="42" stroke={detailStroke} strokeWidth="1.3" />
            <line x1="32" y1="80" x2="68" y2="80" stroke={detailStroke} strokeWidth="1.4" />
          </g>
        );
      }

      case 'polo':
        return (
          <g>
            {!isOverlay && <path d="M39 15 Q50 19 61 15 L50 23 Z" fill={collarShadow} />}
            <path
              d="M31 19 L39 15 L50 18 L61 15 L69 19 L86 31 L78 45 L68 39 L68 85 L32 85 L32 39 L22 45 L14 31 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            {/* Placket box */}
            <rect
              x="47.5"
              y="19"
              width="5"
              height="18"
              rx="1"
              fill={fillUrl}
              stroke={detailStroke}
              strokeWidth="1.4"
            />
            <circle cx="50" cy="25" r="1" fill={strokeColor} />
            <circle cx="50" cy="31" r="1" fill={strokeColor} />
            {/* Folded Polo Collar */}
            <path
              d="M38 14 L44 24 L50 19 L56 24 L62 14 L58 12 L50 16 L42 12 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
            <line x1="32" y1="80" x2="68" y2="80" stroke={detailStroke} strokeWidth="1.4" />
          </g>
        );

      case 'longsleeve':
      case 'crewneck_sweater':
      case 'knit_sweater':
        return (
          <g>
            {!isOverlay && <path d="M40 14 Q50 18 60 14 Q50 22 40 14 Z" fill={collarShadow} />}
            <path
              d="M32 17 L40 14 C44 20 56 20 60 14 L68 17 L85 32 L79 79 L70 79 L67 38 L67 83 L33 83 L33 38 L30 79 L21 79 L15 32 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            {/* Saddle shoulder lines */}
            <path d="M40 14 L33 38 M60 14 L67 38" stroke={seamStroke} strokeWidth="1.3" fill="none" />
            {/* Ribbed collar + V-gusset on sweatshirt */}
            <path
              d="M40 14 C44 22 56 22 60 14"
              fill="none"
              stroke={strokeColor}
              strokeWidth="3.2"
            />
            {type === 'crewneck_sweater' && (
              <path d="M46 19.5 L50 26 L54 19.5" fill="none" stroke={detailStroke} strokeWidth="1.4" />
            )}
            {/* Ribbed cuffs & waistband */}
            <line x1="21" y1="74" x2="30" y2="74" stroke={detailStroke} strokeWidth="1.8" />
            <line x1="70" y1="74" x2="79" y2="74" stroke={detailStroke} strokeWidth="1.8" />
            <line x1="33" y1="78" x2="67" y2="78" stroke={detailStroke} strokeWidth="2.2" />
          </g>
        );

      case 'turtleneck':
        return (
          <g>
            <path
              d="M40 8 L60 8 L61 17 L68 20 L85 33 L79 79 L70 79 L67 39 L67 83 L33 83 L33 39 L30 79 L21 79 L15 33 L32 20 L39 17 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            {/* Rollneck rib lines */}
            <line x1="39" y1="17" x2="61" y2="17" stroke={strokeColor} strokeWidth="2" />
            <line x1="40" y1="12.5" x2="60" y2="12.5" stroke={detailStroke} strokeWidth="1.4" />
            <path d="M40 17 L33 39 M60 17 L67 39" stroke={seamStroke} strokeWidth="1.2" fill="none" />
            <line x1="33" y1="78" x2="67" y2="78" stroke={detailStroke} strokeWidth="2" />
          </g>
        );

      case 'hoodie':
        return (
          <g>
            {!isOverlay && <path d="M38 15 Q50 23 62 15 Q50 9 38 15 Z" fill={collarShadow} />}
            <path
              d="M35 16 C34 5 66 5 65 16 L69 20 L86 34 L80 79 L70 79 L67 40 L67 83 L33 83 L33 40 L30 79 L20 79 L14 34 L31 20 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            {/* Structured Hood opening */}
            <path d="M39 14 Q50 24 61 14" fill="none" stroke={strokeColor} strokeWidth="2.2" />
            <path d="M38 15 C42 9 58 9 62 15" fill="none" stroke={detailStroke} strokeWidth="1.4" />
            {/* Kangaroo pocket */}
            <path
              d="M38 64 L42 52 L58 52 L62 64 L62 77 L38 77 Z"
              fill="none"
              stroke={detailStroke}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <line x1="33" y1="78" x2="67" y2="78" stroke={detailStroke} strokeWidth="2.2" />
          </g>
        );

      case 'overshirt':
      case 'button_down_shirt': {
        const isOvershirt = type === 'overshirt';
        if (openFront) {
          return (
            <g>
              {/* Left & Right Open Panels revealing underlying base layer */}
              <path
                d="M31 17 L40 13 L45 20 L44 83 L32 83 L32 38 L29 78 L20 78 L14 31 Z"
                fill={fillUrl}
                stroke={strokeColor}
                strokeWidth="2.1"
                strokeLinejoin="round"
              />
              <path
                d="M69 17 L60 13 L55 20 L56 83 L68 83 L68 38 L71 78 L80 78 L86 31 Z"
                fill={fillUrl}
                stroke={strokeColor}
                strokeWidth="2.1"
                strokeLinejoin="round"
              />
              {/* Spread Shirt Collar */}
              <path
                d="M39 13 L44 23 L46 18 M61 13 L56 23 L54 18"
                fill={fillUrl}
                stroke={strokeColor}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {isOvershirt && (
                <>
                  <rect x="34" y="34" width="8" height="10" rx="1" fill="none" stroke={detailStroke} strokeWidth="1.5" />
                  <rect x="58" y="34" width="8" height="10" rx="1" fill="none" stroke={detailStroke} strokeWidth="1.5" />
                </>
              )}
            </g>
          );
        }
        return (
          <g>
            {!isOverlay && <path d="M40 13 L50 18 L60 13 Z" fill={collarShadow} />}
            <path
              d="M32 17 L40 13 L50 16 L60 13 L68 17 L85 31 L79 78 L70 78 L67 38 L67 83 L33 83 L33 38 L30 78 L21 78 L15 31 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            {/* Tailored Collar */}
            <path
              d="M39 13 L45 23 L50 18 L55 23 L61 13"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Button Placket + Buttons */}
            <line x1="48.5" y1="18" x2="48.5" y2="83" stroke={detailStroke} strokeWidth="1.2" />
            <line x1="51.5" y1="18" x2="51.5" y2="83" stroke={detailStroke} strokeWidth="1.2" />
            {[27, 38, 49, 60, 71].map((cy) => (
              <circle key={cy} cx="50" cy={cy} r="1.1" fill={strokeColor} />
            ))}
            {/* Chest Pockets for Overshirt */}
            {isOvershirt && (
              <>
                <rect x="35.5" y="33" width="10" height="11" rx="1" fill="none" stroke={detailStroke} strokeWidth="1.6" />
                <line x1="35.5" y1="36" x2="45.5" y2="36" stroke={detailStroke} strokeWidth="1.3" />
                <rect x="54.5" y="33" width="10" height="11" rx="1" fill="none" stroke={detailStroke} strokeWidth="1.6" />
                <line x1="54.5" y1="36" x2="64.5" y2="36" stroke={detailStroke} strokeWidth="1.3" />
              </>
            )}
          </g>
        );
      }

      case 'cardigan':
        if (openFront) {
          return (
            <g>
              <path
                d="M32 17 L41 14 L45 38 L44 82 L32 82 L32 38 L29 78 L20 78 L15 32 Z"
                fill={fillUrl}
                stroke={strokeColor}
                strokeWidth="2.1"
                strokeLinejoin="round"
              />
              <path
                d="M68 17 L59 14 L55 38 L56 82 L68 82 L68 38 L71 78 L80 78 L85 32 Z"
                fill={fillUrl}
                stroke={strokeColor}
                strokeWidth="2.1"
                strokeLinejoin="round"
              />
            </g>
          );
        }
        return (
          <g>
            <path
              d="M33 17 L42 14 L50 37 L58 14 L67 17 L85 32 L79 78 L70 78 L67 38 L67 82 L33 82 L33 38 L30 78 L21 78 L15 32 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            <path d="M42 14 L50 37 L58 14" fill="none" stroke={detailStroke} strokeWidth="2.5" />
            <line x1="50" y1="37" x2="50" y2="82" stroke={strokeColor} strokeWidth="2.1" />
            {[45, 55, 65, 74].map((cy) => (
              <circle key={cy} cx="50" cy={cy} r="1.3" fill={strokeColor} />
            ))}
          </g>
        );

      case 'blouson':
      case 'light_jacket':
        if (openFront) {
          return (
            <g>
              {/* Left open blouson wing */}
              <path
                d="M30 16 L39 12 L43 18 L42 80 L31 80 L31 38 L28 78 L19 78 L13 31 Z"
                fill={fillUrl}
                stroke={strokeColor}
                strokeWidth="2.3"
                strokeLinejoin="round"
              />
              {/* Right open blouson wing */}
              <path
                d="M70 16 L61 12 L57 18 L58 80 L69 80 L69 38 L72 78 L81 78 L87 31 Z"
                fill={fillUrl}
                stroke={strokeColor}
                strokeWidth="2.3"
                strokeLinejoin="round"
              />
              {/* Stand collar halves */}
              <path d="M39 10 L44 10 L43 16 L39 16 Z M56 10 L61 10 L61 16 L57 16 Z" fill={fillUrl} stroke={strokeColor} strokeWidth="1.8" />
              {/* Slanted welt pockets */}
              <line x1="34" y1="53" x2="39" y2="65" stroke={detailStroke} strokeWidth="1.8" />
              <line x1="66" y1="53" x2="61" y2="65" stroke={detailStroke} strokeWidth="1.8" />
            </g>
          );
        }
        return (
          <g>
            <path
              d="M31 16 L40 12 L60 12 L69 16 L86 31 L80 78 L70 78 L67 38 L67 80 L33 80 L33 38 L30 78 L20 78 L14 31 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.3"
              strokeLinejoin="round"
            />
            {/* Harrington / Stand Collar & Zipper */}
            <rect x="40" y="9.5" width="20" height="6.5" rx="2" fill={fillUrl} stroke={strokeColor} strokeWidth="2" />
            <line x1="50" y1="16" x2="50" y2="80" stroke={strokeColor} strokeWidth="2" />
            {/* Welt pockets + ribbed hem */}
            <line x1="37" y1="54" x2="43" y2="66" stroke={detailStroke} strokeWidth="2" />
            <line x1="63" y1="54" x2="57" y2="66" stroke={detailStroke} strokeWidth="2" />
            <line x1="33" y1="75.5" x2="67" y2="75.5" stroke={detailStroke} strokeWidth="1.8" />
          </g>
        );

      case 'coat':
      case 'parka': {
        const isParka = type === 'parka';
        if (openFront) {
          return (
            <g>
              {/* Left architectural coat panel */}
              <path
                d="M29 14 L39 10 L43 24 L41 90 L29 90 L30 37 L27 77 L18 77 L12 29 Z"
                fill={fillUrl}
                stroke={strokeColor}
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
              {/* Right architectural coat panel */}
              <path
                d="M71 14 L61 10 L57 24 L59 90 L71 90 L70 37 L73 77 L82 77 L88 29 Z"
                fill={fillUrl}
                stroke={strokeColor}
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
              {/* Tailored Notched Lapels */}
              <path
                d="M39 10 L35 24 L38 26 L42 42 M61 10 L65 24 L62 26 L58 42"
                fill="none"
                stroke={strokeColor}
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </g>
          );
        }
        return (
          <g>
            {!isOverlay && <path d="M40 11 L50 26 L60 11 Z" fill={collarShadow} />}
            <path
              d="M30 15 L40 11 L60 11 L70 15 L86 30 L80 77 L70 77 L68 37 L69 90 L31 90 L32 37 L30 77 L20 77 L14 30 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.3"
              strokeLinejoin="round"
            />
            {isParka ? (
              <>
                <path d="M36 12 C36 4 64 4 64 12" fill="none" stroke={strokeColor} strokeWidth="2.2" />
                <rect x="35" y="54" width="11" height="14" rx="1" fill="none" stroke={detailStroke} strokeWidth="1.5" />
                <rect x="54" y="54" width="11" height="14" rx="1" fill="none" stroke={detailStroke} strokeWidth="1.5" />
              </>
            ) : (
              <>
                {/* Notched Coat Lapels */}
                <path
                  d="M40 11 L36 24 L40 25 L50 38 L60 25 L64 24 L60 11"
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="1.9"
                  strokeLinejoin="round"
                />
                <line x1="35" y1="54" x2="44" y2="57" stroke={detailStroke} strokeWidth="2" />
                <line x1="65" y1="54" x2="56" y2="57" stroke={detailStroke} strokeWidth="2" />
              </>
            )}
            <line x1="50" y1="36" x2="50" y2="90" stroke={strokeColor} strokeWidth="1.8" />
            {[46, 58, 70].map((cy) => (
              <circle key={cy} cx="47.5" cy={cy} r="1.4" fill={strokeColor} />
            ))}
          </g>
        );
      }

      case 'chino':
      case 'denim':
      case 'trousers':
      case 'cargo': {
        const isCargo = type === 'cargo';
        const isTrousers = type === 'trousers';
        const isDenim = type === 'denim';
        return (
          <g>
            {/* Tailored Pants Silhouette */}
            <path
              d="M28 11 L72 11 L75 89 L54.5 89 L50 35 L45.5 89 L25 89 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            {/* Waistband & Belt Loops */}
            <line x1="28" y1="18.5" x2="72" y2="18.5" stroke={strokeColor} strokeWidth="1.8" />
            {[35, 44, 56, 65].map((lx) => (
              <line key={lx} x1={lx} y1="11" x2={lx} y2="18.5" stroke={strokeColor} strokeWidth="1.8" />
            ))}
            {/* Fly J-stitch & pocket scoops */}
            <path d="M50 18.5 L50 32 Q53 32 53 29" fill="none" stroke={detailStroke} strokeWidth="1.5" />
            <path d="M28 20 Q35 27 37 18.5 M72 20 Q65 27 63 18.5" fill="none" stroke={detailStroke} strokeWidth="1.5" />
            {/* Center Press Crease for Trousers / Chino */}
            {isTrousers && (
              <>
                <line x1="39" y1="21" x2="35.5" y2="86" stroke={detailStroke} strokeWidth="1.2" />
                <line x1="61" y1="21" x2="64.5" y2="86" stroke={detailStroke} strokeWidth="1.2" />
              </>
            )}
            {/* Denim cuffed hem detail */}
            {isDenim && (
              <>
                <line x1="25.5" y1="84" x2="45.5" y2="84" stroke={detailStroke} strokeWidth="1.6" />
                <line x1="54.5" y1="84" x2="74.5" y2="84" stroke={detailStroke} strokeWidth="1.6" />
              </>
            )}
            {/* Cargo Bellows Pockets */}
            {isCargo && (
              <>
                <rect x="23.5" y="42" width="7.5" height="17" rx="1" fill={fillUrl} stroke={strokeColor} strokeWidth="1.6" />
                <line x1="23.5" y1="46" x2="31" y2="46" stroke={detailStroke} strokeWidth="1.3" />
                <rect x="69" y="42" width="7.5" height="17" rx="1" fill={fillUrl} stroke={strokeColor} strokeWidth="1.6" />
                <line x1="69" y1="46" x2="76.5" y2="46" stroke={detailStroke} strokeWidth="1.3" />
              </>
            )}
          </g>
        );
      }

      case 'shorts':
        return (
          <g>
            <path
              d="M26 15 L74 15 L77 63 L53 63 L50 37 L47 63 L23 63 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            <line x1="26" y1="22.5" x2="74" y2="22.5" stroke={strokeColor} strokeWidth="1.8" />
            <path d="M50 22.5 L50 34 Q53 34 53 31" fill="none" stroke={detailStroke} strokeWidth="1.5" />
            <path d="M26 24 Q33 30 35 22.5 M74 24 Q67 30 65 22.5" fill="none" stroke={detailStroke} strokeWidth="1.4" />
          </g>
        );

      case 'boots':
        return (
          <g>
            {/* Pull tabs */}
            {!isOverlay && (
              <path d="M31 22 L31 17 L35 17 L35 22 M51 22 L51 17 L54 17 L54 22" fill="none" stroke={strokeColor} strokeWidth="1.6" />
            )}
            <path
              d="M29 22 L54 22 L56 50 L82 60 C87 62 89 67 89 73 L89 78 L17 78 L17 67 L25 50 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            {/* Elastic Chelsea Gusset */}
            <path
              d="M35 22 L48 22 L47 47 Q41 50 34 47 Z"
              fill="rgba(0,0,0,0.32)"
              stroke={detailStroke}
              strokeWidth="1.5"
            />
            {/* Goodyear Welt + Lug Sole */}
            <line x1="16" y1="73" x2="89" y2="73" stroke="#b45309" strokeWidth="1.2" opacity="0.7" />
            <rect x="15" y="74" width="75" height="6.5" rx="2" fill="#18181b" stroke={strokeColor} strokeWidth="1.8" />
          </g>
        );

      case 'sneaker_clean':
      case 'sneaker_chunky':
      case 'runner':
      case 'loafer_derby':
      default: {
        const isDerby = type === 'loafer_derby';
        const isChunky = type === 'sneaker_chunky' || type === 'runner';
        return (
          <g>
            <path
              d="M19 41 L44 36 L59 49 L84 55 C89 57 91 62 91 68 L91 74 L13 74 L13 52 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            {/* Heel counter & mudguard panel lines */}
            <path d="M13 55 Q24 55 27 69 M56 47 Q62 59 78 60" fill="none" stroke={detailStroke} strokeWidth="1.4" />
            {/* Sole */}
            <rect
              x="12"
              y="68.5"
              width="80"
              height={isChunky ? '8.5' : '6'}
              rx="2.5"
              fill={isDerby ? '#27201C' : '#F4F1EA'}
              stroke={strokeColor}
              strokeWidth="1.7"
            />
            {/* Lacing bars */}
            <line x1="45" y1="41" x2="51" y2="38" stroke={detailStroke} strokeWidth="1.8" />
            <line x1="49" y1="45" x2="55" y2="42" stroke={detailStroke} strokeWidth="1.8" />
            <line x1="53" y1="49" x2="59" y2="46" stroke={detailStroke} strokeWidth="1.8" />
          </g>
        );
      }
    }
  };

  const hasPattern = texture !== 'smooth_cotton' && texture !== 'leather_suede';

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={`Kleidungsstück-Vektor ${type}`}
    >
      <defs>
        {renderTexturePattern()}
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.07)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.16)" />
        </linearGradient>
      </defs>
      {renderSilhouette(colorHex, false)}
      {/* Subtle 3D Studio Lighting Gradient Overlay */}
      <g className="pointer-events-none">{renderSilhouette(`url(#${gradId})`, true)}</g>
      {hasPattern && (
        <g opacity="0.85" className="pointer-events-none">
          {renderSilhouette(`url(#${patternId})`, true)}
        </g>
      )}
    </svg>
  );
};

function isHexDark(hex: string): boolean {
  const clean = hex.replace(/^#/, '');
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.22;
}
