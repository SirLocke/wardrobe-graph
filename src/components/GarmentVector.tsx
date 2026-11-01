import React, { useId } from 'react';
import { GarmentSubcategory, NecklineType, TextureType } from '../types/wardrobe';

export interface GarmentVectorProps {
  type: GarmentSubcategory;
  colorHex: string;
  texture?: TextureType;
  neckline?: NecklineType;
  className?: string;
  /**
   * When true, openable garments (jackets, coats, trenchcoats, blazers, overshirts, cardigans)
   * render with an open front placket/lapel so underlying layers are visible when stacked.
   */
  openFront?: boolean;
}

/**
 * Dynamic SVG Garment Avatar component that renders 38 tailored architectural silhouettes
 * (Menswear, Womenswear & Unisex) colored with the exact garment hex code, studio lighting
 * depth gradient, and SVG fabric texture patterns.
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
            {!isOverlay && (
              <path
                d={isVNeck ? 'M39 14 Q50 18 61 14 L50 28 Z' : 'M39 14 Q50 18 61 14 Q50 24 39 14 Z'}
                fill={collarShadow}
              />
            )}
            <path
              d="M31 18 L39 14 C43 21 57 21 61 14 L69 18 L88 30 L80 45 L68 38 L68 85 L32 85 L32 38 L20 45 L12 30 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            <path d="M39 14 L32 38 M61 14 L68 38" stroke={seamStroke} strokeWidth="1.2" fill="none" />
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
            <line x1="14" y1="28" x2="22" y2="42" stroke={detailStroke} strokeWidth="1.3" />
            <line x1="86" y1="28" x2="78" y2="42" stroke={detailStroke} strokeWidth="1.3" />
            <line x1="32" y1="80" x2="68" y2="80" stroke={detailStroke} strokeWidth="1.4" />
          </g>
        );
      }

      case 'crop_top':
        return (
          <g>
            {!isOverlay && <path d="M39 15 Q50 19 61 15 Q50 23 39 15 Z" fill={collarShadow} />}
            <path
              d="M30 19 L39 15 C43 21 57 21 61 15 L70 19 L87 30 L79 44 L68 38 L69 62 L31 62 L32 38 L21 44 L13 30 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            <path d="M39 15 C43 23 57 23 61 15" fill="none" stroke={strokeColor} strokeWidth="3" />
            <line x1="31" y1="58" x2="69" y2="58" stroke={detailStroke} strokeWidth="1.6" />
          </g>
        );

      case 'tank_camisole':
        return (
          <g>
            {!isOverlay && <path d="M38 14 Q50 30 62 14 Q50 22 38 14 Z" fill={collarShadow} />}
            <path
              d="M35 14 L40 14 C42 29 58 29 60 14 L65 14 L65 34 C68 38 69 44 68 83 L32 83 C31 44 32 38 35 34 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            <path d="M40 14 C42 31 58 31 60 14" fill="none" stroke={detailStroke} strokeWidth="1.6" />
            <line x1="32" y1="78" x2="68" y2="78" stroke={detailStroke} strokeWidth="1.4" />
          </g>
        );

      case 'bodysuit':
        return (
          <g>
            {!isOverlay && <path d="M39 14 Q50 21 61 14 Z" fill={collarShadow} />}
            <path
              d="M34 15 L40 13 C44 20 56 20 60 13 L66 15 L67 60 C60 66 55 76 53 85 L47 85 C45 76 40 66 33 60 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            <path d="M40 13 C44 21 56 21 60 13" fill="none" stroke={strokeColor} strokeWidth="2.4" />
            <path d="M38 56 Q44 48 45 26 M62 56 Q56 48 55 26" fill="none" stroke={seamStroke} strokeWidth="1.2" />
          </g>
        );

      case 'blouse':
        return (
          <g>
            {!isOverlay && <path d="M40 13 L50 28 L60 13 Z" fill={collarShadow} />}
            {/* Flowing draped silk blouse with bishop sleeves */}
            <path
              d="M32 17 L40 13 L50 27 L60 13 L68 17 L85 32 C87 48 84 68 79 78 L69 78 L67 39 L69 83 L31 83 L33 39 L31 78 L21 78 C16 68 13 48 15 32 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            {/* Draped Lapel / V-Placket */}
            <path
              d="M38 14 L50 31 L62 14"
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <line x1="50" y1="31" x2="50" y2="83" stroke={detailStroke} strokeWidth="1.4" />
            {/* Gathered cuffs */}
            <line x1="21" y1="73" x2="31" y2="73" stroke={strokeColor} strokeWidth="2" />
            <line x1="69" y1="73" x2="79" y2="73" stroke={strokeColor} strokeWidth="2" />
          </g>
        );

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
            <path d="M40 14 L33 38 M60 14 L67 38" stroke={seamStroke} strokeWidth="1.3" fill="none" />
            <path
              d="M40 14 C44 22 56 22 60 14"
              fill="none"
              stroke={strokeColor}
              strokeWidth="3.2"
            />
            {type === 'crewneck_sweater' && (
              <path d="M46 19.5 L50 26 L54 19.5" fill="none" stroke={detailStroke} strokeWidth="1.4" />
            )}
            <line x1="21" y1="74" x2="30" y2="74" stroke={detailStroke} strokeWidth="1.8" />
            <line x1="70" y1="74" x2="79" y2="74" stroke={detailStroke} strokeWidth="1.8" />
            <line x1="33" y1="78" x2="67" y2="78" stroke={detailStroke} strokeWidth="2.2" />
          </g>
        );

      case 'vest_gilet':
        return (
          <g>
            {!isOverlay && <path d="M39 14 L50 35 L61 14 Z" fill={collarShadow} />}
            <path
              d="M32 16 L40 13 L50 35 L60 13 L68 16 C65 27 65 35 68 41 L67 82 L33 82 L32 41 C35 35 35 27 32 16 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            <path d="M40 13 L50 36 L60 13" fill="none" stroke={strokeColor} strokeWidth="2.8" />
            <line x1="33" y1="77" x2="67" y2="77" stroke={detailStroke} strokeWidth="2.2" />
          </g>
        );

      case 'wrap_top':
        return (
          <g>
            {!isOverlay && <path d="M40 14 L50 34 L60 14 Z" fill={collarShadow} />}
            <path
              d="M32 17 L40 14 L50 33 L60 14 L68 17 L85 32 L78 78 L69 78 L67 38 L67 81 L33 81 L33 38 L31 78 L22 78 L15 32 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            {/* Diagonal Wrap Surplice Line + Tie Belt */}
            <path d="M40 14 L63 62 M60 14 L46 42" fill="none" stroke={strokeColor} strokeWidth="2" />
            <path d="M33 63 L67 63 M61 63 L66 75 M63 63 L58 74" fill="none" stroke={strokeColor} strokeWidth="2" />
          </g>
        );

      case 'blazer':
        if (openFront) {
          return (
            <g>
              {/* Left Tailored Blazer Panel */}
              <path
                d="M30 16 L40 12 L45 36 L43 84 L31 84 L32 38 L29 78 L20 78 L14 30 Z"
                fill={fillUrl}
                stroke={strokeColor}
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Right Tailored Blazer Panel */}
              <path
                d="M70 16 L60 12 L55 36 L57 84 L69 84 L68 38 L71 78 L80 78 L86 30 Z"
                fill={fillUrl}
                stroke={strokeColor}
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Sharp Notched Blazer Lapels */}
              <path
                d="M40 12 L35 23 L39 24 L45 38 M60 12 L65 23 L61 24 L55 38"
                fill="none"
                stroke={strokeColor}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <rect x="33" y="59" width="8" height="3" fill="none" stroke={detailStroke} strokeWidth="1.3" />
              <rect x="59" y="59" width="8" height="3" fill="none" stroke={detailStroke} strokeWidth="1.3" />
            </g>
          );
        }
        return (
          <g>
            {!isOverlay && <path d="M40 12 L50 38 L60 12 Z" fill={collarShadow} />}
            <path
              d="M30 16 L40 12 L50 36 L60 12 L70 16 L86 30 L80 78 L70 78 L68 38 L69 84 L52 84 L50 76 L48 84 L31 84 L32 38 L30 78 L20 78 L14 30 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            {/* Sharp Peak/Notch Lapels */}
            <path
              d="M40 12 L35 23 L39 24 L50 39 L61 24 L65 23 L60 12"
              fill="none"
              stroke={strokeColor}
              strokeWidth="1.9"
              strokeLinejoin="round"
            />
            <line x1="50" y1="38" x2="50" y2="76" stroke={strokeColor} strokeWidth="1.8" />
            <circle cx="48" cy="49" r="1.4" fill={strokeColor} />
            <circle cx="48" cy="59" r="1.4" fill={strokeColor} />
            <rect x="34" y="60" width="10" height="3.5" rx="0.5" fill="none" stroke={detailStroke} strokeWidth="1.4" />
            <rect x="56" y="60" width="10" height="3.5" rx="0.5" fill="none" stroke={detailStroke} strokeWidth="1.4" />
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
            <path d="M39 14 Q50 24 61 14" fill="none" stroke={strokeColor} strokeWidth="2.2" />
            <path d="M38 15 C42 9 58 9 62 15" fill="none" stroke={detailStroke} strokeWidth="1.4" />
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
            <path
              d="M39 13 L45 23 L50 18 L55 23 L61 13"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <line x1="48.5" y1="18" x2="48.5" y2="83" stroke={detailStroke} strokeWidth="1.2" />
            <line x1="51.5" y1="18" x2="51.5" y2="83" stroke={detailStroke} strokeWidth="1.2" />
            {[27, 38, 49, 60, 71].map((cy) => (
              <circle key={cy} cx="50" cy={cy} r="1.1" fill={strokeColor} />
            ))}
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
      case 'leather_jacket':
      case 'puffer_jacket': {
        const isLeather = type === 'leather_jacket';
        const isPuffer = type === 'puffer_jacket';
        if (openFront) {
          return (
            <g>
              <path
                d="M30 16 L39 12 L43 18 L42 80 L31 80 L31 38 L28 78 L19 78 L13 31 Z"
                fill={fillUrl}
                stroke={strokeColor}
                strokeWidth="2.3"
                strokeLinejoin="round"
              />
              <path
                d="M70 16 L61 12 L57 18 L58 80 L69 80 L69 38 L72 78 L81 78 L87 31 Z"
                fill={fillUrl}
                stroke={strokeColor}
                strokeWidth="2.3"
                strokeLinejoin="round"
              />
              <path d="M39 10 L44 10 L43 16 L39 16 Z M56 10 L61 10 L61 16 L57 16 Z" fill={fillUrl} stroke={strokeColor} strokeWidth="1.8" />
              {isPuffer && (
                <>
                  <line x1="31" y1="36" x2="42" y2="36" stroke={detailStroke} strokeWidth="1.6" />
                  <line x1="31" y1="54" x2="42" y2="54" stroke={detailStroke} strokeWidth="1.6" />
                  <line x1="58" y1="36" x2="69" y2="36" stroke={detailStroke} strokeWidth="1.6" />
                  <line x1="58" y1="54" x2="69" y2="54" stroke={detailStroke} strokeWidth="1.6" />
                </>
              )}
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
            <rect x="40" y="9.5" width="20" height="6.5" rx="2" fill={fillUrl} stroke={strokeColor} strokeWidth="2" />
            {/* Asymmetric biker zip for leather_jacket or center zip */}
            <line
              x1={isLeather ? '45' : '50'}
              y1="16"
              x2={isLeather ? '54' : '50'}
              y2="80"
              stroke={strokeColor}
              strokeWidth="2"
            />
            {isPuffer ? (
              <>
                <line x1="33" y1="34" x2="67" y2="34" stroke={detailStroke} strokeWidth="1.7" />
                <line x1="33" y1="50" x2="67" y2="50" stroke={detailStroke} strokeWidth="1.7" />
                <line x1="33" y1="66" x2="67" y2="66" stroke={detailStroke} strokeWidth="1.7" />
              </>
            ) : (
              <>
                <line x1="37" y1="54" x2="43" y2="66" stroke={detailStroke} strokeWidth="2" />
                <line x1="63" y1="54" x2="57" y2="66" stroke={detailStroke} strokeWidth="2" />
                <line x1="33" y1="75.5" x2="67" y2="75.5" stroke={detailStroke} strokeWidth="1.8" />
              </>
            )}
          </g>
        );
      }

      case 'coat':
      case 'parka':
      case 'trenchcoat': {
        const isParka = type === 'parka';
        const isTrench = type === 'trenchcoat';
        if (openFront) {
          return (
            <g>
              <path
                d="M29 14 L39 10 L43 24 L41 90 L28 90 L30 37 L27 77 L18 77 L12 29 Z"
                fill={fillUrl}
                stroke={strokeColor}
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
              <path
                d="M71 14 L61 10 L57 24 L59 90 L72 90 L70 37 L73 77 L82 77 L88 29 Z"
                fill={fillUrl}
                stroke={strokeColor}
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
              <path
                d="M39 10 L35 24 L38 26 L42 42 M61 10 L65 24 L62 26 L58 42"
                fill="none"
                stroke={strokeColor}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {isTrench && (
                <>
                  <path d="M31 32 L42 35 M69 32 L58 35" stroke={detailStroke} strokeWidth="1.6" />
                  <line x1="29" y1="54" x2="41" y2="54" stroke={strokeColor} strokeWidth="2.4" />
                  <line x1="59" y1="54" x2="71" y2="54" stroke={strokeColor} strokeWidth="2.4" />
                </>
              )}
            </g>
          );
        }
        return (
          <g>
            {!isOverlay && <path d="M40 11 L50 26 L60 11 Z" fill={collarShadow} />}
            <path
              d="M30 15 L40 11 L60 11 L70 15 L86 30 L80 77 L70 77 L68 37 L71 90 L29 90 L32 37 L30 77 L20 77 L14 30 Z"
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
                <path
                  d="M40 11 L35 24 L40 25 L50 38 L60 25 L65 24 L60 11"
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="1.9"
                  strokeLinejoin="round"
                />
                {isTrench && (
                  <>
                    {/* Trench storm flaps & waist belt */}
                    <path d="M32 33 L45 36 M68 33 L55 36" stroke={detailStroke} strokeWidth="1.6" />
                    <rect x="31" y="52" width="38" height="4.5" rx="1" fill={fillUrl} stroke={strokeColor} strokeWidth="1.9" />
                    <rect x="47" y="51.5" width="6" height="5.5" rx="1" fill="none" stroke={strokeColor} strokeWidth="1.8" />
                  </>
                )}
              </>
            )}
            <line x1="50" y1="36" x2="50" y2="90" stroke={strokeColor} strokeWidth="1.8" />
            {[44, 62, 74].map((cy) => (
              <circle key={cy} cx="46.5" cy={cy} r="1.4" fill={strokeColor} />
            ))}
          </g>
        );
      }

      case 'wide_leg_trousers':
        return (
          <g>
            {/* High-Waist Palazzo / Wide-Leg Drape */}
            <path
              d="M31 10 L69 10 L81 89 L53 89 L50 34 L47 89 L19 89 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            <line x1="31" y1="17.5" x2="69" y2="17.5" stroke={strokeColor} strokeWidth="1.8" />
            {/* Double waist pleats */}
            <line x1="39" y1="17.5" x2="32" y2="86" stroke={detailStroke} strokeWidth="1.3" />
            <line x1="61" y1="17.5" x2="68" y2="86" stroke={detailStroke} strokeWidth="1.3" />
            <line x1="50" y1="17.5" x2="50" y2="33" stroke={detailStroke} strokeWidth="1.5" />
          </g>
        );

      case 'midi_skirt':
        return (
          <g>
            {/* Flowing A-Line Midi Skirt */}
            <path
              d="M33 12 L67 12 L79 84 C64 88 36 88 21 84 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            <line x1="33" y1="19" x2="67" y2="19" stroke={strokeColor} strokeWidth="1.8" />
            {/* Fluid drape lines */}
            <path d="M43 19 L36 85 M57 19 L64 85 M50 19 L50 86" fill="none" stroke={seamStroke} strokeWidth="1.2" />
          </g>
        );

      case 'mini_skirt':
        return (
          <g>
            {/* Tailored A-Line Mini Skirt */}
            <path
              d="M31 16 L69 16 L76 58 L24 58 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            <line x1="31" y1="23" x2="69" y2="23" stroke={strokeColor} strokeWidth="1.8" />
            <line x1="44" y1="23" x2="41" y2="58" stroke={detailStroke} strokeWidth="1.3" />
            <line x1="56" y1="23" x2="59" y2="58" stroke={detailStroke} strokeWidth="1.3" />
          </g>
        );

      case 'chino':
      case 'denim':
      case 'trousers':
      case 'cargo': {
        const isCargo = type === 'cargo';
        const isTrousers = type === 'trousers';
        const isDenim = type === 'denim';
        return (
          <g>
            <path
              d="M28 11 L72 11 L75 89 L54.5 89 L50 35 L45.5 89 L25 89 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            <line x1="28" y1="18.5" x2="72" y2="18.5" stroke={strokeColor} strokeWidth="1.8" />
            {[35, 44, 56, 65].map((lx) => (
              <line key={lx} x1={lx} y1="11" x2={lx} y2="18.5" stroke={strokeColor} strokeWidth="1.8" />
            ))}
            <path d="M50 18.5 L50 32 Q53 32 53 29" fill="none" stroke={detailStroke} strokeWidth="1.5" />
            <path d="M28 20 Q35 27 37 18.5 M72 20 Q65 27 63 18.5" fill="none" stroke={detailStroke} strokeWidth="1.5" />
            {isTrousers && (
              <>
                <line x1="39" y1="21" x2="35.5" y2="86" stroke={detailStroke} strokeWidth="1.2" />
                <line x1="61" y1="21" x2="64.5" y2="86" stroke={detailStroke} strokeWidth="1.2" />
              </>
            )}
            {isDenim && (
              <>
                <line x1="25.5" y1="84" x2="45.5" y2="84" stroke={detailStroke} strokeWidth="1.6" />
                <line x1="54.5" y1="84" x2="74.5" y2="84" stroke={detailStroke} strokeWidth="1.6" />
              </>
            )}
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

      case 'heeled_ankle_boot':
        return (
          <g>
            {/* Architectural Block-Heel Ankle Boot */}
            <path
              d="M25 18 L51 18 L55 48 L84 62 C88 64 89 68 89 72 L52 72 L45 58 L35 58 L35 76 L19 76 L19 52 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            {/* Block Heel & Sole */}
            <path
              d="M19 72 L35 72 L35 80 L19 80 Z M52 72 L89 72 L89 76 L52 76 Z"
              fill="#18181b"
              stroke={strokeColor}
              strokeWidth="1.6"
            />
            <line x1="38" y1="18" x2="38" y2="54" stroke={detailStroke} strokeWidth="1.5" />
          </g>
        );

      case 'ballet_flat':
        return (
          <g>
            {/* Minimalist Mary-Jane / Ballet Flat */}
            <path
              d="M15 52 L32 52 C36 62 56 62 64 52 L85 57 C90 59 91 64 90 69 L14 69 C12 63 13 56 15 52 Z"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.1"
              strokeLinejoin="round"
            />
            {/* Mary-Jane Arch Strap */}
            <line x1="48" y1="50" x2="48" y2="62" stroke={strokeColor} strokeWidth="2.4" />
            <rect x="13" y="68" width="77" height="4" rx="1.5" fill="#18181b" stroke={strokeColor} strokeWidth="1.4" />
          </g>
        );

      case 'sandal_strappy':
        return (
          <g>
            {/* Architectural Leather Mule / Strappy Sandal */}
            <rect x="14" y="66" width="74" height="6" rx="2.5" fill="#27201C" stroke={strokeColor} strokeWidth="1.8" />
            <path
              d="M28 66 C30 50 44 48 48 66 M56 66 C58 53 74 53 78 66"
              fill={fillUrl}
              stroke={strokeColor}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          </g>
        );

      case 'boots':
        return (
          <g>
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
            <path
              d="M35 22 L48 22 L47 47 Q41 50 34 47 Z"
              fill="rgba(0,0,0,0.32)"
              stroke={detailStroke}
              strokeWidth="1.5"
            />
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
            <path d="M13 55 Q24 55 27 69 M56 47 Q62 59 78 60" fill="none" stroke={detailStroke} strokeWidth="1.4" />
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
