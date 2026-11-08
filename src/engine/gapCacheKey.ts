import { BiometricProfile, Garment } from '../types/wardrobe';

/**
 * Computes a deterministic structural fingerprint for the wardrobe and biometric profile.
 * Non-combinatorial fields such as `wearCount`, `lastWornDate`, `isClean`, `favoriteOutfits`,
 * or `customOutfitNames` are intentionally excluded so everyday interactions never trigger
 * redundant 150-context combinatorial gap simulations.
 */
export function computeGapStructuralKey(
  garments: Garment[],
  profile: BiometricProfile
): string {
  const structuralGarmentKey = garments
    .map(
      (g) =>
        `${g.id}:${g.category}:${g.subcategory}:${g.colorHex}:${g.accentColorHex || ''}:${
          g.pattern || 'solid'
        }:${g.fit}:${g.neckline}:${g.texture}:${g.thermalRating}:${(
          g.thermalRatings || []
        ).join(',')}:${g.formality}:${(g.formalities || []).join(',')}:${
          g.waterResistant ? 1 : 0
        }:${g.windproof ? 1 : 0}:${g.rainproof ? 1 : 0}:${g.hasPrint ? 1 : 0}:${
          g.hasLogo ? 1 : 0
        }:${g.targetScope || ''}`
    )
    .join('|');

  const structuralProfileKey = `${profile.undertone}:${profile.contrastLevel}:${
    profile.chromaLevel
  }:${profile.valueLevel}:${profile.eyeHex}:${profile.haircutStyle}:${
    profile.facialHair
  }:${profile.wardrobeScope || ''}:${(profile.wardrobeScopes || []).join(',')}:${
    profile.defaultStylePreferences?.colorHarmony || ''
  }:${(profile.defaultStylePreferences?.preferredModifiers || []).join(',')}`;

  return `${structuralProfileKey}###${structuralGarmentKey}`;
}
